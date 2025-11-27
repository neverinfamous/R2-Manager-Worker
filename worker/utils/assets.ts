import type { Env } from '../types';

export function handleSiteWebmanifest(): Response {
  return new Response(JSON.stringify({
    name: "R2 Bucket Manager",
    short_name: "R2 Manager",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: []
  }), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'max-age=86400',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export async function handleStaticAsset(request: Request, env: Env, corsHeaders: HeadersInit): Promise<Response> {
  const url = new URL(request.url);
  
  // Serve other static assets (only in production with ASSETS binding)
  if (url.pathname.startsWith('/manifest.json') || url.pathname.startsWith('/favicon.ico')) {
    if (env.ASSETS !== undefined) {
      try {
        return await env.ASSETS.fetch(request);
      } catch (e) {
        console.error('[Assets] Failed to serve static asset:', e);
        return new Response('Not Found', { status: 404 });
      }
    }
    // In development, return 404 - these are handled by Vite
    return new Response('Not Found', { status: 404 });
  }
  
  return new Response('Not Found', { status: 404, headers: corsHeaders });
}

export async function serveFrontendAssets(request: Request, env: Env, isLocalhost: boolean): Promise<Response> {
  // Serve frontend assets (only in production)
  // In development, frontend is served by Vite on port 5173
  if (env.ASSETS !== undefined) {
    try {
      console.log('[Assets] Serving frontend asset');
      return await env.ASSETS.fetch(request);
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  } else {
    // Development mode: redirect to Vite server
    if (isLocalhost) {
      return new Response('Development mode: Frontend is served by Vite on http://localhost:5173', { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    return new Response('Not Found', { status: 404 });
  }
}

