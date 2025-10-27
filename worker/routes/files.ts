import JSZip from 'jszip';
import type { Env } from '../types';
import { CF_API } from '../types';
import { generateSignature } from '../utils/signing';

export async function handleFileRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: HeadersInit,
  isLocalDev: boolean
): Promise<Response> {
  console.log('[Files] Handling file operation');
  const parts = url.pathname.split('/');
  const bucketName = parts[3];
  
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

    } catch (err) {
      console.error('[Files] ZIP download error:', err);
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
      const limit = parseInt(url.searchParams.get('limit') || '20');
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
        + '&per_page=' + limit
        + '&delimiter=/'
        + '&order=desc'
        + '&sort_by=last_modified';
      
      if (cursor) {
        apiUrl += '&cursor=' + cursor;
      }
      
      // Add prefix parameter for folder navigation
      if (prefix) {
        apiUrl += '&prefix=' + encodeURIComponent(prefix);
        console.log('[Files] Using prefix filter:', prefix);
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

      // Filter out assets folder, .keep files, and process objects
      interface R2ObjectInfo {
        key: string;
        size?: number;
        last_modified?: string;
      }
      
      const fileList = Array.isArray(data.result) ? data.result : (data.result?.objects || []);
      const objectPromises = fileList
        .filter((obj: R2ObjectInfo) => 
          !obj.key.startsWith('assets/') && 
          !obj.key.endsWith('/.keep') &&
          obj.key !== '.keep'
        )
        .map(async (obj: R2ObjectInfo) => {
          const downloadPath = '/api/files/' + bucketName + '/download/' + obj.key;
          const version = obj.last_modified ? new Date(obj.last_modified).getTime() : Date.now();
          const versionedPath = downloadPath + '?ts=' + version;
          const signature = await generateSignature(versionedPath, env);
          const signedUrl = versionedPath + '&sig=' + signature;

          return {
            key: obj.key,
            size: obj.size || 0,
            uploaded: obj.last_modified || new Date().toISOString(),
            url: signedUrl
          };
        });

      const objects = await Promise.all(objectPromises);

      // Sort objects by upload date
      objects.sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime());

      // Extract folders from the API response
      // The Cloudflare REST API returns folders in data.result_info.delimited
      const rawPrefixes = data.result_info?.delimited || [];
      console.log('[Files] Found folders in result_info.delimited:', rawPrefixes);
      
      const folders = rawPrefixes
        .filter((prefix: string) => !prefix.startsWith('assets/'))
        .map((prefix: string) => prefix.endsWith('/') ? prefix.slice(0, -1) : prefix);
      console.log('[Files] Processed folders array:', folders);

      // Determine if there are more results
      // hasMore should be true only if the API indicates truncation AND we have a cursor for the next page
      const apiHasMore = data.result_info?.is_truncated || false;
      const hasValidCursor = !!data.result_info?.cursor;
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

    } catch (err) {
      console.error('[Files] Upload error:', err);
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
      const key = decodeURIComponent(parts[5]);
      console.log('[Files] Generating signed URL for:', key);
      
      // Create the download path
      const downloadPath = '/api/files/' + bucketName + '/download/' + key;
      const version = Date.now();
      const versionedPath = downloadPath + '?ts=' + version;
      const signature = await generateSignature(versionedPath, env);
      const signedUrl = versionedPath + '&sig=' + signature;
      
      // Return the full URL
      const fullUrl = new URL(signedUrl, request.url).toString();
      
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

    } catch (err) {
      console.error('[Files] Delete error:', err);
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
      const body = await request.json();
      const destBucket = body.destinationBucket;
      const destPath = body.destinationPath || '';
      
      if (!destBucket) {
        return new Response(JSON.stringify({ error: 'Missing destination bucket' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Allow same-bucket operations if destination path is different
      const fileName = sourceKey.split('/').pop() || sourceKey;
      const destKey = destPath ? `${destPath}${destPath.endsWith('/') ? '' : '/'}${fileName}` : fileName;
      
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
        throw new Error('Failed to fetch file: ' + getResponse.status);
      }

      // 2. Preserve metadata from source
      const contentType = getResponse.headers.get('Content-Type') || 'application/octet-stream';
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
      const body = await request.json();
      const destBucket = body.destinationBucket;
      const destPath = body.destinationPath || '';
      
      if (!destBucket) {
        return new Response(JSON.stringify({ error: 'Missing destination bucket' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Allow same-bucket operations if destination path is different
      const fileName = sourceKey.split('/').pop() || sourceKey;
      const destKey = destPath ? `${destPath}${destPath.endsWith('/') ? '' : '/'}${fileName}` : fileName;
      
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
        throw new Error('Failed to fetch file: ' + getResponse.status);
      }

      // 2. Preserve metadata from source (same as move)
      const contentType = getResponse.headers.get('Content-Type') || 'application/octet-stream';
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
        throw new Error('Failed to upload to destination: ' + putResponse.status);
      }

      console.log('[Files] Copy completed successfully');

      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (err) {
      console.error('[Files] Copy error:', err);
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
      const body = await request.json();
      const newKey = body.newKey?.trim();
      
      if (!newKey) {
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
        throw new Error('Failed to fetch file: ' + getResponse.status);
      }

      // 2. Preserve metadata
      const contentType = getResponse.headers.get('Content-Type') || 'application/octet-stream';
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
        throw new Error('Failed to create renamed file: ' + putResponse.status);
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

      return new Response(JSON.stringify({ success: true, newKey }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (err) {
      console.error('[Files] Rename error:', err);
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

