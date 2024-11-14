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

    // Log all incoming requests with headers
    await this.logToDatadog('websocket_request', {
      connection_id: connectionId,
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers),
      cf: request.cf,
      timestamp: new Date().toISOString()
    });

    try {
      // Check upgrade headers
      const upgrade = request.headers.get("Upgrade") || '';
      const connection = request.headers.get("Connection") || '';
      const wsKey = request.headers.get("Sec-WebSocket-Key");
      
      if (upgrade.toLowerCase() !== "websocket" || 
          !connection.toLowerCase().includes("upgrade")) {
        await this.logToDatadog('websocket_reject', {
          connection_id: connectionId,
          reason: 'invalid_upgrade',
          headers: { upgrade, connection }
        });
        return new Response("Expected WebSocket connection", { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Accept first, then add handlers
      server.accept();

      // Add to active users
      this.users.add(server);
      this.metrics.connections.total++;
      this.metrics.connections.current = this.users.size;
      this.metrics.connections.peak = Math.max(this.metrics.connections.peak, this.users.size);

      await this.logToDatadog('websocket_accepted', {
        connection_id: connectionId,
        users: this.users.size,
        total_connections: this.metrics.connections.total
      });

      server.addEventListener('message', async event => {
        const messageStart = Date.now();
        this.lastMessageTime = messageStart;
        
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') return;

          this.metrics.messages.total++;
          this.metrics.messages.bytes += event.data.length;
          
          // Log that we received a message to broadcast
          console.log('Broadcasting message:', data);

          // Broadcast to ALL users including sender
          const broadcasts = Array.from(this.users).map(async user => {
            if (user.readyState === 1) { // OPEN
              try {
                user.send(event.data);
                return true;
              } catch (error) {
                console.error('Send failed:', error);
                return false;
              }
            }
            return false;
          });

          // Wait for all broadcasts to complete
          const results = await Promise.all(broadcasts);
          const failedCount = results.filter(r => !r).length;
          
          if (failedCount > 0) {
            await this.logToDatadog('broadcast_partial_failure', {
              connection_id: connectionId,
              failed: failedCount,
              total: this.users.size,
              message: data
            });
          }

        } catch (error) {
          await this.logError('parsing', error, {
            connection_id: connectionId,
            data_sample: event.data.substring(0, 200)
          });
        }
      });

      server.addEventListener('close', async event => {
        this.users.delete(server);
        const duration = Date.now() - requestStart;
        
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
        await this.logError('websocket', error, {
          connection_id: connectionId,
          duration: Date.now() - requestStart
        });
      });

      // Set up ping interval
      const pingInterval = setInterval(() => {
        if (server.readyState === 1) {
          try {
            server.send(JSON.stringify({ 
              type: 'ping', 
              timestamp: new Date().toISOString(),
              metrics: {
                uptime: Date.now() - this.startTime,
                users: this.users.size
              }
            }));
          } catch (error) {
            clearInterval(pingInterval);
            server.close();
          }
        } else {
          clearInterval(pingInterval);
        }
      }, 15000);

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade'
        }
      });

    } catch (error) {
      await this.logError('system', error, {
        connection_id: connectionId,
        duration: Date.now() - requestStart,
        request_info: {
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(request.headers)
        }
      });
      return new Response(error.message, { status: 500 });
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

    // Handle regular HTTP requests
    if (url.pathname === "/" || url.pathname === "/chat") {
      return new Response("Chatty Server", {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};

export default worker;