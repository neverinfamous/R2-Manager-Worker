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
    let pingInterval;

    try {
      // Strict WebSocket upgrade validation
      const upgrade = request.headers.get("Upgrade");
      const connection = request.headers.get("Connection");
      const wsKey = request.headers.get("Sec-WebSocket-Key");
      const wsVersion = request.headers.get("Sec-WebSocket-Version");
      const wsExtensions = request.headers.get("Sec-WebSocket-Extensions");
      
      if (!upgrade || !connection || !wsKey || 
          upgrade.toLowerCase() !== "websocket" || 
          !connection.toLowerCase().includes("upgrade") ||
          wsVersion !== "13") {
        throw new Error("Invalid WebSocket upgrade request");
      }

      this.metrics.connections.attempts++;

      await this.logToDatadog('websocket_attempt', {
        connection_id: connectionId,
        request_headers: {
          upgrade,
          connection,
          wsVersion,
          wsExtensions,
          origin: request.headers.get("Origin"),
          userAgent: request.headers.get("User-Agent")
        },
        cf: request.cf
      });

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Set up message handling before accepting connection
      server.addEventListener('message', async event => {
        const messageStart = Date.now();
        this.lastMessageTime = messageStart;
        
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'pong') {
            return;
          }

          this.metrics.messages.total++;
          this.metrics.messages.bytes += event.data.length;
          
          const processingTime = Date.now() - messageStart;
          this.metrics.messages.processingTimes.push(processingTime);
          this.truncateArray(this.metrics.messages.processingTimes);

          // Broadcast with active user filtering
          const activeUsers = Array.from(this.users)
            .filter(user => user.readyState === 1);
          
          let failCount = 0;
          for (const user of activeUsers) {
            try {
              user.send(event.data);
            } catch (error) {
              failCount++;
              await this.logError('broadcast', error, {
                connection_id: connectionId,
                message_size: event.data.length
              });
            }
          }

          if (failCount > 0) {
            this.metrics.messages.failed += failCount;
            await this.logToDatadog('broadcast_partial_failure', {
              connection_id: connectionId,
              failed_count: failCount,
              total_recipients: activeUsers.length,
              message_size: event.data.length
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

      // Set up close handler before accepting connection
      server.addEventListener('close', async event => {
        clearInterval(pingInterval);
        const duration = Date.now() - requestStart;
        
        await this.logToDatadog('websocket_disconnected', {
          connection_id: connectionId,
          duration,
          close_code: event.code,
          close_reason: event.reason,
          user_count: this.users.size,
          time_since_last_message: this.lastMessageTime ? Date.now() - this.lastMessageTime : null
        });
        
        this.users.delete(server);
        this.metrics.connections.current = this.users.size;
      });

      // Set up error handler before accepting connection
      server.addEventListener('error', async error => {
        await this.logError('websocket', error, {
          connection_id: connectionId,
          duration: Date.now() - requestStart,
          user_count: this.users.size
        });
      });

      // Accept the connection
      server.accept();
      
      // Add to users after successful accept
      this.users.add(server);
      this.metrics.connections.total++;
      this.metrics.connections.current = this.users.size;
      this.metrics.connections.peak = Math.max(this.metrics.connections.peak, this.users.size);

      // Set up ping interval after successful accept
      pingInterval = setInterval(() => {
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
          } catch (error) {
            clearInterval(pingInterval);
            server.close();
          }
        }
      }, 15000);

      // Log successful connection
      await this.logToDatadog('websocket_connected', {
        connection_id: connectionId,
        users: this.users.size,
        total_connections: this.metrics.connections.total,
        client_info: {
          ip: request.headers.get('CF-Connecting-IP'),
          country: request.cf?.country,
          asn: request.cf?.asn,
          colo: request.cf?.colo
        }
      });

      // Return WebSocket upgrade response
      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Sec-WebSocket-Accept': wsKey,
          'Sec-WebSocket-Version': '13',
          'Sec-WebSocket-Extensions': wsExtensions || ''
        }
      });

    } catch (error) {
      clearInterval(pingInterval);
      await this.logError('system', error, {
        connection_id: connectionId,
        duration: Date.now() - requestStart,
        headers: Object.fromEntries(request.headers)
      });
      return new Response(error.message, { 
        status: 400,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
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