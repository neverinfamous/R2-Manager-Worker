import JSZip from 'jszip';

// Cloudflare Workers types
declare global {
  interface R2Bucket {
    put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null, options?: R2PutOptions): Promise<R2Object>;
    get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>;
    delete(keys: string | string[]): Promise<void>;
    list(options?: R2ListOptions): Promise<R2Objects>;
  }

  interface R2Object {
    key: string;
    version: string;
    size: number;
    etag: string;
    httpEtag: string;
    checksums: R2Checksums;
    uploaded: Date;
    httpMetadata?: R2HTTPMetadata;
    customMetadata?: Record<string, string>;
  }

  interface R2ObjectBody extends R2Object {
    body: ReadableStream;
    bodyUsed: boolean;
    arrayBuffer(): Promise<ArrayBuffer>;
    text(): Promise<string>;
    json<T = unknown>(): Promise<T>;
    blob(): Promise<Blob>;
  }

  interface R2PutOptions {
    httpMetadata?: R2HTTPMetadata;
    customMetadata?: Record<string, string>;
  }

  interface R2GetOptions {
    onlyIf?: R2Conditional;
    range?: R2Range;
  }

  interface R2ListOptions {
    limit?: number;
    prefix?: string;
    cursor?: string;
    delimiter?: string;
    include?: ('httpMetadata' | 'customMetadata')[];
  }

  interface R2Objects {
    objects: R2Object[];
    truncated: boolean;
    cursor?: string;
    delimitedPrefixes: string[];
  }

  interface R2HTTPMetadata {
    contentType?: string;
    contentLanguage?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    cacheControl?: string;
    cacheExpiry?: Date;
  }

  interface R2Checksums {
    md5?: ArrayBuffer;
    sha1?: ArrayBuffer;
    sha256?: ArrayBuffer;
    sha384?: ArrayBuffer;
    sha512?: ArrayBuffer;
  }

  interface R2Conditional {
    etagMatches?: string;
    etagDoesNotMatch?: string;
    uploadedBefore?: Date;
    uploadedAfter?: Date;
  }

  interface R2Range {
    offset?: number;
    length?: number;
    suffix?: number;
  }

  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    dump(): Promise<ArrayBuffer>;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
    exec(query: string): Promise<D1ExecResult>;
  }

  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(colName?: string): Promise<T | null>;
    run<T = unknown>(): Promise<D1Result<T>>;
    all<T = unknown>(): Promise<D1Result<T>>;
    raw<T = unknown>(): Promise<T[]>;
  }

  interface D1Result<T = unknown> {
    results: T[];
    success: boolean;
    meta: Record<string, unknown>;
  }

  interface D1ExecResult {
    count: number;
    duration: number;
  }

  interface Fetcher {
    fetch(request: Request | string): Promise<Response>;
  }

  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }
}

export interface Env {
  R2: R2Bucket
  ASSETS: Fetcher
  DB: D1Database
  CF_EMAIL: string
  API_KEY: string
  ACCOUNT_ID: string
  REGISTRATION_CODE: string
  URL_SIGNING_KEY: string
}

const CF_API = 'https://api.cloudflare.com/client/v4';

// Auth helper functions
async function generateToken(): Promise<string> {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function validateAuth(request: Request, env: Env): Promise<string | null> {
  // Try to get token from cookie first (primary method)
  let token: string | null = null;
  
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/auth_token=([^;]*)/);
    token = match ? match[1] : null;
  }
  
  // Fall back to Authorization header (for backward compatibility during migration)
  if (!token) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    token = authHeader.slice(7);
  }
  
  if (!token) return null;
  
  const user = await env.DB
    .prepare('SELECT user_id FROM sessions WHERE token = ? AND expires > ?')
    .bind(token, new Date().toISOString())
    .first<{ user_id: string }>();
  
  return user?.user_id || null;
}

// URL signing functions
function generateSignature(path: string, env: Env): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(path + env.URL_SIGNING_KEY);
  const hashArray = new Uint8Array(data);
  const reducedHash = Array.from(hashArray).reduce((a, b) => a ^ b, 0);
  return reducedHash.toString(16).padStart(2, '0');
}

