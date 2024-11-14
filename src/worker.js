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
    console.error("logError called:", category, error, context);
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
      console.error("Sending error to DD:", category);
      await fetch("https://http-intake.logs.datadoghq.com/api/v2/logs", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': 'b2e6e243844fa59b66e2e5c87d880a39'
        },
        body: JSON.stringify({
          ddsource: 'cloudflare-worker',
          ddtags: `env:prod,service:chatty,category:${category}`,
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
      console.error("DD error log sent successfully:", category);
    } catch (ddError) {
      console.error('Failed to log to Datadog:', ddError);
      this.metrics.errors.datadog.count++;
    }
  }

  async logToDatadog(event, data = {}) {
    console.error("logToDatadog called:", event, data);
    try {
      console.error("Sending event to DD:", event);
      await fetch("https://http-intake.logs.datadoghq.com/api/v2/logs", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': 'b2e6e243844fa59b66e2e5c87d880a39'
        },
        body: JSON.stringify({
          ddsource: 'cloudflare-worker',
          ddtags: `env:prod,service:chatty,event:${event}`,
          message: event,
          service: "chatty",
          timestamp: new Date().toISOString(),
          metrics: this.metrics,
          event_data: {
            ...data,
            connection_time: Date.now() - this.startTime,
            current_users: this.users.size
          }
        })
      });
      console.error("DD event log sent successfully:", event);
    } catch (error) {
      console.error("Failed to send event to DD:", event, error);
      await this.logError('datadog', error, { event, data });
    }
  }

  async fetch(request) {
    const requestStart = Date.now();
    const connectionId = crypto.randomUUID();
    console.error("Fetch called with connectionId:", connectionId);

    // Log request details
    await this.logToDatadog('websocket_request', {
      connection_id: connectionId,
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers),
      cf: request.cf,
      timestamp: new Date().toISOString()
    });

    try {
      const upgrade = request.headers.get("Upgrade") || '';
      const connection = request.headers.get("Connection") || '';
      const wsKey = request.headers.get("Sec-WebSocket-Key");
      const wsProtocol = request.headers.get("Sec-WebSocket-Protocol");
      const wsExtensions = request.headers.get("Sec-WebSocket-Extensions");
      
      if (upgrade.toLowerCase() !== "websocket" || 
          !connection.toLowerCase().includes("upgrade")) {
        console.error("Invalid upgrade request:", upgrade, connection);
        await this.logToDatadog('websocket_reject', {
          connection_id: connectionId,
          reason: 'invalid_upgrade',
          headers: { upgrade, connection }
        });
        return new Response("Expected WebSocket connection", { 
          status: 426,
          headers: {
            'Connection': 'keep-alive',
            'Keep-Alive': 'timeout=60',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      server.accept();
      this.users.add(server);
      this.metrics.connections.total++;
      this.metrics.connections.current = this.users.size;
      this.metrics.connections.peak = Math.max(this.metrics.connections.peak, this.users.size);

      console.error("WebSocket accepted, users:", this.users.size);
      await this.logToDatadog('websocket_accepted', {
        connection_id: connectionId,
        users: this.users.size,
        total_connections: this.metrics.connections.total
      });

      const pingInterval = setInterval(() => {
        if (server.readyState === 1) {
          try {
            server.send(JSON.stringify({ 
              type: 'ping', 
              timestamp: new Date().toISOString(),
              metrics: {
                uptime: Date.now() - this.startTime,
                users: this.users.size,
                connectionId
              }
            }));
          } catch (error) {
            console.error("Ping failed:", error);
            clearInterval(pingInterval);
            if (server.readyState === 1) {
              server.close(1001, "Ping failed");
            }
          }
        } else {
          clearInterval(pingInterval);
        }
      }, 15000);

      server.addEventListener('message', async event => {
        const messageStart = Date.now();
        this.lastMessageTime = messageStart;
        console.error("Message received:", event.data.substring(0, 100));
        
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') return;

          console.error("Processing message:", data);
          await this.logToDatadog('websocket_message', {
            connection_id: connectionId,
            message_size: event.data.length,
            message_type: data.type || 'chat',
            processing_start: messageStart
          });

          this.metrics.messages.total++;
          this.metrics.messages.bytes += event.data.length;

          const broadcasts = Array.from(this.users).map(async user => {
            if (user.readyState === 1) {
              try {
                user.send(event.data);
                return true;
              } catch (error) {
                console.error("Broadcast failed to user:", error);
                return false;
              }
            }
            return false;
          });

          const results = await Promise.all(broadcasts);
          const failedCount = results.filter(r => !r).length;
          
          const processingTime = Date.now() - messageStart;
          this.metrics.messages.processingTimes.push(processingTime);
          this.truncateArray(this.metrics.messages.processingTimes);
          
          if (failedCount > 0) {
            console.error("Partial broadcast failure:", failedCount, "of", this.users.size);
            await this.logToDatadog('broadcast_partial_failure', {
              connection_id: connectionId,
              failed: failedCount,
              total: this.users.size,
              processing_time: processingTime,
              message: data
            });
          }

        } catch (error) {
          console.error("Message processing error:", error);
          await this.logError('parsing', error, {
            connection_id: connectionId,
            data_sample: event.data.substring(0, 200)
          });
        }
      });

      server.addEventListener('close', async event => {
        clearInterval(pingInterval);
        this.users.delete(server);
        const duration = Date.now() - requestStart;
        
        console.error("WebSocket closed:", event.code, event.reason);
        await this.logToDatadog('websocket_closed', {
          connection_id: connectionId,
          duration,
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          remaining_users: this.users.size
        });
      });

      server.addEventListener('error', async error => {
        console.error("WebSocket error:", error);
        clearInterval(pingInterval);
        await this.logError('websocket', error, {
          connection_id: connectionId,
          duration: Date.now() - requestStart
        });
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Keep-Alive': 'timeout=60',
          'Sec-WebSocket-Protocol': wsProtocol || '',
          'Sec-WebSocket-Extensions': wsExtensions || '',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

    } catch (error) {
      console.error("System error:", error);
      await this.logError('system', error, {
        connection_id: connectionId,
        duration: Date.now() - requestStart,
        request_info: {
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(request.headers)
        }
      });
      return new Response(error.message, { 
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
          'Connection': 'keep-alive',
          'Keep-Alive': 'timeout=60',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
    }
  }
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle WebSocket connections regardless of path
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const id = env.CHATROOM.idFromName("default");
      const room = env.CHATROOM.get(id);
      return room.fetch(request);
    }

    // Redirect /chat to root for HTTP requests
    if (url.pathname === "/chat") {
      return new Response(null, {
        status: 301,
        headers: {
          'Location': '/',
          'Connection': 'keep-alive',
          'Keep-Alive': 'timeout=60',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
    }

    // Handle root path
    if (url.pathname === "/") {
      return new Response("Chatty Server", {
        headers: { 
          'Content-Type': 'text/plain',
          'Connection': 'keep-alive',
          'Keep-Alive': 'timeout=60',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
    }

    return new Response("Not Found", { 
      status: 404,
      headers: {
        'Content-Type': 'text/plain',
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=60',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
  }
};

export default worker;