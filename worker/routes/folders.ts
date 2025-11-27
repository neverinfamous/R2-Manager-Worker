import type { Env, CloudflareApiResponse, R2ObjectInfo } from '../types';
import { CF_API } from '../types';

interface CreateFolderBody {
  folderName?: string;
}

interface RenameFolderBody {
  oldPath?: string;
  newPath?: string;
}

interface TransferBody {
  destinationBucket: string;
  destinationPath?: string;
}

export async function handleFolderRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: HeadersInit,
  isLocalDev: boolean
): Promise<Response> {
  console.log('[Folders] Handling folder operation');
  const parts = url.pathname.split('/');
  const bucketName = parts[3];
  
  const cfHeaders = {
    'X-Auth-Email': env.CF_EMAIL,
    'X-Auth-Key': env.API_KEY
  };

  // Create folder
  if (request.method === 'POST' && parts[4] === 'create') {
    try {
      const body = await request.json() as CreateFolderBody;
      const folderName = body.folderName?.trim();
      
      if (folderName === undefined || folderName === '') {
        return new Response(JSON.stringify({ error: 'Folder name is required' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Validate folder name
      const validFolderPattern = /^[a-zA-Z0-9-_/]+$/;
      if (!validFolderPattern.test(folderName)) {
        return new Response(JSON.stringify({ 
          error: 'Invalid folder name. Use only letters, numbers, hyphens, underscores, and forward slashes' 
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Ensure folder path ends with /
      const folderPath = folderName.endsWith('/') ? folderName : folderName + '/';
      
      // Mock response for local development
      if (isLocalDev) {
        console.log('[Folders] Simulating folder creation for local development');
        return new Response(JSON.stringify({ 
          success: true, 
          folderPath 
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      
      // Create a placeholder .keep file
      const keepFilePath = folderPath + '.keep';
      const putUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(keepFilePath);
      
      const response = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          ...cfHeaders,
          'Content-Type': 'text/plain'
        },
        body: ''
      });

      if (!response.ok) {
        throw new Error('Failed to create folder: ' + String(response.status));
      }

      console.log('[Folders] Created folder:', folderPath);

      return new Response(JSON.stringify({ success: true, folderPath }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (err) {
      console.error('[Folders] Create error:', err);
      return new Response(JSON.stringify({
        error: 'Failed to create folder'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }

  // Rename folder
  if (request.method === 'PATCH' && parts[4] === 'rename') {
    try {
      const body = await request.json() as RenameFolderBody;
      const oldPath = body.oldPath?.trim();
      const newPath = body.newPath?.trim();
      
      if (oldPath === undefined || oldPath === '' || newPath === undefined || newPath === '') {
        return new Response(JSON.stringify({ error: 'Both old and new paths are required' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Ensure paths end with /
      const oldFolderPath = oldPath.endsWith('/') ? oldPath : oldPath + '/';
      const newFolderPath = newPath.endsWith('/') ? newPath : newPath + '/';

      console.log('[Folders] Renaming folder from:', oldFolderPath, 'to:', newFolderPath);

      // List all objects with the old prefix
      let cursor: string | undefined;
      let totalCopied = 0;
      let totalFailed = 0;
      let hasMore = true;

      while (hasMore) {
        const listUrl = new URL(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects');
        listUrl.searchParams.set('prefix', oldFolderPath);
        listUrl.searchParams.set('per_page', '100');
        if (cursor !== undefined) {
          listUrl.searchParams.set('cursor', cursor);
        }

        const listResponse = await fetch(listUrl.toString(), { headers: cfHeaders });
        if (!listResponse.ok) {
          throw new Error('Failed to list objects: ' + String(listResponse.status));
        }

        const listData = await listResponse.json() as CloudflareApiResponse<R2ObjectInfo[]>;
        const objects: R2ObjectInfo[] = Array.isArray(listData.result) ? listData.result : [];
        
        if (objects.length === 0) {
          hasMore = false;
          break;
        }

        // Copy each object to new location
        for (const obj of objects) {
          try {
            const newKey = obj.key.replace(oldFolderPath, newFolderPath);
            
            // Get the object
            const getUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(obj.key);
            const getResponse = await fetch(getUrl, { headers: cfHeaders });
            
            if (!getResponse.ok) {
              totalFailed++;
              continue;
            }

            const fileBuffer = await getResponse.arrayBuffer();
            const contentType = getResponse.headers.get('Content-Type') ?? 'application/octet-stream';

            // Put to new location
            const putUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(newKey);
            const putResponse = await fetch(putUrl, {
              method: 'PUT',
              headers: {
                ...cfHeaders,
                'Content-Type': contentType
              },
              body: fileBuffer
            });

            if (putResponse.ok) {
              totalCopied++;
            } else {
              totalFailed++;
            }
          } catch {
            totalFailed++;
          }
        }

        cursor = listData.result_info?.cursor as string | undefined;
        hasMore = cursor !== undefined && objects.length > 0;
        
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // Delete old folder objects
      cursor = undefined;
      hasMore = true;

      while (hasMore) {
        const listUrl = new URL(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects');
        listUrl.searchParams.set('prefix', oldFolderPath);
        listUrl.searchParams.set('per_page', '100');
        if (cursor !== undefined) {
          listUrl.searchParams.set('cursor', cursor);
        }

        const listResponse = await fetch(listUrl.toString(), { headers: cfHeaders });
        if (!listResponse.ok) break;

        const listData = await listResponse.json() as CloudflareApiResponse<R2ObjectInfo[]>;
        const objects: R2ObjectInfo[] = Array.isArray(listData.result) ? listData.result : [];
        
        if (objects.length === 0) break;

        for (const obj of objects) {
          try {
            const deleteUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(obj.key);
            await fetch(deleteUrl, { method: 'DELETE', headers: cfHeaders });
          } catch {
            // Continue on delete failure
          }
        }

        cursor = listData.result_info?.cursor as string | undefined;
        hasMore = cursor !== undefined && objects.length > 0;
        
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      console.log('[Folders] Renamed folder, copied:', totalCopied, 'failed:', totalFailed);

      return new Response(JSON.stringify({ 
        success: true, 
        copied: totalCopied, 
        failed: totalFailed 
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (err) {
      console.error('[Folders] Rename error:', err);
      return new Response(JSON.stringify({
        error: 'Failed to rename folder'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }

  // Copy folder
  if (request.method === 'POST' && parts[parts.length - 1] === 'copy') {
    try {
      const folderPath = decodeURIComponent(parts.slice(4, -1).join('/'));
      const body = await request.json() as TransferBody;
      const destBucket = body.destinationBucket;
      const destPath = body.destinationPath ?? folderPath;
      
      if (destBucket === undefined || destBucket === '') {
        return new Response(JSON.stringify({ error: 'Destination bucket is required' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Ensure paths end with /
      const sourceFolderPath = folderPath.endsWith('/') ? folderPath : folderPath + '/';
      const destFolderPath = destPath.endsWith('/') ? destPath : destPath + '/';

      console.log('[Folders] Copying folder from:', bucketName + '/' + sourceFolderPath, 'to:', destBucket + '/' + destFolderPath);

      let cursor: string | undefined;
      let totalCopied = 0;
      let totalFailed = 0;
      let hasMore = true;

      while (hasMore) {
        const listUrl = new URL(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects');
        listUrl.searchParams.set('prefix', sourceFolderPath);
        listUrl.searchParams.set('per_page', '100');
        if (cursor !== undefined) {
          listUrl.searchParams.set('cursor', cursor);
        }

        const listResponse = await fetch(listUrl.toString(), { headers: cfHeaders });
        if (!listResponse.ok) {
          throw new Error('Failed to list objects: ' + String(listResponse.status));
        }

        const listData = await listResponse.json() as CloudflareApiResponse<R2ObjectInfo[]>;
        const objects: R2ObjectInfo[] = Array.isArray(listData.result) ? listData.result : [];
        
        if (objects.length === 0) {
          hasMore = false;
          break;
        }

        for (const obj of objects) {
          try {
            const relativePath = obj.key.substring(sourceFolderPath.length);
            const destKey = destFolderPath + relativePath;
            
            // Get the object
            const getUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(obj.key);
            const getResponse = await fetch(getUrl, { headers: cfHeaders });
            
            if (!getResponse.ok) {
              totalFailed++;
              continue;
            }

            const fileBuffer = await getResponse.arrayBuffer();
            const contentType = getResponse.headers.get('Content-Type') ?? 'application/octet-stream';

            // Put to destination
            const putUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + destBucket + '/objects/' + encodeURIComponent(destKey);
            const putResponse = await fetch(putUrl, {
              method: 'PUT',
              headers: {
                ...cfHeaders,
                'Content-Type': contentType
              },
              body: fileBuffer
            });

            if (putResponse.ok) {
              totalCopied++;
            } else {
              totalFailed++;
            }
          } catch {
            totalFailed++;
          }
        }

        cursor = listData.result_info?.cursor as string | undefined;
        hasMore = cursor !== undefined && objects.length > 0;
        
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      console.log('[Folders] Copied folder, success:', totalCopied, 'failed:', totalFailed);

      return new Response(JSON.stringify({ 
        success: true, 
        copied: totalCopied, 
        failed: totalFailed 
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (err) {
      console.error('[Folders] Copy error:', err);
      return new Response(JSON.stringify({
        error: 'Failed to copy folder'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }

  // Move folder
  if (request.method === 'POST' && parts[parts.length - 1] === 'move') {
    try {
      const folderPath = decodeURIComponent(parts.slice(4, -1).join('/'));
      const body = await request.json() as TransferBody;
      const destBucket = body.destinationBucket;
      const destPath = body.destinationPath ?? folderPath;
      
      if (destBucket === undefined || destBucket === '') {
        return new Response(JSON.stringify({ error: 'Destination bucket is required' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Ensure paths end with /
      const sourceFolderPath = folderPath.endsWith('/') ? folderPath : folderPath + '/';
      const destFolderPath = destPath.endsWith('/') ? destPath : destPath + '/';

      console.log('[Folders] Moving folder from:', bucketName + '/' + sourceFolderPath, 'to:', destBucket + '/' + destFolderPath);

      // First copy all files
      let cursor: string | undefined;
      let totalMoved = 0;
      let totalFailed = 0;
      let hasMore = true;

      while (hasMore) {
        const listUrl = new URL(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects');
        listUrl.searchParams.set('prefix', sourceFolderPath);
        listUrl.searchParams.set('per_page', '100');
        if (cursor !== undefined) {
          listUrl.searchParams.set('cursor', cursor);
        }

        const listResponse = await fetch(listUrl.toString(), { headers: cfHeaders });
        if (!listResponse.ok) {
          throw new Error('Failed to list objects: ' + String(listResponse.status));
        }

        const listData = await listResponse.json() as CloudflareApiResponse<R2ObjectInfo[]>;
        const objects: R2ObjectInfo[] = Array.isArray(listData.result) ? listData.result : [];
        
        if (objects.length === 0) {
          hasMore = false;
          break;
        }

        for (const obj of objects) {
          try {
            const relativePath = obj.key.substring(sourceFolderPath.length);
            const destKey = destFolderPath + relativePath;
            
            // Get the object
            const getUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(obj.key);
            const getResponse = await fetch(getUrl, { headers: cfHeaders });
            
            if (!getResponse.ok) {
              totalFailed++;
              continue;
            }

            const fileBuffer = await getResponse.arrayBuffer();
            const contentType = getResponse.headers.get('Content-Type') ?? 'application/octet-stream';

            // Put to destination
            const putUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + destBucket + '/objects/' + encodeURIComponent(destKey);
            const putResponse = await fetch(putUrl, {
              method: 'PUT',
              headers: {
                ...cfHeaders,
                'Content-Type': contentType
              },
              body: fileBuffer
            });

            if (putResponse.ok) {
              totalMoved++;
            } else {
              totalFailed++;
            }
          } catch {
            totalFailed++;
          }
        }

        cursor = listData.result_info?.cursor as string | undefined;
        hasMore = cursor !== undefined && objects.length > 0;
        
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // Delete source folder objects
      cursor = undefined;
      hasMore = true;

      while (hasMore) {
        const listUrl = new URL(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects');
        listUrl.searchParams.set('prefix', sourceFolderPath);
        listUrl.searchParams.set('per_page', '100');
        if (cursor !== undefined) {
          listUrl.searchParams.set('cursor', cursor);
        }

        const listResponse = await fetch(listUrl.toString(), { headers: cfHeaders });
        if (!listResponse.ok) break;

        const listData = await listResponse.json() as CloudflareApiResponse<R2ObjectInfo[]>;
        const objects: R2ObjectInfo[] = Array.isArray(listData.result) ? listData.result : [];
        
        if (objects.length === 0) break;

        for (const obj of objects) {
          try {
            const deleteUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(obj.key);
            await fetch(deleteUrl, { method: 'DELETE', headers: cfHeaders });
          } catch {
            // Continue on delete failure
          }
        }

        cursor = listData.result_info?.cursor as string | undefined;
        hasMore = cursor !== undefined && objects.length > 0;
        
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      console.log('[Folders] Moved folder, success:', totalMoved, 'failed:', totalFailed);

      return new Response(JSON.stringify({ 
        success: true, 
        moved: totalMoved, 
        failed: totalFailed 
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (err) {
      console.error('[Folders] Move error:', err);
      return new Response(JSON.stringify({
        error: 'Failed to move folder'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }

  // Delete folder
  if (request.method === 'DELETE' && parts.length >= 5) {
    try {
      const folderPath = decodeURIComponent(parts.slice(4).join('/'));
      const force = url.searchParams.get('force') === 'true';
      
      // Ensure path ends with /
      const folderPathWithSlash = folderPath.endsWith('/') ? folderPath : folderPath + '/';

      console.log('[Folders] Deleting folder:', folderPathWithSlash, 'force:', force);

      // List objects in folder
      const listUrl = new URL(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects');
      listUrl.searchParams.set('prefix', folderPathWithSlash);
      listUrl.searchParams.set('per_page', '100');
      
      const listResponse = await fetch(listUrl.toString(), { headers: cfHeaders });
      if (!listResponse.ok) {
        throw new Error('Failed to list objects: ' + String(listResponse.status));
      }

      const listData = await listResponse.json() as CloudflareApiResponse<R2ObjectInfo[]>;
      const countObjects: R2ObjectInfo[] = Array.isArray(listData.result) ? listData.result : [];
      const fileCount = countObjects.length;

      // If not force mode, return count for confirmation
      if (!force && fileCount > 0) {
        return new Response(JSON.stringify({ 
          success: false,
          fileCount,
          message: 'Folder contains files. Use force=true to delete.'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Delete all objects
      let cursor: string | undefined;
      let totalDeleted = 0;
      let hasMore = true;

      while (hasMore) {
        const deleteListUrl = new URL(CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects');
        deleteListUrl.searchParams.set('prefix', folderPathWithSlash);
        deleteListUrl.searchParams.set('per_page', '100');
        if (cursor !== undefined) {
          deleteListUrl.searchParams.set('cursor', cursor);
        }

        const deleteListResponse = await fetch(deleteListUrl.toString(), { headers: cfHeaders });
        if (!deleteListResponse.ok) break;

        const deleteListData = await deleteListResponse.json() as CloudflareApiResponse<R2ObjectInfo[]>;
        const deleteObjects: R2ObjectInfo[] = Array.isArray(deleteListData.result) ? deleteListData.result : [];
        
        if (deleteObjects.length === 0) break;

        for (const obj of deleteObjects) {
          try {
            const deleteUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects/' + encodeURIComponent(obj.key);
            const deleteResponse = await fetch(deleteUrl, { method: 'DELETE', headers: cfHeaders });
            
            if (deleteResponse.ok) {
              totalDeleted++;
            }
          } catch {
            // Continue on delete failure
          }
        }

        cursor = deleteListData.result_info?.cursor as string | undefined;
        hasMore = cursor !== undefined && deleteObjects.length > 0;
        
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      console.log('[Folders] Deleted folder, removed:', totalDeleted, 'objects');

      return new Response(JSON.stringify({ 
        success: true, 
        deleted: totalDeleted 
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (err) {
      console.error('[Folders] Delete error:', err);
      return new Response(JSON.stringify({
        error: 'Failed to delete folder'
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
