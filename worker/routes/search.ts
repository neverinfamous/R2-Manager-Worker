import type { Env, CloudflareApiResponse, BucketsListResult } from '../types';
import { CF_API } from '../types';
import { getCloudflareHeaders } from '../utils/helpers';
import { logInfo, logError } from '../utils/error-logger';

interface R2ObjectResult {
  key: string;
  size: number;
  uploaded?: string;
}

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
  logInfo('Handling search operation', { module: 'search', operation: 'search' });

  if (request.method !== 'GET' || url.pathname !== '/api/search') {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  const cfHeaders = getCloudflareHeaders(env);

  try {
    // Extract search parameters
    const query = url.searchParams.get('q')?.toLowerCase() ?? '';
    const extensionsParam = url.searchParams.get('extensions');
    const extensions = extensionsParam !== null ? extensionsParam.split(',').filter(e => e !== '') : [];
    const minSizeParam = url.searchParams.get('minSize');
    const maxSizeParam = url.searchParams.get('maxSize');
    const startDateParam = url.searchParams.get('startDate');
    const endDateParam = url.searchParams.get('endDate');
    const minSize = minSizeParam !== null ? parseInt(minSizeParam) : null;
    const maxSize = maxSizeParam !== null ? parseInt(maxSizeParam) : null;
    const startDate = startDateParam !== null ? new Date(startDateParam) : null;
    const endDate = endDateParam !== null ? new Date(endDateParam) : null;
    const limit = parseInt(url.searchParams.get('limit') ?? '100');

    logInfo('Search parameters', { module: 'search', operation: 'search', metadata: { query, extensions, minSize, maxSize, startDate, endDate, limit } });

    // Mock response for local development
    if (isLocalDev) {
      logInfo('Using mock data for local development', { module: 'search', operation: 'search' });
      return new Response(JSON.stringify({
        results: [],
        pagination: {
          total: 0,
          hasMore: false
        }
      } satisfies SearchResponse), {
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
    const bucketsData = await bucketsResponse.json() as CloudflareApiResponse<BucketsListResult>;

    // Filter out system buckets
    const systemBuckets = ['r2-bucket', 'sqlite-mcp-server-wiki', 'blog-wiki', 'kv-manager-backups', 'do-manager-backups', 'd1-manager-backups', 'container-manager-helloworld', 'container-manager-snapshots', 'worker-manager-backups'];
    const buckets = (bucketsData.result?.buckets ?? [])
      .filter((b: { name: string }) => !systemBuckets.includes(b.name))
      .map((b: { name: string }) => b.name);

    logInfo(`Searching across ${buckets.length} buckets`, { module: 'search', operation: 'search', metadata: { bucketCount: buckets.length } });

    // Fetch files from all buckets in parallel
    const bucketFilePromises = buckets.map(async (bucketName: string) => {
      try {
        const listUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects'
          + '?include=customMetadata,httpMetadata'
          + '&per_page=1000'; // Get up to 1000 files per bucket

        const response = await fetch(listUrl, { headers: cfHeaders });

        if (!response.ok) {
          await logError(env, new Error(`Failed to list files in bucket: ${bucketName}`), { module: 'search', operation: 'search', bucketName }, isLocalDev);
          return [];
        }

        const data = await response.json() as CloudflareApiResponse<R2ObjectResult[]>;
        const objects: R2ObjectResult[] = Array.isArray(data.result) ? data.result : [];

        // Map files with bucket name
        return objects.map((obj: R2ObjectResult) => ({
          key: obj.key,
          bucket: bucketName,
          size: obj.size,
          uploaded: obj.uploaded ?? new Date().toISOString(),
          url: `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}/${obj.key}`
        }));
      } catch (err) {
        await logError(env, err instanceof Error ? err : String(err), { module: 'search', operation: 'search', bucketName }, isLocalDev);
        return [];
      }
    });

    const allBucketFiles = await Promise.all(bucketFilePromises);
    const allFiles: SearchResult[] = allBucketFiles.flat();

    logInfo(`Total files found: ${allFiles.length}`, { module: 'search', operation: 'search', metadata: { totalFiles: allFiles.length } });

    // Filter files based on search criteria
    const filteredFiles = allFiles.filter((file) => {
      // Filename filter
      const fileName = file.key.split('/').pop() ?? file.key;
      if (query !== '' && !fileName.toLowerCase().includes(query)) {
        return false;
      }

      // Extension filter
      if (extensions.length > 0) {
        const fileExt = fileName.includes('.')
          ? '.' + (fileName.split('.').pop() ?? '').toLowerCase()
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
      if (startDate !== null || endDate !== null) {
        const fileDate = new Date(file.uploaded);
        if (startDate !== null && fileDate < startDate) {
          return false;
        }
        if (endDate !== null && fileDate > endDate) {
          return false;
        }
      }

      return true;
    });

    logInfo(`Filtered to ${filteredFiles.length} results`, { module: 'search', operation: 'search', metadata: { resultCount: filteredFiles.length } });

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
    await logError(env, err instanceof Error ? err : String(err), { module: 'search', operation: 'search' }, isLocalDev);
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
