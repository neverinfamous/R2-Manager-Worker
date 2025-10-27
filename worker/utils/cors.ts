export function getCorsHeaders(request: Request): HeadersInit {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  
  // Detect localhost for development
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const isLocalhostOrigin = origin.includes('localhost') || origin.includes('127.0.0.1');
  
  // Use specific origin for localhost to allow credentials, wildcard for production
  return {
    'Access-Control-Allow-Origin': (isLocalhost || isLocalhostOrigin) ? origin : '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-File-Name, X-Chunk-Index, X-Total-Chunks',
    'Access-Control-Allow-Credentials': (isLocalhost || isLocalhostOrigin) ? 'true' : 'false'
  };
}

export function handleCorsPreflightRequest(corsHeaders: HeadersInit): Response {
  console.log('[CORS] Handling preflight request');
  return new Response(null, { headers: corsHeaders });
}

export function isLocalDevelopment(request: Request): boolean {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const isLocalhostOrigin = origin.includes('localhost') || origin.includes('127.0.0.1');
  
  return isLocalhost || isLocalhostOrigin;
}

