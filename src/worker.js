export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.users = new Set();
    this.startTime = Date.now();
    this.pendingLogs = [];
    this.logFlushInterval = null;

    // Use state storage for metrics to persist across isolate recycling
    this.initMetrics();
  }

  async initMetrics() {
    let metrics = await this.state.storage.get('metrics');
    if (!metrics) {
      metrics = {
        messages: { total: 0, bytes: 0, failed: 0 },
        connections: { total: 0, current: 0, peak: 0 },
        errors: { count: 0, details: [] }
      };
    }
    this.metrics = metrics;
    this.flushPendingLogs();
  }

  // Queue log instead of sending immediately
  queueLog(type, data = {}) {
    this.pendingLogs.push({
      timestamp: new Date().toISOString(),
      type,
      data: {
        ...data,
        connection_time: Date.now() - this.startTime,
        current_users: this.users.size,
        metrics: this.metrics
      }
    });
  }

  // Batch send logs every few seconds
  async flushPendingLogs() {
    if (this.logFlushInterval) return;

    this.logFlushInterval = setInterval(async () => {
      if (this.pendingLogs.length === 0) return;

      const logs = this.pendingLogs.splice(0, 20); // Process in smaller batches
      
      try {
        await fetch("https://http-intake.logs.datadoghq.com/api/v2/logs", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': 'b2e6e243844fa59b66e2e5c87d880a39'
          },
          body: JSON.stringify(logs.map(log => ({
            ddsource: 'cloudflare-worker',
            ddtags: `env:prod,service:chatty,event:${log.type}`,
            message: log.type,
            timestamp: log.timestamp,
            data: log.data
          })))
        });
      } catch (error) {
        console.error('Log flush failed:', error);
        // Re-queue failed logs
        this.pendingLogs.unshift(...logs);
      }
    }, 5000); // Flush every 5 seconds
  }

  async fetch(request) {
    const connectionId = crypto.randomUUID();
    this.queueLog('websocket_request', {
      connection_id: connectionId,
      url: request.url,
      headers: Object.fromEntries(request.headers)
    });

    try {
      if (!request.headers.get("Upgrade")?.toLowerCase().includes("websocket")) {
        this.queueLog('websocket_reject', {
          connection_id: connectionId,
          reason: 'invalid_upgrade'
        });
        return new Response("Expected WebSocket", { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      server.accept();
      this.users.add(server);
      this.metrics.connections.total++;
      this.metrics.connections.current = this.users.size;
      this.metrics.connections.peak = Math.max(this.metrics.connections.peak, this.users.size);
      await this.state.storage.put('metrics', this.metrics);

      this.queueLog('websocket_accepted', {
        connection_id: connectionId,
        users: this.users.size
      });

      let pingInterval = setInterval(() => {
        if (server.readyState === 1) {
          try {
            server.send(JSON.stringify({ type: 'ping' }));
          } catch (error) {
            clearInterval(pingInterval);
            server.close();
          }
        } else {
          clearInterval(pingInterval);
        }
      }, 15000);

      server.addEventListener('message', async event => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') return;

          this.metrics.messages.total++;
          this.metrics.messages.bytes += event.data.length;
          await this.state.storage.put('metrics', this.metrics);

          this.queueLog('websocket_message', {
            connection_id: connectionId,
            size: event.data.length
          });

          // Broadcast to all users
          const broadcasts = Array.from(this.users).map(async user => {
            if (user.readyState === 1) {
              try {
                user.send(event.data);
                return true;
              } catch {
                return false;
              }
            }
            return false;
          });

          const results = await Promise.allSettled(broadcasts);
          const failedCount = results.filter(r => r.status === 'rejected' || !r.value).length;

          if (failedCount > 0) {
            this.queueLog('broadcast_failure', {
              connection_id: connectionId,
              failed: failedCount,
              total: this.users.size
            });
          }
        } catch (error) {
          this.metrics.errors.count++;
          this.metrics.errors.details.push({
            time: new Date().toISOString(),
            type: 'message_processing',
            error: error.message
          });
          await this.state.storage.put('metrics', this.metrics);

          this.queueLog('error', {
            connection_id: connectionId,
            type: 'message_processing',
            error: error.message
          });
        }
      });

      server.addEventListener('close', async () => {
        clearInterval(pingInterval);
        this.users.delete(server);
        this.metrics.connections.current = this.users.size;
        await this.state.storage.put('metrics', this.metrics);

        this.queueLog('websocket_closed', {
          connection_id: connectionId,
          remaining_users: this.users.size
        });
      });

      server.addEventListener('error', async error => {
        this.metrics.errors.count++;
        this.metrics.errors.details.push({
          time: new Date().toISOString(),
          type: 'websocket',
          error: error.message
        });
        await this.state.storage.put('metrics', this.metrics);

        this.queueLog('error', {
          connection_id: connectionId,
          type: 'websocket',
          error: error.message
        });
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade'
        }
      });

    } catch (error) {
      this.metrics.errors.count++;
      this.metrics.errors.details.push({
        time: new Date().toISOString(),
        type: 'system',
        error: error.message
      });
      await this.state.storage.put('metrics', this.metrics);

      this.queueLog('error', {
        connection_id: connectionId,
        type: 'system',
        error: error.message
      });

      return new Response(error.message, { status: 500 });
    }
  }
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const id = env.CHATROOM.idFromName("default");
      const room = env.CHATROOM.get(id);
      return room.fetch(request);
    }

    return new Response("Chatty Server", {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};

export default worker;