function validateSignature(request: Request, env: Env): boolean {
  const url = new URL(request.url);
  const signature = url.searchParams.get('sig');
  if (!signature) return false;

  // Decode the path before generating signature
  const decodedPath = decodeURIComponent(url.pathname);
  const searchParams = new URLSearchParams(url.search);
  searchParams.delete('sig');
  const queryString = searchParams.toString();
  const pathWithQuery = queryString ? decodedPath + '?' + queryString : decodedPath;
  
  const expectedSignature = generateSignature(pathWithQuery, env);
  
  return signature === expectedSignature;
}

async function handleAuthRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  
  if (url.pathname === '/api/auth/register') {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    
    const { email, password, code } = await request.json();
    
    if (code !== env.REGISTRATION_CODE) {
      return new Response(JSON.stringify({ error: 'Invalid registration code' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const existing = await env.DB
      .prepare('SELECT email FROM users WHERE email = ?')
      .bind(email)
      .first();
    
    if (existing) {
      return new Response(JSON.stringify({ error: 'Email already registered' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(password + salt.toString())
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const userId = crypto.randomUUID();
    await env.DB
      .prepare('INSERT INTO users (user_id, email, password_hash, salt) VALUES (?, ?, ?, ?)')
      .bind(userId, email, hashHex, salt.toString())
      .run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (url.pathname === '/api/auth/login') {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    
    const { email, password } = await request.json();
    
    const user = await env.DB
      .prepare('SELECT user_id, password_hash, salt FROM users WHERE email = ?')
      .bind(email)
      .first<{ user_id: string, password_hash: string, salt: string }>();
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(password + user.salt)
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    if (hashHex !== user.password_hash) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const token = await generateToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await env.DB
      .prepare('INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)')
      .bind(token, user.user_id, expires.toISOString())
      .run();
    
    // Return success but DON'T include token in response (it's in the cookie)
    const response = new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
    // Set HTTP-only cookie with security flags
    const isProduction = !request.url.includes('localhost');
    const cookieFlags = [
      `auth_token=${token}`,
      'HttpOnly', // Prevents JavaScript access
      'Path=/', // Available to entire app
      'SameSite=Strict', // CSRF protection
      `Max-Age=${24 * 60 * 60}` // 24 hours
    ];
    
    if (isProduction) {
      cookieFlags.push('Secure'); // HTTPS only in production
    }
    
    response.headers.set('Set-Cookie', cookieFlags.join('; '));
    return response;
  }
  
  if (url.pathname === '/api/auth/logout') {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    
    // Try to get token from cookie first, fall back to Authorization header
    const cookieHeader = request.headers.get('Cookie');
    let token: string | null = null;
    
    if (cookieHeader) {
      const match = cookieHeader.match(/auth_token=([^;]*)/);
      token = match ? match[1] : null;
    }
    
    if (!token) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401 });
      }
      token = authHeader.slice(7);
    }
    
    await env.DB
      .prepare('DELETE FROM sessions WHERE token = ?')
      .bind(token)
      .run();
    
    // Clear the cookie by setting Max-Age=0
    const response = new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    response.headers.set('Set-Cookie', 'auth_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict');
    return response;
  }

  return new Response('Not found', { status: 404 });
}

async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  console.log('[Request]', request.method, url.pathname);
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-File-Name, X-Chunk-Index, X-Total-Chunks'
  };

  if (request.method === 'OPTIONS') {
    console.log('[CORS] Handling preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  // Handle auth endpoints
  if (url.pathname.startsWith('/api/auth/')) {
    const response = await handleAuthRequest(request, env);
    return new Response(response.body, {
      status: response.status,
      headers: { ...response.headers, ...corsHeaders }
    });
  }

  // Check for signed file downloads
  if (url.pathname.includes('/download/')) {
    if (validateSignature(request, env)) {
      const pathParts = url.pathname.split('/');
      const bucketName = pathParts[3];
      const fileName = decodeURIComponent(pathParts[5]);

      try {
        const response = await fetch(
          CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + fileName,
          {
            headers: {
              'X-Auth-Email': env.CF_EMAIL,
              'X-Auth-Key': env.API_KEY
            }
          }
        );

        if (!response.ok) {
          throw new Error('Download failed: ' + response.status);
        }

        return new Response(response.body, {
          headers: {
            'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
            'Content-Disposition': 'attachment; filename="' + fileName + '"',
            'Cache-Control': 'no-store, max-age=0, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            ...corsHeaders
          }
        });
  
    } catch (err) {
        console.error('[Files] Download error:', err);
        return new Response('Download failed', { 
          status: 500,
          headers: corsHeaders
        });
      }
    }
  }

  // Require auth for all other API endpoints
  const userId = await validateAuth(request, env);
  if (!userId && !url.pathname.startsWith('/api/auth/')) {
    return new Response('Unauthorized', { 
      status: 401,
      headers: corsHeaders
    });
  }

  // Bucket Management Routes
  if (url.pathname.startsWith('/api/buckets')) {
    console.log('[Buckets] Handling bucket operation');
    const cfHeaders = {
      'X-Auth-Email': env.CF_EMAIL,
      'X-Auth-Key': env.API_KEY,
      'Content-Type': 'application/json'
    };

    try {
      // List buckets
      if (request.method === 'GET' && url.pathname === '/api/buckets') {
        console.log('[Buckets] Listing buckets');
        const response = await fetch(
          CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets',
          { headers: cfHeaders }
        );
        const data = await response.json();
        
        const userBuckets = await env.DB
          .prepare('SELECT bucket_name FROM bucket_owners WHERE user_id = ?')
          .bind(userId)
          .all<{ bucket_name: string }>();
        
        const filteredBuckets = data.result.buckets.filter((bucket: { name: string }) =>
          userBuckets.results.some(ub => ub.bucket_name === bucket.name)
        );
        
        return new Response(JSON.stringify({
          result: { buckets: filteredBuckets }
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Create bucket
      if (request.method === 'POST' && url.pathname === '/api/buckets') {
        const body = await request.json();
        console.log('[Buckets] Creating bucket:', body.name);
        const response = await fetch(
          CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets',
          {
            method: 'POST',
            headers: cfHeaders,
            body: JSON.stringify({ name: body.name })
          }
        );
        const data = await response.json();
        
        if (data.success) {
          await env.DB
            .prepare('INSERT INTO bucket_owners (bucket_name, user_id) VALUES (?, ?)')
            .bind(body.name, userId)
            .run();
        }
        
        return new Response(JSON.stringify(data), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Delete bucket
      if (request.method === 'DELETE' && url.pathname.startsWith('/api/buckets/')) {
        const bucketName = decodeURIComponent(url.pathname.slice(12)).replace(/^\/+/, '');
        const force = url.searchParams.get('force') === 'true';
        console.log('[Buckets] Deleting bucket:', bucketName, 'force:', force);
        
        const owner = await env.DB
          .prepare('SELECT user_id FROM bucket_owners WHERE bucket_name = ? AND user_id = ?')
          .bind(bucketName, userId)
          .first();

        if (!owner) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        // If force delete, first delete all objects in the bucket
        if (force) {
          console.log('[Buckets] Force delete enabled - deleting all objects first');
          try {
            let cursor: string | undefined;
            let totalDeleted = 0;
            let totalAttempted = 0;
            let hasMoreObjects = true;
            
            while (hasMoreObjects) {
              const listUrl = new URL(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects');
              if (cursor) {
                listUrl.searchParams.set('cursor', cursor);
              }
              listUrl.searchParams.set('per_page', '100');
              
              console.log('[Buckets] Listing objects with cursor:', cursor || 'none');
              const listResponse = await fetch(listUrl.toString(), {
                headers: cfHeaders
              });
              
              if (!listResponse.ok) {
                throw new Error('Failed to list objects: ' + listResponse.status);
              }
              
              const listData = await listResponse.json();
              const objects = Array.isArray(listData.result) ? listData.result : [];
              console.log('[Buckets] Found', objects.length, 'objects to delete');
              
              if (objects.length === 0) {
                hasMoreObjects = false;
              }
              
              // Delete each object
              for (const obj of objects) {
                try {
                  totalAttempted++;
                  const deleteUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(obj.key);
                  console.log('[Buckets] Deleting object:', obj.key);
                  const deleteResponse = await fetch(deleteUrl, {
                    method: 'DELETE',
                    headers: cfHeaders
                  });
                  
                  console.log('[Buckets] Delete response for', obj.key, ':', deleteResponse.status);
                  
                  if (deleteResponse.ok) {
                    totalDeleted++;
                  } else {
                    console.warn('[Buckets] Failed to delete object:', obj.key, 'status:', deleteResponse.status);
                  }
                } catch (objErr) {
                  console.error('[Buckets] Failed to delete object:', obj.key, objErr);
                }
              }
              
              // Get cursor for next page
              cursor = listData.cursor;
              
              // Add small delay between batches to avoid rate limiting
              if (objects.length > 0 && cursor) {
                console.log('[Buckets] Waiting before next batch...');
                await new Promise(resolve => setTimeout(resolve, 500));
              } else {
                hasMoreObjects = false;
              }
            }
            
            console.log('[Buckets] Object deletion complete - deleted', totalDeleted, 'of', totalAttempted, 'attempted');
          } catch (deleteErr) {
            console.error('[Buckets] Error deleting objects:', deleteErr);
            return new Response(JSON.stringify({ 
              error: 'Failed to delete objects from bucket',
              details: deleteErr instanceof Error ? deleteErr.message : 'Unknown error'
            }), {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            });
          }
        }
        
        const response = await fetch(
          CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName,
          {
            method: 'DELETE',
            headers: cfHeaders
          }
        );
        
        console.log('[Buckets] Delete response status:', response.status);
        
        // Cloudflare R2 API returns 204 No Content on successful deletion, or 200 with { "success": true }
        if (response.ok && (response.status === 204 || response.status === 200)) {
          try {
            const data = response.status === 204 ? { success: true } : await response.json();
            console.log('[Buckets] Delete successful, data:', data);
            
            if (data.success || response.status === 204) {
              await env.DB
                .prepare('DELETE FROM bucket_owners WHERE bucket_name = ?')
                .bind(bucketName)
                .run();
              
              // Return success response
              return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: {
                  'Content-Type': 'application/json',
                  ...corsHeaders
                }
              });
            }
          } catch (parseErr) {
            console.error('[Buckets] Error parsing delete response:', parseErr);
            // If we can't parse the response but the HTTP status is OK, consider it a success
            await env.DB
              .prepare('DELETE FROM bucket_owners WHERE bucket_name = ?')
              .bind(bucketName)
              .run();
            
            return new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            });
          }
        }
        
        // If we get here, something went wrong - try to parse the error response
        let errorData: unknown;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: 'Unknown error', status: response.status };
        }
        
        console.log('[Buckets] Delete failed with status:', response.status, 'error:', errorData);
        return new Response(JSON.stringify(errorData), {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Rename bucket (create new, copy objects, delete old)
      if (request.method === 'PATCH' && url.pathname.startsWith('/api/buckets/')) {
        const oldBucketName = decodeURIComponent(url.pathname.slice(12)).replace(/^\/+/, '');
        const body = await request.json();
        const newBucketName = body.newName?.trim();
        console.log('[Buckets] Rename request:', oldBucketName, '->', newBucketName);
        const owner = await env.DB.prepare('SELECT user_id FROM bucket_owners WHERE bucket_name = ? AND user_id = ?').bind(oldBucketName, userId).first();
        if (!owner) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        try {
          console.log('[Buckets] Creating new bucket:', newBucketName);
          const createResponse = await fetch(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets', { method: 'POST', headers: cfHeaders, body: JSON.stringify({ name: newBucketName }) });
          if (!createResponse.ok) {
            const createError = await createResponse.json();
            return new Response(JSON.stringify({ error: createError.errors?.[0]?.message || 'Failed to create new bucket' }), { status: createResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
          }
          console.log('[Buckets] New bucket created, copying objects...');
          let cursor: string | undefined;
          let totalCopied = 0;
          let totalFailed = 0;
          let hasMoreObjects = true;
          while (hasMoreObjects) {
            const listUrl = new URL(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + oldBucketName + '/objects');
            if (cursor) listUrl.searchParams.set('cursor', cursor);
            listUrl.searchParams.set('per_page', '100');
            const listResponse = await fetch(listUrl.toString(), { headers: cfHeaders });
            if (!listResponse.ok) throw new Error('Failed to list objects: ' + listResponse.status);
            const listData = await listResponse.json();
            const objects = Array.isArray(listData.result) ? listData.result : [];
            console.log('[Buckets] Copying', objects.length, 'objects');
            if (objects.length === 0) hasMoreObjects = false;
            for (const obj of objects) {
              try {
                const copyUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + newBucketName + '/objects/' + encodeURIComponent(obj.key);
                const copySource = '/' + oldBucketName + '/' + encodeURIComponent(obj.key);
                const copyResponse = await fetch(copyUrl, { method: 'PUT', headers: { ...cfHeaders, 'x-amz-copy-source': copySource } });
                if (copyResponse.ok) totalCopied++;
                else totalFailed++;
              } catch {
                totalFailed++;
              }
            }
            cursor = listData.cursor;
            if (objects.length > 0 && cursor) await new Promise(resolve => setTimeout(resolve, 500));
            else hasMoreObjects = false;
          }
          console.log('[Buckets] Copied', totalCopied, 'objects, failed:', totalFailed);
          console.log('[Buckets] Deleting old bucket');
          let deleteCursor: string | undefined;
          let deleteHasMore = true;
          while (deleteHasMore) {
            const listUrl = new URL(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + oldBucketName + '/objects');
            if (deleteCursor) listUrl.searchParams.set('cursor', deleteCursor);
            listUrl.searchParams.set('per_page', '100');
            const listResponse = await fetch(listUrl.toString(), { headers: cfHeaders });
            if (!listResponse.ok) throw new Error('Failed to list objects for deletion');
            const listData = await listResponse.json();
            const objects = Array.isArray(listData.result) ? listData.result : [];
            if (objects.length === 0) deleteHasMore = false;
            for (const obj of objects) {
              try {
                const deleteUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + oldBucketName + '/objects/' + encodeURIComponent(obj.key);
                await fetch(deleteUrl, { method: 'DELETE', headers: cfHeaders });
              } catch {
                // Silently continue on delete failure
              }
            }
            deleteCursor = listData.cursor;
            if (objects.length > 0 && deleteCursor) await new Promise(resolve => setTimeout(resolve, 300));
            else deleteHasMore = false;
          }
          const deleteResponse = await fetch(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + oldBucketName, { method: 'DELETE', headers: cfHeaders });
          if (!deleteResponse.ok) throw new Error('Failed to delete old bucket');
          await env.DB.prepare('UPDATE bucket_owners SET bucket_name = ? WHERE bucket_name = ?').bind(newBucketName, oldBucketName).run();
          console.log('[Buckets] Rename completed');
          return new Response(JSON.stringify({ success: true, newName: newBucketName }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        } catch (err) {
          console.error('[Buckets] Rename error:', err);
          return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Rename failed' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
      }
    } catch (err) {
      console.error('[Buckets] Operation error:', err);
      return new Response(JSON.stringify({ error: 'Bucket operation failed' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }

  // File Operations Routes
  if (url.pathname.startsWith('/api/files/')) {
    console.log('[Files] Handling file operation');
    const parts = url.pathname.split('/');
    const bucketName = parts[3];
    
    // Verify bucket ownership
    const owner = await env.DB
      .prepare('SELECT user_id FROM bucket_owners WHERE bucket_name = ? AND user_id = ?')
      .bind(bucketName, userId)
      .first();
    
    if (!owner) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const cfHeaders = {
      'X-Auth-Email': env.CF_EMAIL,
      'X-Auth-Key': env.API_KEY
    };

    // Handle ZIP download
    if (request.method === 'POST' && parts[4] === 'download-zip') {
      try {
        console.log('[Files] Processing ZIP download request');
        const { files } = await request.json();
        
        const zip = new JSZip();
        
        for (const fileName of files) {
          console.log('[Files] Fetching:', fileName);
          const response = await fetch(
            CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + fileName,
            { headers: cfHeaders }
          );
          
          if (!response.ok) {
            throw new Error('Failed to fetch file: ' + fileName);
          }
          
          const buffer = await response.arrayBuffer();
          zip.file(fileName, buffer);
        }
        
        console.log('[Files] Creating ZIP');
        const zipContent = await zip.generateAsync({type: "uint8array"});
        
        return new Response(zipContent.buffer as ArrayBuffer, {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="' + bucketName + '-files.zip"',
            ...corsHeaders
          }
        });
  
      // Rename bucket
      if (request.method === 'PATCH' && url.pathname.startsWith('/api/buckets/')) {
        const bucketName = decodeURIComponent(url.pathname.slice(12)).replace(/^\/+/, '');
        const body = await request.json();
        const newName = body.newName;
        console.log('[Buckets] Rename request:', bucketName, '->', newName);
        const owner = await env.DB.prepare('SELECT user_id FROM bucket_owners WHERE bucket_name = ? AND user_id = ?').bind(bucketName, userId).first();
        if (!owner) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        return new Response(JSON.stringify({ error: 'Bucket renaming is not supported by Cloudflare R2 API' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    } catch (err) {
        console.error('[Files] ZIP download error:', err);
        return new Response(JSON.stringify({ 
          error: 'Failed to create zip file', 
          details: err.message 
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }

    // List files with pagination
    if (request.method === 'GET' && parts.length === 4) {
      try {
        console.log('[Files] Listing files in bucket:', bucketName);
        const cursor = url.searchParams.get('cursor');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const skipCache = url.searchParams.get('skipCache') === 'true';
        
        let apiUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects'
          + '?include=customMetadata,httpMetadata'
          + '&limit=' + limit
          + '&delimiter=/'
          + '&order=desc'
          + '&sort_by=last_modified';
        
        if (cursor) {
          apiUrl += '&cursor=' + cursor;
        }

        // Add cache-busting parameter if requested
        if (skipCache) {
          apiUrl += '&_t=' + Date.now();
        }
        
        console.log('[Files] List request URL:', apiUrl);
        const response = await fetch(apiUrl, { 
          headers: {
            ...cfHeaders,
            'Cache-Control': skipCache ? 'no-cache' : 'max-age=60'
          }
        });
		console.log('[Files] Full API response:', {
			status: response.status,
			data: await response.clone().json()
		});
        if (!response.ok) {
          throw new Error('Failed to list files: ' + response.status);
        }

        const data = await response.json();
        console.log('[Files] List response:', {
          url: apiUrl,
          objects: data.result?.objects?.slice(0, 3),
          total: data.result?.objects?.length || 0,
          pagination: data.result_info,
          sorting: 'desc by last_modified'
        });

        // Filter out assets folder and process objects
        interface R2ObjectInfo {
          key: string;
          size?: number;
          last_modified?: string;
        }
        
        const fileList = Array.isArray(data.result) ? data.result : (data.result?.objects || []);
        const objects = fileList
          .filter((obj: R2ObjectInfo) => !obj.key.startsWith('assets/'))
          .map((obj: R2ObjectInfo) => {
            const downloadPath = '/api/files/' + bucketName + '/download/' + obj.key;
            const version = obj.last_modified ? new Date(obj.last_modified).getTime() : Date.now();
            const versionedPath = downloadPath + '?ts=' + version;
            const signature = generateSignature(versionedPath, env);
            const signedUrl = versionedPath + '&sig=' + signature;

            return {
              key: obj.key,
              size: obj.size || 0,
              uploaded: obj.last_modified || new Date().toISOString(),
              url: signedUrl
            };
          });

        // Sort objects by upload date
        objects.sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime());

        return new Response(JSON.stringify({
          objects,
          pagination: {
            cursor: data.result_info?.cursor,
            hasMore: data.result_info?.is_truncated || false
          }
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': skipCache ? 'no-cache' : 'public, max-age=60',
            ...corsHeaders
          }
        });

  
      // Rename bucket
      if (request.method === 'PATCH' && url.pathname.startsWith('/api/buckets/')) {
        const bucketName = decodeURIComponent(url.pathname.slice(12)).replace(/^\/+/, '');
        const body = await request.json();
        const newName = body.newName;
        console.log('[Buckets] Rename request:', bucketName, '->', newName);
        const owner = await env.DB.prepare('SELECT user_id FROM bucket_owners WHERE bucket_name = ? AND user_id = ?').bind(bucketName, userId).first();
        if (!owner) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        return new Response(JSON.stringify({ error: 'Bucket renaming is not supported by Cloudflare R2 API' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    } catch (err) {
        console.error('[Files] List error:', err);
        return new Response(JSON.stringify({ 
          error: 'Failed to list files', 
          details: err.message
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }

    // Upload file
    if (request.method === 'POST' && parts[4] === 'upload') {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const fileName = request.headers.get('X-File-Name');
      const chunkIndex = parseInt(request.headers.get('X-Chunk-Index') || '0');
      const totalChunks = parseInt(request.headers.get('X-Total-Chunks') || '1');
      
      if (!fileName) {
        console.log('[Files] Missing filename in upload request');
        return new Response('Missing file name', { 
          status: 400,
          headers: corsHeaders
        });
      }

      try {
        console.log('[Files] Processing upload:',
          'bucket=' + bucketName,
          'file=' + fileName,
          'chunk=' + (chunkIndex + 1) + '/' + totalChunks
        );

        const decodedFileName = decodeURIComponent(fileName);
        const uploadUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + decodedFileName;
        const uploadTimestamp = new Date().toISOString();
        
        // For single chunk uploads
        if (totalChunks === 1) {
          const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 
              ...cfHeaders, 
              'Content-Type': file.type,
              'X-Upload-Created': uploadTimestamp,
              'Cache-Control': 'no-cache'
            },
            body: file
          });

          if (!uploadResponse.ok) {
            throw new Error('Upload failed: ' + uploadResponse.status);
          }

          console.log('[Files] Upload completed:', decodedFileName);
        } else {
          // Handle chunked uploads
          const chunkId = decodedFileName + '-' + chunkIndex;
          console.log('[Files] Uploading chunk:', chunkId);

          const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 
              ...cfHeaders, 
              'Content-Type': file.type,
              'X-Upload-Created': uploadTimestamp,
              'Cache-Control': 'no-cache'
            },
            body: file
          });

          if (!uploadResponse.ok) {
            throw new Error('Chunk upload failed: ' + uploadResponse.status);
          }

          console.log('[Files] Chunk uploaded:', chunkId);
        }

        // Force a cache refresh of the file listing
        await fetch(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects?skipCache=true', {
          headers: {
            ...cfHeaders,
            'Cache-Control': 'no-cache'
          }
        });

        return new Response(JSON.stringify({ 
          success: true,
          timestamp: uploadTimestamp
        }), { 
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            ...corsHeaders
          }
        });
  
      // Rename bucket
      if (request.method === 'PATCH' && url.pathname.startsWith('/api/buckets/')) {
        const bucketName = decodeURIComponent(url.pathname.slice(12)).replace(/^\/+/, '');
        const body = await request.json();
        const newName = body.newName;
        console.log('[Buckets] Rename request:', bucketName, '->', newName);
        const owner = await env.DB.prepare('SELECT user_id FROM bucket_owners WHERE bucket_name = ? AND user_id = ?').bind(bucketName, userId).first();
        if (!owner) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        return new Response(JSON.stringify({ error: 'Bucket renaming is not supported by Cloudflare R2 API' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    } catch (err) {
        console.error('[Files] Upload error:', err);
        return new Response(JSON.stringify({
          error: 'Upload failed',
          details: err.message
        }), { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }

    // Delete file
    if (request.method === 'DELETE' && parts[4] === 'delete') {
      try {
        const key = decodeURIComponent(parts[5]);
        console.log('[Files] Deleting file:', key);
        
        const response = await fetch(
          CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + key,
          {
            method: 'DELETE',
            headers: cfHeaders
          }
        );

        if (!response.ok) {
          throw new Error('Delete failed: ' + response.status);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
  
      // Rename bucket
      if (request.method === 'PATCH' && url.pathname.startsWith('/api/buckets/')) {
        const bucketName = decodeURIComponent(url.pathname.slice(12)).replace(/^\/+/, '');
        const body = await request.json();
        const newName = body.newName;
        console.log('[Buckets] Rename request:', bucketName, '->', newName);
        const owner = await env.DB.prepare('SELECT user_id FROM bucket_owners WHERE bucket_name = ? AND user_id = ?').bind(bucketName, userId).first();
        if (!owner) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        return new Response(JSON.stringify({ error: 'Bucket renaming is not supported by Cloudflare R2 API' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    } catch (err) {
        console.error('[Files] Delete error:', err);
        return new Response(JSON.stringify({
          error: 'Delete failed',
          details: err.message
        }), { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }

    // Move file
    if (request.method === 'POST' && parts[parts.length - 1] === 'move') {
      try {
        const sourceKey = decodeURIComponent(parts.slice(4, -1).join('/'));
        const body = await request.json();
        const destBucket = body.destinationBucket;
        
        if (!destBucket) {
          return new Response(JSON.stringify({ error: 'Missing destination bucket' }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        // Verify destination bucket ownership
        const destOwner = await env.DB
          .prepare('SELECT user_id FROM bucket_owners WHERE bucket_name = ? AND user_id = ?')
          .bind(destBucket, userId)
          .first();

        if (!destOwner) {
          return new Response(JSON.stringify({ error: 'Unauthorized access to destination bucket' }), {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        if (bucketName === destBucket) {
          return new Response(JSON.stringify({ error: 'Source and destination buckets must be different' }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        console.log('[Files] Moving file:', sourceKey, 'from:', bucketName, 'to:', destBucket);

        // 1. Fetch file from source bucket
        const getUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + sourceKey;
        const getResponse = await fetch(getUrl, { headers: cfHeaders });

        if (!getResponse.ok) {
          if (getResponse.status === 404) {
            return new Response(JSON.stringify({ error: 'Source file not found' }), {
              status: 404,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            });
          }
          throw new Error('Failed to fetch file: ' + getResponse.status);
        }

        // 2. Preserve metadata from source
        const contentType = getResponse.headers.get('Content-Type') || 'application/octet-stream';
        const fileBuffer = await getResponse.arrayBuffer();

        // 3. Upload to destination bucket
        const putUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + destBucket + '/objects/' + sourceKey;
        const putResponse = await fetch(putUrl, {
          method: 'PUT',
          headers: {
            ...cfHeaders,
            'Content-Type': contentType
          },
          body: fileBuffer
        });

        if (!putResponse.ok) {
          throw new Error('Failed to upload to destination: ' + putResponse.status);
        }

        // 4. Delete from source bucket
        const deleteUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + sourceKey;
        const deleteResponse = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: cfHeaders
        });

        if (!deleteResponse.ok) {
          console.warn('[Files] Warning: Failed to delete source file after successful copy:', deleteResponse.status);
          // Don't fail the operation if delete fails - the copy was successful
        }

        console.log('[Files] Move completed successfully');

        return new Response(JSON.stringify({ success: true }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });

      } catch (err) {
        console.error('[Files] Move error:', err);
        return new Response(JSON.stringify({
          error: 'Move failed',
          details: err instanceof Error ? err.message : 'Unknown error'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }

    return new Response('Not Found', { 
      status: 404,
      headers: corsHeaders
    });
  }

  // Serve frontend assets
  try {
    console.log('[Assets] Serving frontend asset');
    return await env.ASSETS.fetch(request);
  } catch {
    return new Response('Not Found', { status: 404 });
  }
}

export default {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
