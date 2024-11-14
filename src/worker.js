export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.users = new Set();
    this.startTime = Date.now();
    
    // Enhanced statistics tracking
    this.metrics = {
      messages: {
        total: 0,
        bytes: 0,
        failed: 0,
        ratePerMinute: 0,
        avgSize: 0,
        processingTimes: [], // Last 100 messages
        broadcastTimes: []   // Last 100 broadcasts
      },
      connections: {
        total: 0,
        current: 0,
        peak: 0,
        failed: 0,
        avgDuration: 0,
        durations: [] // Last 100 connections
      },
      errors: {
        websocket: { count: 0, lastTime: null, details: [] },
        broadcast: { count: 0, lastTime: null, details: [] },
        connection: { count: 0, lastTime: null, details: [] },
        parsing: { count: 0, lastTime: null, details: [] },
        system: { count: 0, lastTime: null, details: [] },
        datadog: { count: 0, lastTime: null, details: [] }
      },
      performance: {
        lastGC: null,
        memoryUsage: [],
        cpuUsage: [],
        lastMetricsFlush: Date.now()
      }
    };

    // Start periodic metrics flush
    this.startMetricsReporting();
  }

  // Keep arrays at reasonable size
  truncateArray(arr, maxSize = 100) {
    if (arr.length > maxSize) {
      arr.splice(0, arr.length - maxSize);
    }
  }

  // Calculate performance metrics
  getPerformanceMetrics() {
    try {
      const memory = {};
      if (typeof performance !== 'undefined' && performance.memory) {
        memory.heapSize = performance.memory.totalJSHeapSize;
        memory.heapUsed = performance.memory.usedJSHeapSize;
        memory.heapLimit = performance.memory.jsHeapSizeLimit;
      }
      
      return {
        timestamp: Date.now(),
        memory,
        messageRate: this.calculateMessageRate(),
        avgProcessingTime: this.calculateAverage(this.metrics.messages.processingTimes),
        avgBroadcastTime: this.calculateAverage(this.metrics.messages.broadcastTimes),
        connectionRate: this.calculateConnectionRate()
      };
    } catch (error) {
      this.logError('system', error, { context: 'performance_metrics' });
      return {};
    }
  }

  calculateAverage(arr) {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  calculateMessageRate() {
    const timeWindow = 60000; // 1 minute
    const now = Date.now();
    const recentMessages = this.metrics.messages.processingTimes.filter(
      time => (now - time) < timeWindow
    ).length;
    return recentMessages / (timeWindow / 1000);
  }

  calculateConnectionRate() {
    const timeWindow = 60000; // 1 minute
    const now = Date.now();
    const recentConnections = this.metrics.connections.durations.filter(
      duration => (now - duration.timestamp) < timeWindow
    ).length;
    return recentConnections / (timeWindow / 1000);
  }

  async startMetricsReporting() {
    try {
      const metricsInterval = 15000; // 15 seconds
      setInterval(async () => {
        const now = Date.now();
        const metrics = this.getPerformanceMetrics();
        
        // Store historical metrics
        this.metrics.performance.memoryUsage.push({
          timestamp: now,
          ...metrics.memory
        });
        
        this.truncateArray(this.metrics.performance.memoryUsage);
        
        // Flush metrics to Datadog
        await this.logToDatadog('metrics_flush', {
          metrics,
          stats: this.metrics,
          tags: [
            `users:${this.users.size}`,
            `uptime:${now - this.startTime}`,
            `message_rate:${metrics.messageRate.toFixed(2)}`,
            `connection_rate:${metrics.connectionRate.toFixed(2)}`
          ]
        });

        this.metrics.performance.lastMetricsFlush = now;
      }, metricsInterval);
    } catch (error) {
      await this.logError('system', error, { 
        context: 'metrics_reporting',
        severity: 'HIGH'
      });
    }
  }

  async logError(category, error, context = {}) {
    const errorTime = new Date();
    this.metrics.errors[category].count++;
    this.metrics.errors[category].lastTime = errorTime;
    this.metrics.errors[category].details.push({
      time: errorTime,
      message: error.message,
      stack: error.stack
    });
    this.truncateArray(this.metrics.errors[category].details);

    const errorLog = {
      error_category: category,
      error_message: error.message,
      error_stack: error.stack,
      error_time: errorTime.toISOString(),
      impact: {
        active_users: this.users.size,
        uptime_ms: Date.now() - this.startTime,
        total_errors: Object.values(this.metrics.errors)
          .reduce((sum, stat) => sum + stat.count, 0)
      },
      metrics: this.metrics,
      tags: [
        `error_category:${category}`,
        `severity:${context.severity || 'ERROR'}`,
        `users:${this.users.size}`
      ],
      ...context
    };

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
          error: errorLog,
          severity: context.severity || 'ERROR',
          timestamp: errorTime.toISOString()
        })
      });
    } catch (ddError) {
      this.metrics.errors.datadog.count++;
      console.error('Failed to log to Datadog:', ddError, 'Original error:', error);
    }
  }

  async logToDatadog(event, data = {}) {
    try {
        const timestamp = new Date().toISOString();
        const baseMetrics = {
            uptime_ms: Date.now() - this.startTime,
            users_count: this.users.size,
            message_count: this.metrics.messages.total,
            error_count: Object.values(this.metrics.errors).reduce((sum, stat) => sum + stat.count, 0)
        };

        // Enhanced log structure for Datadog compatibility
        await fetch("https://http-intake.logs.datadoghq.com/api/v2/logs", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'DD-API-KEY': this.env.DD_API_KEY
            },
            body: JSON.stringify({
                ddsource: "worker",
                ddtags: `env:prod,service:chatty,event:${event},users:${this.users.size}`,
                message: event,
                service: "chatty",
                host: "worker",
                timestamp,
                attributes: {
                    event_name: event,
                    event_details: data,
                    metrics: {
                        ...baseMetrics,
                        ...data.metrics  // Adding custom metrics if provided
                    },
                    tags: [
                        `event:${event}`,
                        `users:${this.users.size}`,
                        ...(data.tags || [])
                    ]
                }
            })
        });
    } catch (error) {
        await this.logError('datadog', error, {
            severity: 'CRITICAL',
            failed_event: event,
            failed_data: data
        });
    }
}


  async logTestMetric() {
    await this.logToDatadog('test_metric', {
      metrics: {
        test_metric_value: {
          value: 123,
          type: 'gauge'
        }
      },
      tags: ['test_metric']
    });
  }

  async fetch(request) {
    const requestStart = Date.now();
    const requestId = crypto.randomUUID();
    const connectionMetrics = {
      startTime: requestStart,
      processingTime: 0,
      bytesProcessed: 0
    };

    try {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        const error = new Error("Expected WebSocket connection");
        await this.logError('connection', error, {
          request_id: requestId,
          headers: Object.fromEntries(request.headers),
          processing_time: Date.now() - requestStart
        });
        return new Response("Expected WebSocket", { status: 400 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      const connectionId = crypto.randomUUID();

      server.accept();
      this.users.add(server);
      this.metrics.connections.total++;
      this.metrics.connections.current = this.users.size;
      this.metrics.connections.peak = Math.max(this.metrics.connections.peak, this.users.size);

            await this.logToDatadog('websocket_connected', {
        connection_id: connectionId,
        request_id: requestId,
        metrics: {
          setup_time: Date.now() - requestStart,
          current_connections: this.users.size,
          peak_connections: this.metrics.connections.peak
        },
        tags: [`connection_id:${connectionId}`]
      });

      server.addEventListener('message', async event => {
        const messageStart = Date.now();
        try {
          const messageData = JSON.parse(event.data);
          this.metrics.messages.total++;
          this.metrics.messages.bytes += event.data.length;
          
          const processingTime = Date.now() - messageStart;
          this.metrics.messages.processingTimes.push(processingTime);
          this.truncateArray(this.metrics.messages.processingTimes);

          await this.logToDatadog('message_received', {
            connection_id: connectionId,
            metrics: {
              processing_time: processingTime,
              message_size: event.data.length,
              total_messages: this.metrics.messages.total,
              avg_processing_time: this.calculateAverage(this.metrics.messages.processingTimes)
            },
            message_sample: messageData.message?.substring(0, 100),
            tags: [
              `connection_id:${connectionId}`,
              `message_size:${event.data.length}`
            ]
          });

          const broadcastStart = Date.now();
          let broadcastErrors = 0;
          const failedRecipients = [];

          for (const user of this.users) {
            try {
              user.send(event.data);
            } catch (error) {
              broadcastErrors++;
              failedRecipients.push(error.message);
              await this.logError('broadcast', error, {
                connection_id: connectionId,
                message_size: event.data.length,
                failed_recipients_count: broadcastErrors
              });
            }
          }

          const broadcastTime = Date.now() - broadcastStart;
          this.metrics.messages.broadcastTimes.push(broadcastTime);
          this.truncateArray(this.metrics.messages.broadcastTimes);

          if (broadcastErrors > 0) {
            this.metrics.messages.failed += broadcastErrors;
            await this.logError('broadcast', new Error('Partial broadcast failure'), {
              connection_id: connectionId,
              metrics: {
                broadcast_time: broadcastTime,
                total_recipients: this.users.size,
                failed_count: broadcastErrors,
                success_rate: (this.users.size - broadcastErrors) / this.users.size
              },
              failed_details: failedRecipients
            });
          }

        } catch (error) {
          this.metrics.messages.failed++;
          await this.logError('parsing', error, {
            connection_id: connectionId,
            data_preview: event.data.substring(0, 200),
            message_size: event.data.length,
            processing_time: Date.now() - messageStart
          });
        }
      });

      server.addEventListener('close', async () => {
        const sessionDuration = Date.now() - requestStart;
        this.users.delete(server);
        this.metrics.connections.current = this.users.size;
        this.metrics.connections.durations.push({
          timestamp: Date.now(),
          duration: sessionDuration
        });
        this.truncateArray(this.metrics.connections.durations);

        await this.logToDatadog('websocket_disconnected', {
          connection_id: connectionId,
          metrics: {
            session_duration: sessionDuration,
            current_connections: this.users.size,
            avg_session_duration: this.calculateAverage(
              this.metrics.connections.durations.map(d => d.duration)
            )
          },
          tags: [
            `connection_id:${connectionId}`,
            `session_duration:${sessionDuration}`
          ]
        });
      });

      server.addEventListener('error', async error => {
        await this.logError('websocket', error, {
          connection_id: connectionId,
          metrics: {
            duration_ms: Date.now() - requestStart,
            user_count: this.users.size,
            total_bytes: connectionMetrics.bytesProcessed
          },
          tags: [`connection_id:${connectionId}`]
        });
      });

      return new Response(null, {
        status: 101,
        webSocket: client
      });

    } catch (error) {
      await this.logError('system', error, {
        request_id: requestId,
        phase: 'connection_setup',
        metrics: {
          setup_time: Date.now() - requestStart,
          current_connections: this.users.size
        }
      });
      return new Response("Internal Server Error", { status: 500 });
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

