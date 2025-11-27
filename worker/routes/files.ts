import JSZip from 'jszip';
import type { Env, CloudflareApiResponse, JobOperationType } from '../types';
import { CF_API } from '../types';
import { generateSignature } from '../utils/signing';
import { generateJobId, createJob, updateJobProgress, completeJob, logJobEvent } from './jobs';
import { logAuditEvent } from './audit';

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
  console.log('[Files] Handling file operation');
  const parts = url.pathname.split('/');
  const bucketName = parts[3];
  const db = env.METADATA;
  
  const cfHeaders = {
    'X-Auth-Email': env.CF_EMAIL,
    'X-Auth-Key': env.API_KEY
  };

  // Handle multi-bucket ZIP download
  if (request.method === 'POST' && url.pathname === '/api/files/download-buckets-zip') {
    const jobId = generateJobId('bulk_download');
    const operationType: JobOperationType = 'bulk_download';
    let totalFiles = 0;
    let processedFiles = 0;
    let errorCount = 0;
    
    try {
      console.log('[Files] Processing multi-bucket ZIP download request');
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
        console.log('[Files] Processing bucket:', bucket.bucketName);
        const bucketFolder = zip.folder(bucket.bucketName);
        
        if (bucketFolder === null) {
          throw new Error('Failed to create folder for bucket: ' + bucket.bucketName);
        }
        
        for (const fileName of bucket.files) {
          console.log('[Files] Fetching:', fileName, 'from bucket:', bucket.bucketName);
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
            console.error('[Files] Error fetching file:', fileName, fileErr);
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
      
      console.log('[Files] Creating multi-bucket ZIP');
      const zipContent = await zip.generateAsync({type: "uint8array"});
      
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
      console.error('[Files] Multi-bucket ZIP download error:', err);
      
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
      
      return new Response(JSON.stringify({ 
        error: 'Failed to create multi-bucket zip file'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
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
      console.log('[Files] Processing ZIP download request');
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
        console.log('[Files] Fetching:', fileName);
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
          console.error('[Files] Error fetching file:', fileName, fileErr);
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
      
      console.log('[Files] Creating ZIP');
      const zipContent = await zip.generateAsync({type: "uint8array"});
      
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
      console.error('[Files] ZIP download error:', err);
      
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
      
      return new Response(JSON.stringify({ 
        error: 'Failed to create zip file'
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
      const limit = parseInt(url.searchParams.get('limit') ?? '20');
      const skipCache = url.searchParams.get('skipCache') === 'true';
      const prefix = url.searchParams.get('prefix');
      
      // Mock response for local development
      if (isLocalDev) {
        console.log('[Files] Using mock data for local development');
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
        console.log('[Files] Using prefix filter:', prefix);
      }

      // Add cache-busting parameter if requested
      if (skipCache) {
        apiUrl += '&_t=' + String(Date.now());
      }
      
      console.log('[Files] List request URL:', apiUrl);
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
      console.log('[Files] List response:', {
        url: apiUrl,
        objects: data.result?.slice(0, 3),
        total: data.result?.length ?? 0,
        pagination: data.result_info,
        sorting: 'desc by last_modified'
      });

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
      console.log('[Files] Found folders in result_info.delimited:', rawPrefixes);
      
      const folders = rawPrefixes
        .filter((prefix: string) => !prefix.startsWith('assets/'))
        .map((prefix: string) => prefix.endsWith('/') ? prefix.slice(0, -1) : prefix);
      console.log('[Files] Processed folders array:', folders);

      // Determine if there are more results
      // hasMore should be true only if the API indicates truncation AND we have a cursor for the next page
      const apiHasMore = data.result_info?.is_truncated ?? false;
      const hasValidCursor = data.result_info?.cursor !== undefined && data.result_info.cursor !== '';
      const hasMore = apiHasMore && hasValidCursor;

      console.log('[Files] Pagination info:', {
        apiTruncated: apiHasMore,
        cursor: data.result_info?.cursor,
        hasMore: hasMore,
        objectsReturned: objects.length,
        foldersReturned: folders.length,
        requestedLimit: limit
      });

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
      console.error('[Files] List error:', err);
      return new Response(JSON.stringify({ 
        error: 'Failed to list files'
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
    const file = formData.get('file') as File | null;
    const fileName = request.headers.get('X-File-Name');
    const chunkIndex = parseInt(request.headers.get('X-Chunk-Index') ?? '0');
    const totalChunks = parseInt(request.headers.get('X-Total-Chunks') ?? '1');
    
    if (fileName === null || file === null) {
      console.log('[Files] Missing filename or file in upload request');
      return new Response('Missing file or file name', { 
        status: 400,
        headers: corsHeaders
      });
    }

    try {
      console.log('[Files] Processing upload:',
        'bucket=' + bucketName,
        'file=' + fileName,
        'chunk=' + String(chunkIndex + 1) + '/' + String(totalChunks)
      );

      // Mock response for local development
      if (isLocalDev) {
        console.log('[Files] Simulating upload success for local development');
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
        console.log('[Files] Upload completed:', decodedFileName, 'ETag:', etag);
      } else {
        const chunkId = decodedFileName + '-' + String(chunkIndex);
        console.log('[Files] Chunk uploaded:', chunkId, 'ETag:', etag);
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
        await logAuditEvent(db, {
          operationType: 'file_upload',
          bucketName: bucketName ?? undefined,
          objectKey: decodedFileName,
          userEmail,
          status: 'success',
          sizeBytes: file.size,
          metadata: { etag, totalChunks }
        });
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
      console.error('[Files] Upload error:', err);
      
      // Log failed upload
      if (db) {
        await logAuditEvent(db, {
          operationType: 'file_upload',
          bucketName: bucketName ?? undefined,
          objectKey: fileName !== null ? decodeURIComponent(fileName) : undefined,
          userEmail,
          status: 'failed',
          metadata: { error: String(err) }
        });
      }
      
      return new Response(JSON.stringify({
        error: 'Upload failed'
      }), { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }

  // Get signed URL for file
  if (request.method === 'GET' && parts[4] === 'signed-url') {
    try {
      const keyPart = parts[5];
      if (keyPart === undefined) {
        return new Response(JSON.stringify({ error: 'Missing file key' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const key = decodeURIComponent(keyPart);
      console.log('[Files] Generating signed URL for:', key);
      
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
        await logAuditEvent(db, {
          operationType: 'file_download',
          bucketName: bucketName ?? undefined,
          objectKey: key,
          userEmail,
          status: 'success'
        });
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
      console.error('[Files] Signed URL generation error:', err);
      return new Response(JSON.stringify({
        error: 'Failed to generate signed URL'
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
    let fileKey = '';
    try {
      const keyPart = parts[5];
      if (keyPart === undefined) {
        return new Response(JSON.stringify({ error: 'Missing file key' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      fileKey = decodeURIComponent(keyPart);
      console.log('[Files] Deleting file:', fileKey);
      
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
        await logAuditEvent(db, {
          operationType: 'file_delete',
          bucketName: bucketName ?? undefined,
          objectKey: fileKey,
          userEmail,
          status: 'success'
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (err) {
      console.error('[Files] Delete error:', err);
      
      // Log failed delete
      if (db && fileKey !== '') {
        await logAuditEvent(db, {
          operationType: 'file_delete',
          bucketName: bucketName ?? undefined,
          objectKey: fileKey,
          userEmail,
          status: 'failed',
          metadata: { error: String(err) }
        });
      }
      
      return new Response(JSON.stringify({
        error: 'Delete failed'
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
      const body = await request.json() as TransferBody;
      const destBucket = body.destinationBucket;
      const destPath = body.destinationPath ?? '';
      
      if (destBucket === undefined || destBucket === '') {
        return new Response(JSON.stringify({ error: 'Missing destination bucket' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Allow same-bucket operations if destination path is different
      const fileName = sourceKey.split('/').pop() ?? sourceKey;
      const destKey = destPath !== '' ? `${destPath}${destPath.endsWith('/') ? '' : '/'}${fileName}` : fileName;
      
      if (bucketName === destBucket && sourceKey === destKey) {
        return new Response(JSON.stringify({ error: 'Source and destination must be different' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      console.log('[Files] Moving file:', sourceKey, 'from:', bucketName, 'to:', destBucket + '/' + destKey);

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
        console.warn('[Files] Warning: Failed to delete source file after successful copy:', deleteResponse.status);
        // Don't fail the operation if delete fails - the copy was successful
      }

      console.log('[Files] Move completed successfully');

      // Log audit event for file move
      if (db) {
        await logAuditEvent(db, {
          operationType: 'file_move',
          bucketName: bucketName ?? undefined,
          objectKey: sourceKey,
          userEmail,
          status: 'success',
          sizeBytes: fileBuffer.byteLength,
          destinationBucket: destBucket,
          destinationKey: destKey
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (err) {
      console.error('[Files] Move error:', err);
      
      // Log failed move (we need to get sourceKey from parts again since it may not be in scope)
      if (db) {
        const failedSourceKey = decodeURIComponent(parts.slice(4, -1).join('/'));
        await logAuditEvent(db, {
          operationType: 'file_move',
          bucketName: bucketName ?? undefined,
          objectKey: failedSourceKey,
          userEmail,
          status: 'failed',
          metadata: { error: String(err) }
        });
      }
      
      return new Response(JSON.stringify({
        error: 'Move failed'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
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
        return new Response(JSON.stringify({ error: 'Missing destination bucket' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Allow same-bucket operations if destination path is different
      const fileName = sourceKey.split('/').pop() ?? sourceKey;
      const destKey = destPath !== '' ? `${destPath}${destPath.endsWith('/') ? '' : '/'}${fileName}` : fileName;
      
      if (bucketName === destBucket && sourceKey === destKey) {
        return new Response(JSON.stringify({ error: 'Source and destination must be different' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      console.log('[Files] Copying file:', sourceKey, 'from:', bucketName, 'to:', destBucket + '/' + destKey);

      // 1. Fetch file from source bucket (same as move)
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

      console.log('[Files] Copy completed successfully');

      // Log audit event for file copy
      if (db) {
        await logAuditEvent(db, {
          operationType: 'file_copy',
          bucketName: bucketName ?? undefined,
          objectKey: sourceKey,
          userEmail,
          status: 'success',
          sizeBytes: fileBuffer.byteLength,
          destinationBucket: destBucket,
          destinationKey: destKey
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (err) {
      console.error('[Files] Copy error:', err);
      
      // Log failed copy
      if (db) {
        const failedSourceKey = decodeURIComponent(parts.slice(4, -1).join('/'));
        await logAuditEvent(db, {
          operationType: 'file_copy',
          bucketName: bucketName ?? undefined,
          objectKey: failedSourceKey,
          userEmail,
          status: 'failed',
          metadata: { error: String(err) }
        });
      }
      
      return new Response(JSON.stringify({
        error: 'Copy failed'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }

  // Rename file (same bucket, different key)
  if (request.method === 'PATCH' && parts[parts.length - 1] === 'rename') {
    try {
      const sourceKey = decodeURIComponent(parts.slice(4, -1).join('/'));
      const body = await request.json() as RenameFileBody;
      const newKey = body.newKey?.trim();
      
      if (newKey === undefined || newKey === '') {
        return new Response(JSON.stringify({ error: 'New key is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Prevent overwriting existing files
      const checkUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(newKey);
      const checkResponse = await fetch(checkUrl, { method: 'HEAD', headers: cfHeaders });
      
      if (checkResponse.ok) {
        return new Response(JSON.stringify({ error: 'File with that name already exists' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      console.log('[Files] Renaming file:', sourceKey, 'to:', newKey);

      // 1. Get source file
      const getUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(sourceKey);
      const getResponse = await fetch(getUrl, { headers: cfHeaders });

      if (!getResponse.ok) {
        if (getResponse.status === 404) {
          return new Response(JSON.stringify({ error: 'Source file not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
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
        console.warn('[Files] Warning: Failed to delete original file after rename:', deleteResponse.status);
        // Don't fail the operation - the rename was successful
      }

      console.log('[Files] File renamed successfully');

      // Log audit event for file rename
      if (db) {
        await logAuditEvent(db, {
          operationType: 'file_rename',
          bucketName: bucketName ?? undefined,
          objectKey: sourceKey,
          userEmail,
          status: 'success',
          sizeBytes: fileBuffer.byteLength,
          destinationBucket: bucketName ?? undefined,
          destinationKey: newKey
        });
      }

      return new Response(JSON.stringify({ success: true, newKey }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (err) {
      console.error('[Files] Rename error:', err);
      
      // Log failed rename
      if (db) {
        const failedSourceKey = decodeURIComponent(parts.slice(4, -1).join('/'));
        await logAuditEvent(db, {
          operationType: 'file_rename',
          bucketName: bucketName ?? undefined,
          objectKey: failedSourceKey,
          userEmail,
          status: 'failed',
          metadata: { error: String(err) }
        });
      }
      
      return new Response(JSON.stringify({
        error: 'Failed to rename file'
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
