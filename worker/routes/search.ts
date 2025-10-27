import type { Env } from '../types';
import { CF_API } from '../types';

interface SearchResult {
  key: string;
  bucket: string;
  size: number;
  uploaded: string;
  url: string;
}

interface SearchResponse {
  results: SearchResult[];
  pagination: {
    total: number;
    hasMore: boolean;
  };
}

export async function handleSearchRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: HeadersInit,
  isLocalDev: boolean
): Promise<Response> {
  console.log('[Search] Handling search operation');
  
  if (request.method !== 'GET' || url.pathname !== '/api/search') {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  const cfHeaders = {
    'X-Auth-Email': env.CF_EMAIL,
    'X-Auth-Key': env.API_KEY,
    'Content-Type': 'application/json'
  };

  try {
    // Extract search parameters
    const query = url.searchParams.get('q')?.toLowerCase() || '';
    const extensionsParam = url.searchParams.get('extensions');
    const extensions = extensionsParam ? extensionsParam.split(',').filter(e => e) : [];
    const minSize = url.searchParams.get('minSize') ? parseInt(url.searchParams.get('minSize')!) : null;
    const maxSize = url.searchParams.get('maxSize') ? parseInt(url.searchParams.get('maxSize')!) : null;
    const startDate = url.searchParams.get('startDate') ? new Date(url.searchParams.get('startDate')!) : null;
    const endDate = url.searchParams.get('endDate') ? new Date(url.searchParams.get('endDate')!) : null;
    const limit = parseInt(url.searchParams.get('limit') || '100');

    console.log('[Search] Parameters:', { query, extensions, minSize, maxSize, startDate, endDate, limit });

    // Mock response for local development
    if (isLocalDev) {
      console.log('[Search] Using mock data for local development');
      return new Response(JSON.stringify({
        results: [],
        pagination: {
          total: 0,
          hasMore: false
        }
      } as SearchResponse), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Get list of all buckets
    const bucketsResponse = await fetch(
      CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets',
      { headers: cfHeaders }
    );
    const bucketsData = await bucketsResponse.json();
    
    // Filter out system buckets
    const systemBuckets = ['r2-bucket', 'sqlite-mcp-server-wiki', 'blog-wiki'];
    const buckets = (bucketsData.result.buckets || [])
      .filter((b: { name: string }) => !systemBuckets.includes(b.name))
      .map((b: { name: string }) => b.name);

    console.log('[Search] Searching across', buckets.length, 'buckets');

    // Fetch files from all buckets in parallel
    const bucketFilePromises = buckets.map(async (bucketName: string) => {
      try {
        const listUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects'
          + '?include=customMetadata,httpMetadata'
          + '&per_page=1000'; // Get up to 1000 files per bucket

        const response = await fetch(listUrl, { headers: cfHeaders });
        
        if (!response.ok) {
          console.error('[Search] Failed to list files in bucket:', bucketName);
          return [];
        }

        const data = await response.json();
        const objects = Array.isArray(data.result) ? data.result : [];
        
        // Map files with bucket name
        return objects.map((obj: { key: string; size?: number; uploaded?: string }) => ({
          key: obj.key,
          bucket: bucketName,
          size: obj.size || 0,
          uploaded: obj.uploaded || new Date().toISOString(),
          url: `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}/${obj.key}`
        }));
      } catch (err) {
        console.error('[Search] Error fetching files from bucket:', bucketName, err);
        return [];
      }
    });

    const allBucketFiles = await Promise.all(bucketFilePromises);
    const allFiles: SearchResult[] = allBucketFiles.flat();

    console.log('[Search] Total files found:', allFiles.length);

    // Filter files based on search criteria
    const filteredFiles = allFiles.filter((file) => {
      // Filename filter
      const fileName = file.key.split('/').pop() || file.key;
      if (query && !fileName.toLowerCase().includes(query)) {
        return false;
      }

      // Extension filter
      if (extensions.length > 0) {
        const fileExt = fileName.includes('.') 
          ? '.' + fileName.split('.').pop()!.toLowerCase() 
          : '';
        if (!extensions.includes(fileExt)) {
          return false;
        }
      }

      // Size filter
      if (minSize !== null && file.size < minSize) {
        return false;
      }
      if (maxSize !== null && file.size > maxSize) {
        return false;
      }

      // Date filter
      if (startDate || endDate) {
        const fileDate = new Date(file.uploaded);
        if (startDate && fileDate < startDate) {
          return false;
        }
        if (endDate && fileDate > endDate) {
          return false;
        }
      }

      return true;
    });

    console.log('[Search] Filtered to', filteredFiles.length, 'results');

    // Sort by uploaded date (newest first)
    filteredFiles.sort((a, b) => {
      return new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime();
    });

    // Apply pagination
    const paginatedResults = filteredFiles.slice(0, limit);

    const response: SearchResponse = {
      results: paginatedResults,
      pagination: {
        total: filteredFiles.length,
        hasMore: filteredFiles.length > limit
      }
    };

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (err) {
    console.error('[Search] Search error:', err);
    return new Response(JSON.stringify({ 
      error: 'Search failed',
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

