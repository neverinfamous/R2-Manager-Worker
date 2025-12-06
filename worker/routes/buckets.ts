import type { Env, CloudflareApiResponse, BucketsListResult, R2ObjectInfo } from '../types';
import { CF_API } from '../types';
import { type CorsHeaders } from '../utils/cors';
import { getBucketSize } from '../utils/helpers';
import { logAuditEvent } from './audit';

export async function handleBucketRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string
): Promise<Response> {
  const db = env.METADATA;
   
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
      
      // Mock response for local development
      if (isLocalDev) {
        console.log('[Buckets] Using mock data for local development');
        return new Response(JSON.stringify({
          result: { 
            buckets: [
              {
                name: 'dev-bucket',
                creation_date: new Date().toISOString(),
                size: 0
              }
            ]
          }
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      
      const response = await fetch(
        CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets',
        { headers: cfHeaders }
      );
      const data = await response.json() as CloudflareApiResponse<BucketsListResult>;
      
      // With Zero Trust auth, show all R2 buckets to authenticated users
      // Exclude system/internal buckets
      const systemBuckets = ['r2-bucket', 'sqlite-mcp-server-wiki', 'blog-wiki', 'kv-manager-backups', 'do-manager-backups', 'd1-manager-backups'];
      const buckets = data.result?.buckets ?? [];
      const filteredBuckets = buckets.filter((b) =>
        !systemBuckets.includes(b.name)
      );
      
      // Add size information to each bucket
      const bucketsWithSize = await Promise.all(
        filteredBuckets.map(async (bucket) => {
          const size = await getBucketSize(bucket.name, env);
          return {
            ...bucket,
            size
          };
        })
      );
      
      return new Response(JSON.stringify({
        result: { buckets: bucketsWithSize }
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Create bucket
    if (request.method === 'POST' && url.pathname === '/api/buckets') {
      const body = await request.json() as { name: string };
      console.log('[Buckets] Creating bucket:', body.name);
      
      // Mock response for local development
      if (isLocalDev) {
        console.log('[Buckets] Simulating bucket creation for local development');
        return new Response(JSON.stringify({
          result: {
            name: body.name,
            creation_date: new Date().toISOString()
          }
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      
      const response = await fetch(
        CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets',
        {
          method: 'POST',
          headers: cfHeaders,
          body: JSON.stringify({ name: body.name })
        }
      );
      const data = await response.json() as CloudflareApiResponse;
      
      // Log audit event for bucket creation
      if (db) {
        await logAuditEvent(db, {
          operationType: 'bucket_create',
          bucketName: body.name,
          userEmail,
          status: data.success ? 'success' : 'failed',
          metadata: data.success ? undefined : { error: data.errors?.[0]?.message }
        });
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
      
      // Zero Trust: Owner check removed - all authenticated users can manage all buckets
      
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
            if (cursor !== undefined) {
              listUrl.searchParams.set('cursor', cursor);
            }
            listUrl.searchParams.set('per_page', '100');
            
            console.log('[Buckets] Listing objects with cursor:', cursor ?? 'none');
            const listResponse = await fetch(listUrl.toString(), {
              headers: cfHeaders
            });
            
            if (!listResponse.ok) {
              throw new Error('Failed to list objects: ' + String(listResponse.status));
            }
            
            const listData = await listResponse.json() as CloudflareApiResponse<R2ObjectInfo[]>;
            const objects: R2ObjectInfo[] = Array.isArray(listData.result) ? listData.result : [];
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
            cursor = listData.result_info?.cursor as string | undefined;
            
            // Add small delay between batches to avoid rate limiting
            if (objects.length > 0 && cursor !== undefined) {
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
          const data = response.status === 204 ? { success: true } : await response.json() as { success?: boolean };
          console.log('[Buckets] Delete successful, data:', data);
          
          if (data.success === true || response.status === 204) {
            // Log audit event for bucket deletion success
            if (db) {
              await logAuditEvent(db, {
                operationType: 'bucket_delete',
                bucketName,
                userEmail,
                status: 'success',
                metadata: { force }
              });
            }
            
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
          
          // Log audit event for successful deletion (parsing error doesn't mean delete failed)
          if (db) {
            await logAuditEvent(db, {
              operationType: 'bucket_delete',
              bucketName,
              userEmail,
              status: 'success',
              metadata: { force }
            });
          }
          
          // If we can't parse the response but the HTTP status is OK, consider it a success
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
      
      // Log audit event for bucket deletion failure
      if (db) {
        await logAuditEvent(db, {
          operationType: 'bucket_delete',
          bucketName,
          userEmail,
          status: 'failed',
          metadata: { error: 'Delete failed', statusCode: response.status, force }
        });
      }
      
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
      const body = await request.json() as { newName?: string };
      const newBucketName = body.newName?.trim();
      console.log('[Buckets] Rename request:', oldBucketName, '->', newBucketName);
      
      // Mock response for local development
      if (isLocalDev) {
        console.log('[Buckets] Simulating bucket rename for local development');
        return new Response(JSON.stringify({ 
          success: true, 
          newName: newBucketName 
        }), { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json', 
            ...corsHeaders 
          } 
        });
      }
      
      // Zero Trust: All authenticated users can manage all buckets
      try {
        console.log('[Buckets] Creating new bucket:', newBucketName);
        const createResponse = await fetch(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets', { method: 'POST', headers: cfHeaders, body: JSON.stringify({ name: newBucketName }) });
        if (!createResponse.ok) {
          const createError = await createResponse.json() as CloudflareApiResponse;
          return new Response(JSON.stringify({ error: createError.errors?.[0]?.message ?? 'Failed to create new bucket' }), { status: createResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        console.log('[Buckets] New bucket created, copying objects...');
        let cursor: string | undefined;
        let totalCopied = 0;
        let totalFailed = 0;
        let hasMoreObjects = true;
        while (hasMoreObjects) {
          const listUrl = new URL(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + oldBucketName + '/objects');
          if (cursor !== undefined) listUrl.searchParams.set('cursor', cursor);
          listUrl.searchParams.set('per_page', '100');
          const listResponse = await fetch(listUrl.toString(), { headers: cfHeaders });
          if (!listResponse.ok) throw new Error('Failed to list objects: ' + String(listResponse.status));
          const listData = await listResponse.json() as CloudflareApiResponse<R2ObjectInfo[]>;
          const objects: R2ObjectInfo[] = Array.isArray(listData.result) ? listData.result : [];
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
          cursor = listData.result_info?.cursor as string | undefined;
          if (objects.length > 0 && cursor !== undefined) await new Promise(resolve => setTimeout(resolve, 500));
          else hasMoreObjects = false;
        }
        console.log('[Buckets] Copied', totalCopied, 'objects, failed:', totalFailed);
        console.log('[Buckets] Deleting old bucket');
        let deleteCursor: string | undefined;
        let deleteHasMore = true;
        while (deleteHasMore) {
          const listUrl = new URL(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + oldBucketName + '/objects');
          if (deleteCursor !== undefined) listUrl.searchParams.set('cursor', deleteCursor);
          listUrl.searchParams.set('per_page', '100');
          const listResponse = await fetch(listUrl.toString(), { headers: cfHeaders });
          if (!listResponse.ok) throw new Error('Failed to list objects for deletion');
          const listData2 = await listResponse.json() as CloudflareApiResponse<R2ObjectInfo[]>;
          const deleteObjects: R2ObjectInfo[] = Array.isArray(listData2.result) ? listData2.result : [];
          if (deleteObjects.length === 0) deleteHasMore = false;
          for (const obj of deleteObjects) {
            try {
              const deleteUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + oldBucketName + '/objects/' + encodeURIComponent(obj.key);
              await fetch(deleteUrl, { method: 'DELETE', headers: cfHeaders });
            } catch {
              // Silently continue on delete failure
            }
          }
          deleteCursor = listData2.result_info?.cursor as string | undefined;
          if (deleteObjects.length > 0 && deleteCursor !== undefined) await new Promise(resolve => setTimeout(resolve, 300));
          else deleteHasMore = false;
        }
        const deleteResponse = await fetch(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + oldBucketName, { method: 'DELETE', headers: cfHeaders });
        if (!deleteResponse.ok) throw new Error('Failed to delete old bucket');
        console.log('[Buckets] Rename completed');
        
        // Log audit event for bucket rename success
        if (db) {
          await logAuditEvent(db, {
            operationType: 'bucket_rename',
            bucketName: oldBucketName,
            userEmail,
            status: 'success',
            destinationBucket: newBucketName,
            metadata: { objectsCopied: totalCopied, objectsFailed: totalFailed }
          });
        }
        
        return new Response(JSON.stringify({ success: true, newName: newBucketName }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (err) {
        console.error('[Buckets] Rename error:', err);
        
        // Log audit event for bucket rename failure
        if (db) {
          await logAuditEvent(db, {
            operationType: 'bucket_rename',
            bucketName: oldBucketName,
            userEmail,
            status: 'failed',
            destinationBucket: newBucketName,
            metadata: { error: String(err) }
          });
        }
        
        return new Response(JSON.stringify({ error: 'Rename failed' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
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

  return new Response('Not Found', { status: 404, headers: corsHeaders });
}
