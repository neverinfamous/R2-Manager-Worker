import type { Env } from './types';
import { logInfo, logWarning, logError } from './utils/error-logger';
import { CF_API } from './types';
import { validateAccessJWT } from './utils/auth';
import { validateSignature } from './utils/signing';
import { getCorsHeaders, handleCorsPreflightRequest, isLocalDevelopment } from './utils/cors';
import { getCloudflareHeaders } from './utils/helpers';
import { handleSiteWebmanifest, handleStaticAsset, serveFrontendAssets } from './utils/assets';
import { checkRateLimit, createRateLimitResponse } from './utils/ratelimit';
import { SUPPORT_EMAIL } from './utils/error-response';
import { handleBucketRoutes } from './routes/buckets';
import { handleFileRoutes } from './routes/files';
import { handleFolderRoutes } from './routes/folders';
import { handleSearchRoutes } from './routes/search';
import { handleAISearchRoutes } from './routes/ai-search';
import { handleJobRoutes } from './routes/jobs';
import { handleAuditRoutes } from './routes/audit';
import { handleS3ImportRoutes } from './routes/s3-import';
import { handleMetricsRoutes } from './routes/metrics';
import { handleHealthRoutes } from './routes/health';
import { handleWebhookRoutes } from './routes/webhooks';
import { handleTagRoutes } from './routes/tags';
import { handleMigrationRoutes } from './routes/migrations';
import { handleColorRoutes } from './routes/colors';


async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  // Detect if we're in local development (hoisted for logging availability)
  const isLocalhost = isLocalDevelopment(request);
  const isLocalDev = isLocalhost && (!env.ACCOUNT_ID || !env.CF_EMAIL || !env.API_KEY);

  logInfo(`[Request] ${request.method} ${url.pathname}`, { module: 'worker', operation: 'request' });

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
    logInfo(`[Download] Request: ${url.pathname} query: ${url.search}`, { module: 'worker', operation: 'download_check' });

    if (await validateSignature(request, env)) {
      const pathParts = url.pathname.split('/');
      const bucketName = pathParts[3];
      // Get everything after /download/ to support nested folders
      const fileName = pathParts.slice(5).map(part => decodeURIComponent(part)).join('/');

      logInfo('Attempting download', { module: 'worker', operation: 'download_check', bucketName: bucketName ?? 'unknown', fileName });

      try {
        const fetchUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(fileName);
        logInfo(`Fetching from R2: ${fetchUrl}`, { module: 'worker', operation: 'download_check', bucketName: bucketName ?? 'unknown' });

        const response = await fetch(fetchUrl, {
          headers: getCloudflareHeaders(env)
        });

        logInfo(`R2 response status: ${response.status}`, { module: 'worker', operation: 'download_check', bucketName: bucketName ?? 'unknown' });

        if (!response.ok) {
          const errorText = await response.text();
          void logError(env, new Error(`R2 error: ${errorText}`), { module: 'worker', operation: 'download_check', bucketName: bucketName ?? 'unknown' }, isLocalDev);
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
        void logError(env, err instanceof Error ? err : new Error(String(err)), { module: 'worker', operation: 'download_check' }, isLocalDev);
        return new Response(JSON.stringify({
          error: 'Download failed',
          support: SUPPORT_EMAIL
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    } else {
      void logError(env, new Error('Invalid signature'), { module: 'worker', operation: 'download_check', metadata: { path: url.pathname } }, isLocalDev);
      return new Response(JSON.stringify({
        error: 'Invalid signature',
        support: SUPPORT_EMAIL
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }



  // Skip auth for localhost development
  let userEmail: string | null = null;
  if (isLocalhost) {
    logInfo('Localhost detected, skipping JWT validation', { module: 'worker', operation: 'auth' });
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
        logWarning('Request blocked by rate limit', {
          module: 'worker',
          operation: 'rate_limit',
          metadata: { userEmail, method: request.method, pathname: url.pathname, tier: rateLimitResult.tier }
        });

        return createRateLimitResponse(rateLimitResult, corsHeaders);
      }
    } catch (error) {
      // Log error but don't block request if rate limiting fails
      void logError(env, error instanceof Error ? error : new Error(String(error)), {
        module: 'worker',
        operation: 'rate_limit',
        metadata: { error: String(error) }
      }, isLocalDev);
    }
  }



  // Route API requests
  if (url.pathname.startsWith('/api/metrics')) {
    const metricsResponse = await handleMetricsRoutes(request, env, url, corsHeaders, isLocalDev);
    if (metricsResponse) {
      return metricsResponse;
    }
  }

  if (url.pathname === '/api/health') {
    const healthResponse = await handleHealthRoutes(request, env, url, corsHeaders, isLocalDev, userEmail);
    if (healthResponse) {
      return healthResponse;
    }
  }

  if (url.pathname.startsWith('/api/s3-import')) {
    return await handleS3ImportRoutes(request, env, url, corsHeaders, isLocalDev);
  }

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

  // Handle tag routes FIRST (both /api/tags and /api/buckets/:name/tags)
  // Must be before bucket routes so /api/buckets/:name/tags is handled correctly
  if (url.pathname.startsWith('/api/tags') || (url.pathname.startsWith('/api/buckets/') && url.pathname.includes('/tags'))) {
    const tagResponse = await handleTagRoutes(request, env, url, corsHeaders, isLocalDev, userEmail);
    if (tagResponse) {
      return tagResponse;
    }
  }

  // Handle color routes BEFORE bucket routes (for /api/buckets/:name/color)
  if (url.pathname === '/api/buckets/colors' || (url.pathname.startsWith('/api/buckets/') && url.pathname.endsWith('/color'))) {
    const colorResponse = await handleColorRoutes(request, env, url, corsHeaders, isLocalDev, userEmail);
    if (colorResponse) {
      return colorResponse;
    }
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

  if (url.pathname.startsWith('/api/webhooks')) {
    const webhookResponse = await handleWebhookRoutes(request, env, url, corsHeaders, isLocalDev, userEmail);
    if (webhookResponse) {
      return webhookResponse;
    }
  }

  // Handle migration routes
  if (url.pathname.startsWith('/api/migrations')) {
    const migrationResponse = await handleMigrationRoutes(request, env, url, corsHeaders, isLocalDev, userEmail);
    if (migrationResponse) {
      return migrationResponse;
    }
  }



  // Serve frontend assets
  return await serveFrontendAssets(request, env, isLocalhost);
}

export default {

  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    try {
      return await handleApiRequest(request, env);
    } catch (e) {
      void logError(env, e instanceof Error ? e : new Error(String(e)), { module: 'worker', operation: 'fetch' }, false);
      return new Response('Internal Server Error: ' + (e as Error).message + ' | Support: ' + SUPPORT_EMAIL, {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
}
