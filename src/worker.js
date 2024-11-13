export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.users = new Set();
    this.startTime = Date.now();
    this.messageStats = {
      totalMessages: 0,
      totalBytes: 0,
      lastMessageTime: null
    };
    this.healthStats = {
      restarts: 0,
      errors: {
        connection: 0,
        message: 0,
        broadcast: 0,
        system: 0
      }
    };

    this.logToDatadog('system_start', {
      event_type: 'lifecycle',
      stats: this.getSystemStats()
    });
  }

  getSystemStats() {
    try {
      const now = Date.now();
      return {
        uptime_ms: now - this.startTime,
        users: {
          count: this.users.size,
          estimated_memory: new TextEncoder().encode(JSON.stringify([...this.users])).length
        },
        messages: {
          ...this.messageStats,
          rate_per_minute: this.messageStats.totalMessages / ((now - this.startTime) / 60000)
        },
        health: {
          ...this.healthStats,
          last_diagnostic_time: now
        }
      };
    } catch (error) {
      this.healthStats.errors.system++;
      return {
        error: 'Failed to calculate system stats',
        error_details: error.message,
        error_time: new Date().toISOString()
      };
    }
  }

  async logToDatadog(event, data = {}) {
    try {
      const basePayload = {
        message: event,
        service: "chatty",
        ddsource: "cloudflare-worker",
        hostname: "durable-object-chat",
        timestamp: new Date().toISOString(),
        system_stats: this.getSystemStats(),
        ...data
      };

      await fetch("https://http-intake.logs.datadoghq.com/api/v2/logs", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.env.DD_API_KEY
        },
        body: JSON.stringify(basePayload)
      });
    } catch (error) {
      console.error('Datadog log failed:', error);
      this.healthStats.errors.system++;
    }
  }

  async fetch(request) {
    const requestStart = Date.now();
    const requestId = crypto.randomUUID();

    // Log incoming request
    await this.logToDatadog('request_received', {
      event_type: 'request',
      request_id: requestId,
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers)
    });

    try {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        await this.logToDatadog('non_websocket_request', {
          event_type: 'request',
          request_id: requestId,
          path: new URL(request.url).pathname
        });
        return new Response("Expected WebSocket", { status: 400 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      const connectionId = crypto.randomUUID();

      server.accept();
      this.users.add(server);

      // Log connection with enhanced data
      await this.logToDatadog('websocket_connected', {
        event_type: 'connection',
        connection_id: connectionId,
        request_id: requestId,
        users_count: this.users.size,
        connection_stats: {
          total_connections: this.users.size,
          uptime_seconds: (Date.now() - this.startTime) / 1000
        }
      });

      server.addEventListener('message', async event => {
        const messageStart = Date.now();
        this.messageStats.totalMessages++;
        this.messageStats.totalBytes += event.data.length;
        this.messageStats.lastMessageTime = new Date().toISOString();

        try {
          const messageData = JSON.parse(event.data);
          
          // Log message with enhanced data
          await this.logToDatadog('message_received', {
            event_type: 'message',
            connection_id: connectionId,
            message_stats: {
              size: event.data.length,
              processing_time: Date.now() - messageStart,
              total_messages: this.messageStats.totalMessages
            },
            message_sample: messageData.message?.substring(0, 100)
          });

          // Broadcast to all users
          let broadcastErrors = 0;
          for (const user of this.users) {
            try {
              user.send(event.data);
            } catch (error) {
              broadcastErrors++;
              this.healthStats.errors.broadcast++;
            }
          }

          if (broadcastErrors > 0) {
            await this.logToDatadog('broadcast_partial_failure', {
              event_type: 'error',
              connection_id: connectionId,
              errors: broadcastErrors,
              total_recipients: this.users.size
            });
          }

        } catch (error) {
          this.healthStats.errors.message++;
          await this.logToDatadog('message_processing_error', {
            event_type: 'error',
            connection_id: connectionId,
            error: {
              message: error.message,
              stack: error.stack
            }
          });
        }
      });

      server.addEventListener('close', async () => {
        this.users.delete(server);
        await this.logToDatadog('websocket_disconnected', {
          event_type: 'connection',
          connection_id: connectionId,
          users_count: this.users.size,
          session_duration: Date.now() - requestStart
        });
      });

      server.addEventListener('error', async error => {
        this.healthStats.errors.connection++;
        await this.logToDatadog('websocket_error', {
          event_type: 'error',
          connection_id: connectionId,
          error: {
            message: error.message,
            type: error.type
          }
        });
      });

      return new Response(null, {
        status: 101,
        webSocket: client
      });

    } catch (error) {
      this.healthStats.errors.system++;
      await this.logToDatadog('system_error', {
        event_type: 'error',
        request_id: requestId,
        error: {
          message: error.message,
          stack: error.stack
        }
      });
      return new Response("Internal Server Error", { status: 500 });
    } finally {
      await this.logToDatadog('request_completed', {
        event_type: 'timing',
        request_id: requestId,
        duration_ms: Date.now() - requestStart
      });
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/chat") {
      const id = env.CHATROOM.idFromName("default");
      const room = env.CHATROOM.get(id);
      return room.fetch(request);
    }
    return new Response("Not Found", { status: 404 });
  }
}