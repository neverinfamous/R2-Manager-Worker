import type { Env } from './types';
import { CF_API } from './types';
import { validateAccessJWT } from './utils/auth';
import { validateSignature } from './utils/signing';
import { getCorsHeaders, handleCorsPreflightRequest, isLocalDevelopment } from './utils/cors';
import { handleSiteWebmanifest, handleStaticAsset, serveFrontendAssets } from './utils/assets';
import { checkRateLimit, createRateLimitResponse } from './utils/ratelimit';
import { handleBucketRoutes } from './routes/buckets';
import { handleFileRoutes } from './routes/files';
import { handleFolderRoutes } from './routes/folders';
import { handleSearchRoutes } from './routes/search';
import { handleAISearchRoutes } from './routes/ai-search';
import { handleJobRoutes } from './routes/jobs';
import { handleAuditRoutes } from './routes/audit';

async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  console.log('[Request]', request.method, url.pathname);
  
  // Get CORS headers
  const corsHeaders = getCorsHeaders(request);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleCorsPreflightRequest(corsHeaders);
  }

  // Serve site.webmanifest directly (avoids Cloudflare Access CORS block)
  if (url.pathname === '/site.webmanifest') {
    return handleSiteWebmanifest();
  }

  // Serve other static assets
  const staticAssetResponse = await handleStaticAsset(request, env, corsHeaders);
  if (staticAssetResponse.status !== 404 || url.pathname.startsWith('/manifest.json') || url.pathname.startsWith('/favicon.ico')) {
    return staticAssetResponse;
  }

  // Check for signed file downloads
  if (url.pathname.includes('/download/')) {
    console.log('[Download] Request:', url.pathname, 'query:', url.search);
    
    if (await validateSignature(request, env)) {
      const pathParts = url.pathname.split('/');
      const bucketName = pathParts[3];
      // Get everything after /download/ to support nested folders
      const fileName = pathParts.slice(5).map(part => decodeURIComponent(part)).join('/');

      console.log('[Download] Attempting download:', {
        bucket: bucketName,
        file: fileName,
        pathParts
      });

      try {
        const fetchUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(fileName);
        console.log('[Download] Fetching from R2:', fetchUrl);
        
        const response = await fetch(fetchUrl, {
          headers: {
            'X-Auth-Email': env.CF_EMAIL,
            'X-Auth-Key': env.API_KEY
          }
        });

        console.log('[Download] R2 response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Download] R2 error:', errorText);
          throw new Error('Download failed: ' + response.status);
        }

        return new Response(response.body, {
          headers: {
            'Content-Type': response.headers.get('Content-Type') ?? 'application/octet-stream',
            'Content-Disposition': 'attachment; filename="' + fileName + '"',
            'Cache-Control': 'no-store, max-age=0, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            ...corsHeaders
          }
        });
      } catch (err) {
        console.error('[Files] Download error:', err);
        return new Response(JSON.stringify({ 
          error: 'Download failed'
        }), { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    } else {
      console.error('[Files] Invalid signature for download:', url.pathname);
      return new Response(JSON.stringify({ 
        error: 'Invalid signature' 
      }), { 
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }

  // Check if local development
  const isLocalhost = isLocalDevelopment(request);
  
  // Skip auth for localhost development
  let userEmail: string | null = null;
  if (isLocalhost) {
    console.log('[Auth] Localhost detected, skipping JWT validation');
    userEmail = 'dev@localhost';
  } else {
    // Require auth for production API endpoints
    userEmail = await validateAccessJWT(request, env);
    if (!userEmail) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: corsHeaders
      });
    }
  }

  // Check rate limits for API requests (skip for localhost and if rate limiters not configured)
  if (!isLocalhost && url.pathname.startsWith('/api/') && env.RATE_LIMITER_READ !== undefined) {
    try {
      const rateLimitResult = await checkRateLimit(env, request.method, url.pathname, userEmail);
      
      if (!rateLimitResult.success) {
        // Rate limit exceeded - return 429 response
        console.warn('[Rate Limit] Request blocked', {
          userEmail,
          method: request.method,
          pathname: url.pathname,
          tier: rateLimitResult.tier
        });
        
        return createRateLimitResponse(rateLimitResult, corsHeaders);
      }
    } catch (error) {
      // Log error but don't block request if rate limiting fails
      console.error('[Rate Limit] Error checking rate limit:', error);
    }
  }

  // Detect if we're in local development without credentials
  const isLocalDev = isLocalhost && (!env.ACCOUNT_ID || !env.CF_EMAIL || !env.API_KEY);

  // Route API requests
  if (url.pathname.startsWith('/api/ai-search')) {
    return await handleAISearchRoutes(request, env, url, corsHeaders, isLocalDev);
  }

  if (url.pathname.startsWith('/api/jobs')) {
    const jobResponse = await handleJobRoutes(request, env, url, corsHeaders, isLocalDev, userEmail);
    if (jobResponse) {
      return jobResponse;
    }
  }

  if (url.pathname.startsWith('/api/audit')) {
    const auditResponse = await handleAuditRoutes(request, env, url, corsHeaders, isLocalDev, userEmail);
    if (auditResponse) {
      return auditResponse;
    }
  }

  if (url.pathname.startsWith('/api/search')) {
    return await handleSearchRoutes(request, env, url, corsHeaders, isLocalDev);
  }

  if (url.pathname.startsWith('/api/buckets')) {
    return await handleBucketRoutes(request, env, url, corsHeaders, isLocalDev, userEmail);
  }

  if (url.pathname.startsWith('/api/files/')) {
    return await handleFileRoutes(request, env, url, corsHeaders, isLocalDev, userEmail);
  }

  if (url.pathname.startsWith('/api/folders/')) {
    return await handleFolderRoutes(request, env, url, corsHeaders, isLocalDev, userEmail);
  }

  // Serve frontend assets
  return await serveFrontendAssets(request, env, isLocalhost);
}

export default {
   
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    try {
      return await handleApiRequest(request, env);
    } catch (e) {
      console.error('[Error] Unhandled error:', e);
      return new Response('Internal Server Error: ' + (e as Error).message, { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
}
