async fetch(request) {
    const requestStart = Date.now();
    const connectionId = crypto.randomUUID();

    // First log the attempt with all headers for debugging
    try {
      await this.logToDatadog('websocket_raw_request', {
        connection_id: connectionId,
        headers: Object.fromEntries(request.headers),
        cf: request.cf,
        url: request.url,
        method: request.method,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Continue even if logging fails
      console.error('Logging error:', error);
    }

    try {
      // Check upgrade
      const upgrade = request.headers.get("Upgrade") || '';
      const connection = request.headers.get("Connection") || '';
      
      if (upgrade.toLowerCase() !== "websocket" || 
          !connection.toLowerCase().includes("upgrade")) {
            
        await this.logToDatadog('websocket_reject', {
          connection_id: connectionId,
          reason: 'invalid_upgrade',
          headers: {
            upgrade,
            connection
          }
        });
        
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Set up server handlers before accepting
      server.addEventListener('error', event => {
        console.error('Server socket error:', event);
      });

      // Accept first, then add handlers
      server.accept();

      // Add to active users first to prevent race condition
      this.users.add(server);

      await this.logToDatadog('websocket_accepted', {
        connection_id: connectionId,
        users: this.users.size
      });

      server.addEventListener('close', async event => {
        this.users.delete(server);
        await this.logToDatadog('websocket_closed', {
          connection_id: connectionId,
          code: event.code,
          reason: event.reason,
          clean: event.wasClean
        });
      });

      server.addEventListener('message', async event => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') return;

          // Broadcast only to other users
          for (const user of this.users) {
            if (user !== server && user.readyState === 1) {
              try {
                user.send(event.data);
              } catch (error) {
                console.error('Send error:', error);
              }
            }
          }
        } catch (error) {
          console.error('Message error:', error);
        }
      });

      // Return minimal response
      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade'
        }
      });

    } catch (error) {
      await this.logToDatadog('websocket_error', {
        connection_id: connectionId,
        error: error.message,
        stack: error.stack
      });
      return new Response(error.message, { status: 500 });
    }
}