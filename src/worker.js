export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.users = new Set();
    this.startTime = Date.now();
    this.lastMessageTime = null;
    
    this.metrics = {
      messages: {
        total: 0,
        bytes: 0,
        failed: 0,
        ratePerMinute: 0,
        avgSize: 0,
        processingTimes: [],
        broadcastTimes: []
      },
      connections: {
        total: 0,
        current: 0,
        peak: 0,
        failed: 0,
        avgDuration: 0,
        durations: [],
        attempts: 0
      },
      errors: {
        websocket: { count: 0, lastTime: null, details: [] },
        broadcast: { count: 0, lastTime: null, details: [] },
        connection: { count: 0, lastTime: null, details: [] },
        parsing: { count: 0, lastTime: null, details: [] },
        system: { count: 0, lastTime: null, details: [] },
        datadog: { count: 0, lastTime: null, details: [] }
      }
    };
  }

  truncateArray(arr, maxSize = 100) {
    if (arr.length > maxSize) {
      arr.splice(0, arr.length - maxSize);
    }
  }

  async logError(category, error, context = {}) {
    const errorTime = new Date();
    this.metrics.errors[category].count++;
    this.metrics.errors[category].lastTime = errorTime;
    this.metrics.errors[category].details.push({
      time: errorTime,
      message: error.message,
      stack: error.stack,
      ...context
    });
    this.truncateArray(this.metrics.errors[category].details);

    try {
      await fetch("https://http-intake.logs.datadoghq.com/api/v2/logs", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.env.DD_API_KEY
        },
        body: JSON.stringify({
          message: `${category}_error`,
          service: "chatty",
          error: {
            category,
            message: error.message,
            stack: error.stack,
            context,
            metrics: this.metrics
          },
          timestamp: errorTime.toISOString()
        })
      });
    } catch (ddError) {
      console.error('Failed to log to Datadog:', ddError);
      this.metrics.errors.datadog.count++;
    }
  }

  async logToDatadog(event, data = {}) {
    try {
      await fetch("https://http-intake.logs.datadoghq.com/api/v2/logs", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.env.DD_API_KEY
        },
        body: JSON.stringify({
          message: event,
          service: "chatty",
          timestamp: new Date().toISOString(),
          metrics: this.metrics,
          event_data: data
        })
      });
    } catch (error) {
      await this.logError('datadog', error, { event, data });
    }
  }

  async fetch(request) {
    const requestStart = Date.now();
    const connectionId = crypto.randomUUID();
    let isAlive = true;
    let pingInterval;

    try {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        throw new Error("Expected WebSocket");
      }

      this.metrics.connections.attempts++;

      // Log connection attempt
      await this.logToDatadog('websocket_attempt', {
        connection_id: connectionId,
        cf: request.cf,
        headers: Object.fromEntries(request.headers),
        metrics: {
          attempts: this.metrics.connections.attempts,
          current_users: this.users.size
        }
      });

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Set up ping/pong handling
      pingInterval = setInterval(() => {
        if (!isAlive) {
          clearInterval(pingInterval);
          try {
            server.close(1000, "Ping timeout");
          } catch (err) {
            // Ignore close errors
          }
          return;
        }
        if (server.readyState === 1) {
          try {
            server.send(JSON.stringify({ 
              type: 'ping', 
              timestamp: new Date().toISOString(),
              metrics: {
                uptime: Date.now() - this.startTime,
                users: this.users.size,
                lastMessageAge: this.lastMessageTime ? Date.now() - this.lastMessageTime : null
              }
            }));
            isAlive = false; // Reset flag, waiting for pong
          } catch (error) {
            clearInterval(pingInterval);
            server.close(1001, "Failed to send ping");
          }
        }
      }, 15000);

      // Set up message handling
      server.addEventListener('message', async event => {
        const messageStart = Date.now();
        this.lastMessageTime = messageStart;
        
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'pong') {
            isAlive = true;
            return;
          }

          this.metrics.messages.total++;
          this.metrics.messages.bytes += event.data.length;
          
          const processingTime = Date.now() - messageStart;
          this.metrics.messages.processingTimes.push(processingTime);
          this.truncateArray(this.metrics.messages.processingTimes);

          // Broadcast with confirmation
          const broadcastPromises = Array.from(this.users).map(async user => {
            if (user.readyState === 1) {
              try {
                user.send(event.data);
                return true;
              } catch (error) {
                return false;
              }
            }
            return false;
          });

          const results = await Promise.all(broadcastPromises);
          const failedCount = results.filter(r => !r).length;
          
          if (failedCount > 0) {
            this.metrics.messages.failed += failedCount;
            await this.logToDatadog('broadcast_partial_failure', {
              connection_id: connectionId,
              failed_count: failedCount,
              total_users: this.users.size
            });
          }

        } catch (error) {
          this.metrics.messages.failed++;
          await this.logError('parsing', error, {
            connection_id: connectionId,
            data_sample: event.data.substring(0, 200)
          });
        }
      });

      // Set up close handler
      server.addEventListener('close', async (event) => {
        clearInterval(pingInterval);
        const duration = Date.now() - requestStart;
        
        await this.logToDatadog('websocket_disconnected', {
          connection_id: connectionId,
          duration,
          close_code: event.code,
          close_reason: event.reason,
          user_count: this.users.size,
          was_alive: isAlive,
          time_since_last_message: this.lastMessageTime ? Date.now() - this.lastMessageTime : null
        });
        
        this.users.delete(server);
        this.metrics.connections.current = this.users.size;
      });

      // Set up error handler
      server.addEventListener('error', async error => {
        await this.logError('websocket', error, {
          connection_id: connectionId,
          duration: Date.now() - requestStart,
          was_alive: isAlive
        });
      });

      // Now that handlers are set up, accept the connection
      server.accept();
      
      // Add to users after successful accept
      this.users.add(server);
      this.metrics.connections.total++;
      this.metrics.connections.current = this.users.size;
      this.metrics.connections.peak = Math.max(this.metrics.connections.peak, this.users.size);

      // Log successful connection
      await this.logToDatadog('websocket_connected', {
        connection_id: connectionId,
        users: this.users.size,
        total_connections: this.metrics.connections.total
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Sec-WebSocket-Version': '13',
          'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits'
        }
      });

    } catch (error) {
      clearInterval(pingInterval);
      await this.logError('system', error, {
        connection_id: connectionId,
        duration: Date.now() - requestStart
      });
      return new Response("Internal Server Error", { status: 500 });
    }
  }
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/chat") {
      const id = env.CHATROOM.idFromName("default");
      const room = env.CHATROOM.get(id);
      return room.fetch(request);
    }
    return new Response("Not Found", { status: 404 });
  }
};

export default worker;