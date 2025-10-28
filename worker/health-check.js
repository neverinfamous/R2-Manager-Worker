#!/usr/bin/env node

/**
 * Health Check Script for R2 Bucket Manager
 * 
 * Simple HTTP health check for distroless Docker containers.
 * Makes a GET request to the /health endpoint and exits with:
 * - 0 if the server responds with HTTP 200
 * - 1 if the server is unreachable or returns non-200 status
 * 
 * Used by Docker HEALTHCHECK directive as a replacement for curl.
 */

import http from 'http';

const options = {
  host: 'localhost',
  port: 8787,
  path: '/health',
  timeout: 5000,
  method: 'GET'
};

const req = http.get(options, (res) => {
  // Exit with success only if status code is 200
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

// Handle connection errors
req.on('error', (err) => {
  process.exit(1);
});

// Handle timeout
req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

