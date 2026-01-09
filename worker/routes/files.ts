import JSZip from 'jszip';
import type { Env, CloudflareApiResponse, JobOperationType } from '../types';
import { CF_API } from '../types';
import { generateSignature } from '../utils/signing';
import { getCloudflareHeaders } from '../utils/helpers';
import { generateJobId, createJob, updateJobProgress, completeJob, logJobEvent } from './jobs';
import { logAuditEvent } from './audit';
import { logError, logInfo, logWarning } from '../utils/error-logger';
import { triggerWebhooks, createFileMovePayload, createFileCopyPayload, createFileRenamePayload } from '../utils/webhooks';
import { createErrorResponse } from '../utils/error-response';

interface MultiBucketDownloadBody {
  buckets: { bucketName: string; files: string[] }[];
}

interface ZipDownloadBody {
  files: string[];
}

interface TransferBody {
  destinationBucket: string;
  destinationPath?: string;
}

interface RenameFileBody {
  newKey?: string;
}

interface ListFilesResponseResult {
  objects: { key: string; size?: number; uploaded?: string; etag?: string; httpEtag?: string; version?: string; checksums?: Record<string, string>; httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> }[];
  delimited?: string[];
}


export async function handleFileRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: HeadersInit,
  isLocalDev: boolean,
  userEmail: string
): Promise<Response> {
  logInfo('Handling file operation', { module: 'files', operation: 'handle' });
  const parts = url.pathname.split('/');
  const bucketName = parts[3];
  const db = env.METADATA;

  const cfHeaders = getCloudflareHeaders(env);

  // Handle multi-bucket ZIP download
  if (request.method === 'POST' && url.pathname === '/api/files/download-buckets-zip') {
    const jobId = generateJobId('bulk_download');
    const operationType: JobOperationType = 'bulk_download';
    let totalFiles = 0;
    let processedFiles = 0;
    let errorCount = 0;

    try {
      logInfo('Processing multi-bucket ZIP download request', { module: 'files', operation: 'multi_download' });
      const { buckets } = await request.json() as MultiBucketDownloadBody;

      // Calculate total files
      totalFiles = buckets.reduce((sum, b) => sum + b.files.length, 0);
      const bucketNames = buckets.map(b => b.bucketName).join(', ');

      // Create job record
      if (db) {
        await createJob(db, {
          jobId,
          bucketName: bucketNames,
          operationType,
          totalItems: totalFiles,
          userEmail,
          metadata: { buckets: buckets.map(b => ({ name: b.bucketName, fileCount: b.files.length })) }
        });
      }

      const zip = new JSZip();

      for (const bucket of buckets) {
        logInfo(`Processing bucket: ${bucket.bucketName}`, { module: 'files', operation: 'multi_download', bucketName: bucket.bucketName });
        const bucketFolder = zip.folder(bucket.bucketName);

        if (bucketFolder === null) {
          throw new Error('Failed to create folder for bucket: ' + bucket.bucketName);
        }

        for (const fileName of bucket.files) {
          logInfo(`Fetching: ${fileName} from bucket: ${bucket.bucketName}`, { module: 'files', operation: 'multi_download', bucketName: bucket.bucketName, fileName });
          try {
            const response = await fetch(
              CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucket.bucketName + '/objects/' + fileName,
              { headers: cfHeaders }
            );

            if (!response.ok) {
              errorCount++;
              if (db) {
                await logJobEvent(db, {
                  jobId,
                  eventType: 'error',
                  userEmail,
                  details: { file: fileName, bucket: bucket.bucketName, error: 'Failed to fetch file' }
                });
              }
              continue;
            }

            const buffer = await response.arrayBuffer();
            bucketFolder.file(fileName, buffer);
            processedFiles++;

            // Update progress every 5 files or on last file
            if (db && (processedFiles % 5 === 0 || processedFiles === totalFiles)) {
              await updateJobProgress(db, {
                jobId,
                processedItems: processedFiles,
                totalItems: totalFiles,
                errorCount
              });
            }
          } catch (fileErr) {
            errorCount++;
            void logError(env, fileErr instanceof Error ? fileErr : new Error(String(fileErr)), { module: 'files', operation: 'multi_download', bucketName: bucket.bucketName, fileName }, isLocalDev);
            if (db) {
              await logJobEvent(db, {
                jobId,
                eventType: 'error',
                userEmail,
                details: { file: fileName, bucket: bucket.bucketName, error: String(fileErr) }
              });
            }
          }
        }
      }

      logInfo('Creating multi-bucket ZIP', { module: 'files', operation: 'multi_download' });
      const zipContent = await zip.generateAsync({ type: "uint8array" });

      // Complete the job
      if (db) {
        await completeJob(db, {
          jobId,
          status: errorCount > 0 ? 'completed' : 'completed',
          processedItems: processedFiles,
          errorCount,
          userEmail
        });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      return new Response(zipContent.buffer as ArrayBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="buckets-' + timestamp + '.zip"',
          ...corsHeaders
        }
      });

    } catch (err) {
      void logError(env, err instanceof Error ? err : new Error(String(err)), { module: 'files', operation: 'multi_download' }, isLocalDev);

      // Mark job as failed
      if (db) {
        await completeJob(db, {
          jobId,
          status: 'failed',
          processedItems: processedFiles,
          errorCount: errorCount + 1,
          userEmail,
          errorMessage: String(err)
        });
      }

      return createErrorResponse('Failed to create multi-bucket zip file', corsHeaders, 500);
    }
  }

  // Handle ZIP download
  if (request.method === 'POST' && parts[4] === 'download-zip') {
    const jobId = generateJobId('bulk_download');
    const operationType: JobOperationType = 'bulk_download';
    let processedFiles = 0;
    let errorCount = 0;
    let totalFiles = 0;
    const targetBucket = bucketName ?? 'unknown';

    try {
      logInfo('Processing ZIP download request', { module: 'files', operation: 'download_zip', bucketName: bucketName ?? 'unknown' });
      const body = await request.json() as ZipDownloadBody;
      const files = body.files;
      totalFiles = files.length;

      // Create job record
      if (db) {
        await createJob(db, {
          jobId,
          bucketName: targetBucket,
          operationType,
          totalItems: totalFiles,
          userEmail,
          metadata: { files }
        });
      }

      const zip = new JSZip();

      for (const fileName of files) {
        logInfo(`Fetching: ${fileName}`, { module: 'files', operation: 'download_zip', bucketName: bucketName ?? 'unknown', fileName });
        try {
          const response = await fetch(
            CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + fileName,
            { headers: cfHeaders }
          );

          if (!response.ok) {
            errorCount++;
            if (db) {
              await logJobEvent(db, {
                jobId,
                eventType: 'error',
                userEmail,
                details: { file: fileName, error: 'Failed to fetch file' }
              });
            }
            continue;
          }

          const buffer = await response.arrayBuffer();
          zip.file(fileName, buffer);
          processedFiles++;

          // Update progress every 5 files or on last file
          if (db && (processedFiles % 5 === 0 || processedFiles === totalFiles)) {
            await updateJobProgress(db, {
              jobId,
              processedItems: processedFiles,
              totalItems: totalFiles,
              errorCount
            });
          }
        } catch (fileErr) {
          errorCount++;
          void logError(env, fileErr instanceof Error ? fileErr : new Error(String(fileErr)), { module: 'files', operation: 'download_zip', bucketName: bucketName ?? 'unknown', fileName }, isLocalDev);
          if (db) {
            await logJobEvent(db, {
              jobId,
              eventType: 'error',
              userEmail,
              details: { file: fileName, error: String(fileErr) }
            });
          }
        }
      }

      logInfo('Creating ZIP', { module: 'files', operation: 'download_zip', bucketName: bucketName ?? 'unknown' });
      const zipContent = await zip.generateAsync({ type: "uint8array" });

      // Complete the job
      if (db) {
        await completeJob(db, {
          jobId,
          status: 'completed',
          processedItems: processedFiles,
          errorCount,
          userEmail
        });
      }

      return new Response(zipContent.buffer as ArrayBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="' + bucketName + '-files.zip"',
          ...corsHeaders
        }
      });

    } catch (err) {
      void logError(env, err instanceof Error ? err : new Error(String(err)), { module: 'files', operation: 'download_zip', bucketName: bucketName ?? 'unknown' }, isLocalDev);

      // Mark job as failed
      if (db) {
        await completeJob(db, {
          jobId,
          status: 'failed',
          processedItems: processedFiles,
          errorCount: errorCount + 1,
          userEmail,
          errorMessage: String(err)
        });
      }

      return createErrorResponse('Failed to create zip file', corsHeaders, 500);
    }
  }

  // List files with pagination
  if (request.method === 'GET' && parts.length === 4) {
    try {
      logInfo(`Listing files in bucket: ${bucketName}`, { module: 'files', operation: 'list', bucketName: bucketName ?? 'unknown' });
      const cursor = url.searchParams.get('cursor');
      const limit = parseInt(url.searchParams.get('limit') ?? '20');
      const skipCache = url.searchParams.get('skipCache') === 'true';
      const prefix = url.searchParams.get('prefix');

      // Mock response for local development
      if (isLocalDev) {
        logInfo('Using mock data for local development', { module: 'files', operation: 'list', bucketName: bucketName ?? 'unknown' });
        return new Response(JSON.stringify({
          objects: [],
          folders: [],
          pagination: {
            cursor: null,
            hasMore: false
          }
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': skipCache ? 'no-cache' : 'public, max-age=60',
            ...corsHeaders
          }
        });
      }

      let apiUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects'
        + '?include=customMetadata,httpMetadata'
        + '&per_page=' + String(limit)
        + '&delimiter=/'
        + '&order=desc'
        + '&sort_by=last_modified';

      if (cursor !== null && cursor !== '') {
        apiUrl += '&cursor=' + cursor;
      }

      // Add prefix parameter for folder navigation
      if (prefix !== null && prefix !== '') {
        apiUrl += '&prefix=' + encodeURIComponent(prefix);
        logInfo(`Using prefix filter: ${prefix}`, { module: 'files', operation: 'list', bucketName: bucketName ?? 'unknown', metadata: { prefix } });
      }

      // Add cache-busting parameter if requested
      if (skipCache) {
        apiUrl += '&_t=' + String(Date.now());
      }

      logInfo(`List request URL: ${apiUrl}`, { module: 'files', operation: 'list', bucketName: bucketName ?? 'unknown' });
      const response = await fetch(apiUrl, {
        headers: {
          ...cfHeaders,
          'Cache-Control': skipCache ? 'no-cache' : 'max-age=60'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to list files: ' + String(response.status));
      }

      const data = await response.json() as CloudflareApiResponse<ListFilesResponseResult['objects']>;
      logInfo('List response received', { module: 'files', operation: 'list', bucketName: bucketName ?? 'unknown', metadata: { url: apiUrl, objectsSample: data.result?.slice(0, 3), total: data.result?.length ?? 0, pagination: data.result_info } });

      // Filter out assets folder, .keep files, and process objects
      const fileList: ListFilesResponseResult['objects'] = Array.isArray(data.result) ? data.result : [];
      const objectPromises = fileList
        .filter((obj: ListFilesResponseResult['objects'][0]) =>
          !obj.key.startsWith('assets/') &&
          !obj.key.endsWith('/.keep') &&
          obj.key !== '.keep'
        )
        .map(async (obj: ListFilesResponseResult['objects'][0]) => {
          const downloadPath = '/api/files/' + bucketName + '/download/' + obj.key;
          const version = obj.uploaded !== undefined ? new Date(obj.uploaded).getTime() : Date.now();
          const versionedPath = downloadPath + '?ts=' + String(version);
          const signature = await generateSignature(versionedPath, env);
          const signedUrl = versionedPath + '&sig=' + signature;

          return {
            key: obj.key,
            size: obj.size,
            uploaded: obj.uploaded ?? new Date().toISOString(),
            url: signedUrl
          };
        });

      const objects = await Promise.all(objectPromises);

      // Sort objects by upload date
      objects.sort((a: { uploaded: string }, b: { uploaded: string }) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime());

      // Extract folders from the API response
      // The Cloudflare REST API returns folders in data.result_info.delimited
      const rawPrefixes: string[] = data.result_info?.delimited ?? [];
      logInfo(`Found folders in result_info.delimited: ${JSON.stringify(rawPrefixes)}`, { module: 'files', operation: 'list', bucketName: bucketName ?? 'unknown', metadata: { folders: rawPrefixes } });

      const folders = rawPrefixes
        .filter((prefix: string) => !prefix.startsWith('assets/'))
        .map((prefix: string) => prefix.endsWith('/') ? prefix.slice(0, -1) : prefix);
      logInfo(`Processed folders array: ${JSON.stringify(folders)}`, { module: 'files', operation: 'list', bucketName: bucketName ?? 'unknown' });

      // Determine if there are more results
      // hasMore should be true only if the API indicates truncation AND we have a cursor for the next page
      const apiHasMore = data.result_info?.is_truncated ?? false;
      const hasValidCursor = data.result_info?.cursor !== undefined && data.result_info.cursor !== '';
      const hasMore = apiHasMore && hasValidCursor;

      logInfo('Pagination info', { module: 'files', operation: 'list', bucketName: bucketName ?? 'unknown', metadata: { apiTruncated: apiHasMore, cursor: data.result_info?.cursor, hasMore, objectsReturned: objects.length, foldersReturned: folders.length, limit } });

      return new Response(JSON.stringify({
        objects,
        folders,
        pagination: {
          cursor: data.result_info?.cursor,
          hasMore: hasMore
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': skipCache ? 'no-cache' : 'public, max-age=60',
          ...corsHeaders
        }
      });

    } catch (err) {
      void logError(env, err instanceof Error ? err : new Error(String(err)), { module: 'files', operation: 'list', bucketName: bucketName ?? 'unknown' }, isLocalDev);
      return createErrorResponse('Failed to list files', corsHeaders, 500);
    }
  }

  // Upload file
  if (request.method === 'POST' && parts[4] === 'upload') {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileName = request.headers.get('X-File-Name');
    const chunkIndex = parseInt(request.headers.get('X-Chunk-Index') ?? '0');
    const totalChunks = parseInt(request.headers.get('X-Total-Chunks') ?? '1');

    if (fileName === null || file === null) {
      logInfo('Missing filename or file in upload request', { module: 'files', operation: 'upload', bucketName: bucketName ?? 'unknown' });
      return new Response('Missing file or file name', {
        status: 400,
        headers: corsHeaders
      });
    }

    try {
      logInfo(`Processing upload: ${fileName} (chunk ${chunkIndex + 1}/${totalChunks})`, { module: 'files', operation: 'upload', bucketName: bucketName ?? 'unknown', fileName, metadata: { chunkIndex, totalChunks } });

      // Mock response for local development
      if (isLocalDev) {
        logInfo('Simulating upload success for local development', { module: 'files', operation: 'upload', bucketName: bucketName ?? 'unknown', fileName });
        const uploadTimestamp = new Date().toISOString();
        return new Response(JSON.stringify({
          success: true,
          key: decodeURIComponent(fileName),
          timestamp: uploadTimestamp
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            ...corsHeaders
          }
        });
      }

      const decodedFileName = decodeURIComponent(fileName);
      const uploadUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + decodedFileName;
      const uploadTimestamp = new Date().toISOString();
      let etag = '';

      // Upload file using REST API
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          ...cfHeaders,
          'Content-Type': file.type !== '' ? file.type : 'application/octet-stream',
          'X-Upload-Created': uploadTimestamp,
          'Cache-Control': 'no-cache'
        },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed: ' + String(uploadResponse.status));
      }

      // Try to get ETag from PUT response headers first
      etag = uploadResponse.headers.get('etag') ?? uploadResponse.headers.get('ETag') ?? '';

      // If not in headers, try parsing from response body (R2 REST API returns JSON)
      if (!etag) {
        try {
          const uploadResult = await uploadResponse.json() as { result?: { etag?: string; httpEtag?: string } };
          etag = uploadResult.result?.etag ?? uploadResult.result?.httpEtag ?? '';
        } catch {
          // Response might not be JSON, continue without ETag from body
        }
      }

      // If still no ETag, do a GET request to list objects and find the file
      if (!etag) {
        const listUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects?prefix=' + encodeURIComponent(decodedFileName);
        const listResponse = await fetch(listUrl, { headers: cfHeaders });

        if (listResponse.ok) {
          const listData = await listResponse.json() as CloudflareApiResponse<{ key: string; etag?: string; httpEtag?: string }[]>;
          const fileObj = listData.result?.find(obj => obj.key === decodedFileName);
          if (fileObj) {
            etag = fileObj.etag ?? fileObj.httpEtag ?? '';
          }
        }
      }

      if (totalChunks === 1) {
        logInfo(`Upload completed: ${decodedFileName}, ETag: ${etag}`, { module: 'files', operation: 'upload', bucketName: bucketName ?? 'unknown', fileName: decodedFileName, metadata: { etag } });
      } else {
        const chunkId = decodedFileName + '-' + String(chunkIndex);
        logInfo(`Chunk uploaded: ${chunkId}, ETag: ${etag}`, { module: 'files', operation: 'upload_chunk', bucketName: bucketName ?? 'unknown', fileName: decodedFileName, metadata: { chunkId, etag } });
      }

      // Force a cache refresh of the file listing
      await fetch(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects?skipCache=true', {
        headers: {
          ...cfHeaders,
          'Cache-Control': 'no-cache'
        }
      });

      // Log audit event for file upload (only for final chunk or single chunk uploads)
      if (db && (totalChunks === 1 || chunkIndex === totalChunks - 1)) {
        await logAuditEvent(env, {
          operationType: 'file_upload',
          bucketName: bucketName ?? undefined,
          objectKey: decodedFileName,
          userEmail,
          status: 'success',
          sizeBytes: file.size,
          metadata: { etag, totalChunks }
        }, isLocalDev);
      }

      return new Response(JSON.stringify({
        success: true,
        timestamp: uploadTimestamp,
        etag: etag,
        chunkIndex: chunkIndex
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          ...corsHeaders
        }
      });

    } catch (err) {
      void logError(env, err instanceof Error ? err : new Error(String(err)), { module: 'files', operation: 'upload', bucketName: bucketName ?? 'unknown', fileName: fileName ? decodeURIComponent(fileName) : 'unknown' }, isLocalDev);

      // Log failed upload
      if (db) {
        await logAuditEvent(env, {
          operationType: 'file_upload',
          bucketName: bucketName ?? undefined,
          objectKey: fileName !== null ? decodeURIComponent(fileName) : undefined,
          userEmail,
          status: 'failed',
          metadata: { error: String(err) }
        }, isLocalDev);
      }

      return createErrorResponse('Upload failed', corsHeaders, 500);
    }
  }

  // Get signed URL for file
  if (request.method === 'GET' && parts[4] === 'signed-url') {
    try {
      const keyPart = parts[5];
      if (keyPart === undefined) {
        return createErrorResponse('Missing file key', corsHeaders, 400);
      }
      const key = decodeURIComponent(keyPart);
      logInfo(`Generating signed URL for: ${key}`, { module: 'files', operation: 'signed_url', bucketName: bucketName ?? 'unknown', fileName: key });

      // Create the download path
      const downloadPath = '/api/files/' + bucketName + '/download/' + key;
      const version = Date.now();
      const versionedPath = downloadPath + '?ts=' + String(version);
      const signature = await generateSignature(versionedPath, env);
      const signedUrl = versionedPath + '&sig=' + signature;

      // Return the full URL
      const fullUrl = new URL(signedUrl, request.url).toString();

      // Log audit event for file download (signed URL generation)
      if (db) {
        await logAuditEvent(env, {
          operationType: 'file_download',
          bucketName: bucketName ?? undefined,
          objectKey: key,
          userEmail,
          status: 'success'
        }, isLocalDev);
      }

      return new Response(JSON.stringify({
        success: true,
        url: fullUrl
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (err) {
      void logError(env, err instanceof Error ? err : new Error(String(err)), { module: 'files', operation: 'signed_url', bucketName: bucketName ?? 'unknown' }, isLocalDev);
      return createErrorResponse('Failed to generate signed URL', corsHeaders, 500);
    }
  }

  // Delete file
  if (request.method === 'DELETE' && parts[4] === 'delete') {
    let fileKey = '';
    try {
      const keyPart = parts[5];
      if (keyPart === undefined) {
        return createErrorResponse('Missing file key', corsHeaders, 400);
      }
      fileKey = decodeURIComponent(keyPart);
      logInfo(`Deleting file: ${fileKey}`, { module: 'files', operation: 'delete', bucketName: bucketName ?? 'unknown', fileName: fileKey });

      const response = await fetch(
        CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + fileKey,
        {
          method: 'DELETE',
          headers: cfHeaders
        }
      );

      if (!response.ok) {
        throw new Error('Delete failed: ' + String(response.status));
      }

      // Log audit event for file delete
      if (db) {
        await logAuditEvent(env, {
          operationType: 'file_delete',
          bucketName: bucketName ?? undefined,
          objectKey: fileKey,
          userEmail,
          status: 'success'
        }, isLocalDev);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (err) {
      void logError(env, err instanceof Error ? err : new Error(String(err)), { module: 'files', operation: 'delete', bucketName: bucketName ?? 'unknown', fileName: fileKey }, isLocalDev);

      // Log failed delete
      if (db && fileKey !== '') {
        await logAuditEvent(env, {
          operationType: 'file_delete',
          bucketName: bucketName ?? undefined,
          objectKey: fileKey,
          userEmail,
          status: 'failed',
          metadata: { error: String(err) }
        }, isLocalDev);
      }

      return createErrorResponse('Delete failed', corsHeaders, 500);
    }
  }

  // Move file
  if (request.method === 'POST' && parts[parts.length - 1] === 'move') {
    try {
      const sourceKey = decodeURIComponent(parts.slice(4, -1).join('/'));
      const body = await request.json() as TransferBody;
      const destBucket = body.destinationBucket;
      const destPath = body.destinationPath ?? '';

      if (destBucket === undefined || destBucket === '') {
        return createErrorResponse('Missing destination bucket', corsHeaders, 400);
      }

      // Allow same-bucket operations if destination path is different
      const fileName = sourceKey.split('/').pop() ?? sourceKey;
      const destKey = destPath !== '' ? `${destPath}${destPath.endsWith('/') ? '' : '/'}${fileName}` : fileName;

      if (bucketName === destBucket && sourceKey === destKey) {
        return createErrorResponse('Source and destination must be different', corsHeaders, 400);
      }

      logInfo(`Moving file: ${sourceKey} to ${destBucket}/${destKey}`, { module: 'files', operation: 'move', bucketName: bucketName ?? 'unknown', fileName: sourceKey, metadata: { destination: `${destBucket}/${destKey}` } });

      // 1. Fetch file from source bucket
      const getUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + sourceKey;
      const getResponse = await fetch(getUrl, { headers: cfHeaders });

      if (!getResponse.ok) {
        if (getResponse.status === 404) {
          return createErrorResponse('Source file not found', corsHeaders, 404);
        }
        throw new Error('Failed to fetch file: ' + String(getResponse.status));
      }

      // 2. Preserve metadata from source
      const contentType = getResponse.headers.get('Content-Type') ?? 'application/octet-stream';
      const fileBuffer = await getResponse.arrayBuffer();

      // 3. Upload to destination bucket with destination path
      const putUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + destBucket + '/objects/' + encodeURIComponent(destKey);
      const putResponse = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          ...cfHeaders,
          'Content-Type': contentType
        },
        body: fileBuffer
      });

      if (!putResponse.ok) {
        throw new Error('Failed to upload to destination: ' + String(putResponse.status));
      }

      // 4. Delete from source bucket
      const deleteUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + sourceKey;
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: cfHeaders
      });

      if (!deleteResponse.ok) {
        logWarning(`Failed to delete source file after successful copy: ${deleteResponse.status}`, { module: 'files', operation: 'move', bucketName: bucketName ?? 'unknown', fileName: sourceKey });
        // Don't fail the operation if delete fails - the copy was successful
      }

      logInfo('Move completed successfully', { module: 'files', operation: 'move', bucketName: bucketName ?? 'unknown', fileName: sourceKey });

      // Log audit event for file move
      if (db) {
        await logAuditEvent(env, {
          operationType: 'file_move',
          bucketName: bucketName ?? undefined,
          objectKey: sourceKey,
          userEmail,
          status: 'success',
          sizeBytes: fileBuffer.byteLength,
          destinationBucket: destBucket,
          destinationKey: destKey
        }, isLocalDev);
      }

      // Trigger webhook for file move
      void triggerWebhooks(env, 'file_move', createFileMovePayload(
        bucketName ?? '',
        sourceKey,
        destBucket,
        destKey,
        userEmail
      ), isLocalDev);

      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (err) {
      void logError(env, err instanceof Error ? err : new Error(String(err)), { module: 'files', operation: 'move', bucketName: bucketName ?? 'unknown' }, isLocalDev);

      // Log failed move (we need to get sourceKey from parts again since it may not be in scope)
      if (db) {
        const failedSourceKey = decodeURIComponent(parts.slice(4, -1).join('/'));
        await logAuditEvent(env, {
          operationType: 'file_move',
          bucketName: bucketName ?? undefined,
          objectKey: failedSourceKey,
          userEmail,
          status: 'failed',
          metadata: { error: String(err) }
        }, isLocalDev);
      }

      return createErrorResponse('Move failed', corsHeaders, 500);
    }
  }

  // Copy file
  if (request.method === 'POST' && parts[parts.length - 1] === 'copy') {
    try {
      const sourceKey = decodeURIComponent(parts.slice(4, -1).join('/'));
      const body = await request.json() as TransferBody;
      const destBucket = body.destinationBucket;
      const destPath = body.destinationPath ?? '';

      if (destBucket === undefined || destBucket === '') {
        return createErrorResponse('Missing destination bucket', corsHeaders, 400);
      }

      // Allow same-bucket operations if destination path is different
      const fileName = sourceKey.split('/').pop() ?? sourceKey;
      const destKey = destPath !== '' ? `${destPath}${destPath.endsWith('/') ? '' : '/'}${fileName}` : fileName;

      if (bucketName === destBucket && sourceKey === destKey) {
        return createErrorResponse('Source and destination must be different', corsHeaders, 400);
      }

      logInfo(`Copying file: ${sourceKey} to ${destBucket}/${destKey}`, { module: 'files', operation: 'copy', bucketName: bucketName ?? 'unknown', fileName: sourceKey, metadata: { destination: `${destBucket}/${destKey}` } });

      // 1. Fetch file from source bucket (same as move)
      const getUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + sourceKey;
      const getResponse = await fetch(getUrl, { headers: cfHeaders });

      if (!getResponse.ok) {
        if (getResponse.status === 404) {
          return createErrorResponse('Source file not found', corsHeaders, 404);
        }
        throw new Error('Failed to fetch file: ' + String(getResponse.status));
      }

      // 2. Preserve metadata from source (same as move)
      const contentType = getResponse.headers.get('Content-Type') ?? 'application/octet-stream';
      const fileBuffer = await getResponse.arrayBuffer();

      // 3. Upload to destination bucket with destination path
      const putUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + destBucket + '/objects/' + encodeURIComponent(destKey);
      const putResponse = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          ...cfHeaders,
          'Content-Type': contentType
        },
        body: fileBuffer
      });

      if (!putResponse.ok) {
        throw new Error('Failed to upload to destination: ' + String(putResponse.status));
      }

      logInfo('Copy completed successfully', { module: 'files', operation: 'copy', bucketName: bucketName ?? 'unknown', fileName: sourceKey });

      // Log audit event for file copy
      if (db) {
        await logAuditEvent(env, {
          operationType: 'file_copy',
          bucketName: bucketName ?? undefined,
          objectKey: sourceKey,
          userEmail,
          status: 'success',
          sizeBytes: fileBuffer.byteLength,
          destinationBucket: destBucket,
          destinationKey: destKey
        }, isLocalDev);
      }

      // Trigger webhook for file copy
      void triggerWebhooks(env, 'file_copy', createFileCopyPayload(
        bucketName ?? '',
        sourceKey,
        destBucket,
        destKey,
        userEmail
      ), isLocalDev);

      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (err) {
      void logError(env, err instanceof Error ? err : new Error(String(err)), { module: 'files', operation: 'copy', bucketName: bucketName ?? 'unknown' }, isLocalDev);

      // Log failed copy
      if (db) {
        const failedSourceKey = decodeURIComponent(parts.slice(4, -1).join('/'));
        await logAuditEvent(env, {
          operationType: 'file_copy',
          bucketName: bucketName ?? undefined,
          objectKey: failedSourceKey,
          userEmail,
          status: 'failed',
          metadata: { error: String(err) }
        }, isLocalDev);
      }

      return createErrorResponse('Copy failed', corsHeaders, 500);
    }
  }

  // Rename file (same bucket, different key)
  if (request.method === 'PATCH' && parts[parts.length - 1] === 'rename') {
    try {
      const sourceKey = decodeURIComponent(parts.slice(4, -1).join('/'));
      const body = await request.json() as RenameFileBody;
      const newKey = body.newKey?.trim();

      if (newKey === undefined || newKey === '') {
        return createErrorResponse('New key is required', corsHeaders, 400);
      }

      // Prevent overwriting existing files
      const checkUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(newKey);
      const checkResponse = await fetch(checkUrl, { method: 'HEAD', headers: cfHeaders });

      if (checkResponse.ok) {
        return createErrorResponse('File with that name already exists', corsHeaders, 409);
      }

      logInfo(`Renaming file: ${sourceKey} to ${newKey}`, { module: 'files', operation: 'rename', bucketName: bucketName ?? 'unknown', fileName: sourceKey, metadata: { newKey } });

      // 1. Get source file
      const getUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(sourceKey);
      const getResponse = await fetch(getUrl, { headers: cfHeaders });

      if (!getResponse.ok) {
        if (getResponse.status === 404) {
          return createErrorResponse('Source file not found', corsHeaders, 404);
        }
        throw new Error('Failed to fetch file: ' + String(getResponse.status));
      }

      // 2. Preserve metadata
      const contentType = getResponse.headers.get('Content-Type') ?? 'application/octet-stream';
      const fileBuffer = await getResponse.arrayBuffer();

      // 3. Create file with new key
      const putUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(newKey);
      const putResponse = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          ...cfHeaders,
          'Content-Type': contentType
        },
        body: fileBuffer
      });

      if (!putResponse.ok) {
        throw new Error('Failed to create renamed file: ' + String(putResponse.status));
      }

      // 4. Delete original file
      const deleteUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(sourceKey);
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: cfHeaders
      });

      if (!deleteResponse.ok) {
        logWarning(`Failed to delete original file after rename: ${deleteResponse.status}`, { module: 'files', operation: 'rename', bucketName: bucketName ?? 'unknown', fileName: sourceKey });
        // Don't fail the operation - the rename was successful
      }

      logInfo('File renamed successfully', { module: 'files', operation: 'rename', bucketName: bucketName ?? 'unknown', fileName: sourceKey });

      // Log audit event for file rename
      if (db) {
        await logAuditEvent(env, {
          operationType: 'file_rename',
          bucketName: bucketName ?? undefined,
          objectKey: sourceKey,
          userEmail,
          status: 'success',
          sizeBytes: fileBuffer.byteLength,
          destinationBucket: bucketName ?? undefined,
          destinationKey: newKey
        }, isLocalDev);
      }

      // Trigger webhook for file rename
      void triggerWebhooks(env, 'file_rename', createFileRenamePayload(
        bucketName ?? '',
        sourceKey,
        newKey,
        userEmail
      ), isLocalDev);

      return new Response(JSON.stringify({ success: true, newKey }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (err) {
      void logError(env, err instanceof Error ? err : new Error(String(err)), { module: 'files', operation: 'rename', bucketName: bucketName ?? 'unknown' }, isLocalDev);

      // Log failed rename
      if (db) {
        const failedSourceKey = decodeURIComponent(parts.slice(4, -1).join('/'));
        await logAuditEvent(env, {
          operationType: 'file_rename',
          bucketName: bucketName ?? undefined,
          objectKey: failedSourceKey,
          userEmail,
          status: 'failed',
          metadata: { error: String(err) }
        }, isLocalDev);
      }

      return createErrorResponse('Failed to rename file', corsHeaders, 500);
    }
  }

  return new Response('Not Found', {
    status: 404,
    headers: corsHeaders
  });
}
