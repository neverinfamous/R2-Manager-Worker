import type { Env, CloudflareApiResponse, BucketsListResult, R2ObjectInfo } from '../types';
import { CF_API } from '../types';
import { type CorsHeaders } from '../utils/cors';
import { getBucketStats, getCloudflareHeaders } from '../utils/helpers';
import { logAuditEvent } from './audit';
import { logError, logInfo, logWarning } from '../utils/error-logger';
import { triggerWebhooks, createBucketRenamePayload } from '../utils/webhooks';

export async function handleBucketRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string
): Promise<Response> {
  const db = env.METADATA;

  logInfo('Handling bucket operation', { module: 'buckets', operation: 'handle' });

  const cfHeaders = getCloudflareHeaders(env);

  try {
    // List buckets
    if (request.method === 'GET' && url.pathname === '/api/buckets') {
      logInfo('Listing buckets', { module: 'buckets', operation: 'list' });

      // Mock response for local development
      if (isLocalDev) {
        logInfo('Using mock data for local development', { module: 'buckets', operation: 'list' });
        return new Response(JSON.stringify({
          result: {
            buckets: [
              {
                name: 'dev-bucket',
                creation_date: new Date().toISOString(),
                size: 0,
                objectCount: 0
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
      const systemBuckets = ['r2-bucket', 'sqlite-mcp-server-wiki', 'blog-wiki', 'kv-manager-backups', 'do-manager-backups', 'd1-manager-backups', 'container-manager-helloworld', 'container-manager-snapshots', 'worker-manager-backups'];
      const buckets = data.result?.buckets ?? [];
      const filteredBuckets = buckets.filter((b) =>
        !systemBuckets.includes(b.name)
      );

      // Add size and object count information to each bucket
      const bucketsWithStats = await Promise.all(
        filteredBuckets.map(async (bucket) => {
          const stats = await getBucketStats(bucket.name, env);
          return {
            ...bucket,
            size: stats.size,
            objectCount: stats.objectCount
          };
        })
      );

      return new Response(JSON.stringify({
        result: { buckets: bucketsWithStats }
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
      logInfo(`Creating bucket: ${body.name}`, { module: 'buckets', operation: 'create', bucketName: body.name });

      // Mock response for local development
      if (isLocalDev) {
        logInfo('Simulating bucket creation for local development', { module: 'buckets', operation: 'create', bucketName: body.name });
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
        await logAuditEvent(env, {
          operationType: 'bucket_create',
          bucketName: body.name,
          userEmail,
          status: data.success ? 'success' : 'failed',
          metadata: data.success ? undefined : { error: data.errors?.[0]?.message }
        }, isLocalDev);
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
      logInfo(`Deleting bucket: ${bucketName}, force: ${String(force)}`, { module: 'buckets', operation: 'delete', bucketName, metadata: { force } });

      // Zero Trust: Owner check removed - all authenticated users can manage all buckets

      // If force delete, first delete all objects in the bucket
      if (force) {
        logInfo('Force delete enabled - deleting all objects first', { module: 'buckets', operation: 'delete', bucketName });
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

            logInfo(`Listing objects with cursor: ${cursor ?? 'none'}`, { module: 'buckets', operation: 'delete', bucketName, metadata: { cursor } });
            const listResponse = await fetch(listUrl.toString(), {
              headers: cfHeaders
            });

            if (!listResponse.ok) {
              throw new Error('Failed to list objects: ' + String(listResponse.status));
            }

            const listData = await listResponse.json() as CloudflareApiResponse<R2ObjectInfo[]>;
            const objects: R2ObjectInfo[] = Array.isArray(listData.result) ? listData.result : [];
            logInfo(`Found ${String(objects.length)} objects to delete`, { module: 'buckets', operation: 'delete', bucketName, metadata: { count: objects.length } });

            if (objects.length === 0) {
              hasMoreObjects = false;
            }

            // Delete each object
            for (const obj of objects) {
              try {
                totalAttempted++;
                const deleteUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(obj.key);
                logInfo(`Deleting object: ${obj.key}`, { module: 'buckets', operation: 'delete', bucketName, fileName: obj.key });
                const deleteResponse = await fetch(deleteUrl, {
                  method: 'DELETE',
                  headers: cfHeaders
                });

                logInfo(`[BKT_DELETE] Delete response for ${obj.key}: ${String(deleteResponse.status)}`, { module: 'buckets', operation: 'delete', bucketName, fileName: obj.key });

                if (deleteResponse.ok) {
                  totalDeleted++;
                } else {
                  logWarning(`Failed to delete object: ${obj.key}, status: ${String(deleteResponse.status)}`, { module: 'buckets', operation: 'delete', bucketName, fileName: obj.key, metadata: { status: deleteResponse.status } });
                }
              } catch (objErr) {
                void logError(env, objErr instanceof Error ? objErr : new Error(String(objErr)), { module: 'buckets', operation: 'delete_object', bucketName, fileName: obj.key }, isLocalDev);
              }
            }

            // Get cursor for next page
            cursor = listData.result_info?.cursor as string | undefined;

            // Add small delay between batches to avoid rate limiting
            if (objects.length > 0 && cursor !== undefined) {
              logInfo('Waiting before next batch...', { module: 'buckets', operation: 'delete', bucketName });
              await new Promise(resolve => setTimeout(resolve, 500));
            } else {
              hasMoreObjects = false;
            }
          }

          logInfo(`Object deletion complete - deleted ${String(totalDeleted)} of ${String(totalAttempted)} attempted`, { module: 'buckets', operation: 'delete', bucketName, metadata: { deleted: totalDeleted, attempted: totalAttempted } });
        } catch (deleteErr) {
          void logError(env, deleteErr instanceof Error ? deleteErr : new Error(String(deleteErr)), { module: 'buckets', operation: 'delete', bucketName }, isLocalDev);
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

      logInfo(`Delete response status: ${String(response.status)}`, { module: 'buckets', operation: 'delete', bucketName, metadata: { status: response.status } });

      // Cloudflare R2 API returns 204 No Content on successful deletion, or 200 with { "success": true }
      if (response.ok && (response.status === 204 || response.status === 200)) {
        try {
          const data = response.status === 204 ? { success: true } : await response.json() as { success?: boolean };
          logInfo(`Delete successful, data: ${JSON.stringify(data)}`, { module: 'buckets', operation: 'delete', bucketName });

          if (data.success === true || response.status === 204) {
            // Log audit event for bucket deletion success
            if (db) {
              await logAuditEvent(env, {
                operationType: 'bucket_delete',
                bucketName,
                userEmail,
                status: 'success',
                metadata: { force }
              }, isLocalDev);
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
          logWarning(`Error parsing delete response: ${String(parseErr)}`, { module: 'buckets', operation: 'delete', bucketName });

          // Log audit event for successful deletion (parsing error doesn't mean delete failed)
          if (db) {
            await logAuditEvent(env, {
              operationType: 'bucket_delete',
              bucketName,
              userEmail,
              status: 'success',
              metadata: { force }
            }, isLocalDev);
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

      logWarning(`Delete failed with status: ${String(response.status)}, error: ${JSON.stringify(errorData)}`, { module: 'buckets', operation: 'delete', bucketName, metadata: { status: response.status, error: errorData } });

      // Log audit event for bucket deletion failure
      // Don't log 409 (Bucket not empty) as a failure, as the UI handles this with a force delete flow
      if (db && response.status !== 409) {
        await logAuditEvent(env, {
          operationType: 'bucket_delete',
          bucketName,
          userEmail,
          status: 'failed',
          metadata: { error: 'Delete failed', statusCode: response.status, force }
        }, isLocalDev);
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
      logInfo(`Rename request: ${oldBucketName} -> ${newBucketName ?? 'undefined'}`, { module: 'buckets', operation: 'rename', bucketName: oldBucketName, metadata: { newName: newBucketName } });

      // Mock response for local development
      if (isLocalDev) {
        logInfo('Simulating bucket rename for local development', { module: 'buckets', operation: 'rename', bucketName: oldBucketName });
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
        logInfo(`Creating new bucket: ${newBucketName ?? 'undefined'}`, { module: 'buckets', operation: 'rename', bucketName: oldBucketName, metadata: { newName: newBucketName } });
        const createResponse = await fetch(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets', { method: 'POST', headers: cfHeaders, body: JSON.stringify({ name: newBucketName }) });
        if (!createResponse.ok) {
          const createError = await createResponse.json() as CloudflareApiResponse;
          return new Response(JSON.stringify({ error: createError.errors?.[0]?.message ?? 'Failed to create new bucket' }), { status: createResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        logInfo('New bucket created, copying objects...', { module: 'buckets', operation: 'rename', bucketName: oldBucketName });
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
          logInfo(`Copying ${String(objects.length)} objects`, { module: 'buckets', operation: 'rename', bucketName: oldBucketName, metadata: { count: objects.length } });
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
        logInfo(`Copied ${String(totalCopied)} objects, failed: ${String(totalFailed)}`, { module: 'buckets', operation: 'rename', bucketName: oldBucketName, metadata: { copied: totalCopied, failed: totalFailed } });
        logInfo('Deleting old bucket', { module: 'buckets', operation: 'rename', bucketName: oldBucketName });
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
        logInfo('Rename completed', { module: 'buckets', operation: 'rename', bucketName: oldBucketName, metadata: { newName: newBucketName } });

        // Log audit event for bucket rename success
        if (db) {
          await logAuditEvent(env, {
            operationType: 'bucket_rename',
            bucketName: oldBucketName,
            userEmail,
            status: 'success',
            destinationBucket: newBucketName,
            metadata: { objectsCopied: totalCopied, objectsFailed: totalFailed }
          }, isLocalDev);
        }

        // Trigger webhook for bucket rename
        void triggerWebhooks(env, 'bucket_rename', createBucketRenamePayload(
          oldBucketName,
          newBucketName ?? '',
          userEmail
        ), isLocalDev);

        return new Response(JSON.stringify({ success: true, newName: newBucketName }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (err) {
        void logError(env, err instanceof Error ? err : new Error(String(err)), { module: 'buckets', operation: 'rename', bucketName: oldBucketName, metadata: { newName: newBucketName } }, isLocalDev);

        // Log audit event for bucket rename failure
        if (db) {
          await logAuditEvent(env, {
            operationType: 'bucket_rename',
            bucketName: oldBucketName,
            userEmail,
            status: 'failed',
            destinationBucket: newBucketName,
            metadata: { error: String(err) }
          }, isLocalDev);
        }

        return new Response(JSON.stringify({ error: 'Rename failed' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }
  } catch (err) {
    void logError(env, err instanceof Error ? err : new Error(String(err)), { module: 'buckets', operation: 'handle' }, isLocalDev);
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
