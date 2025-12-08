import type { Env, CloudflareApiResponse } from '../types';
import { logError } from './error-logger';
import { CF_API } from '../types';

interface R2ObjectWithSize {
  key: string;
  size: number;
}

/**
 * Bucket statistics returned by getBucketStats
 */
export interface BucketStats {
  size: number;
  objectCount: number;
}

/**
 * Get Cloudflare API headers with Bearer token authentication
 */
export function getCloudflareHeaders(env: Env): Record<string, string> {
  return {
    'Authorization': `Bearer ${env.API_KEY}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Get bucket statistics (total size and object count) in a single pass
 */
export async function getBucketStats(bucketName: string, env: Env): Promise<BucketStats> {
  const cfHeaders = getCloudflareHeaders(env);

  let totalSize = 0;
  let objectCount = 0;
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    let apiUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects?limit=100';

    if (cursor !== undefined) {
      apiUrl += '&cursor=' + cursor;
    }

    try {
      const response = await fetch(apiUrl, { headers: cfHeaders });

      if (!response.ok) {
        void logError(env, new Error('Failed to list objects: ' + String(response.status)), { module: 'helpers', operation: 'bucket_stats', bucketName }, false);
        return { size: 0, objectCount: 0 };
      }

      const data = await response.json() as CloudflareApiResponse<R2ObjectWithSize[]>;
      const fileList: R2ObjectWithSize[] = Array.isArray(data.result) ? data.result : [];

      for (const obj of fileList) {
        totalSize += obj.size;
        objectCount++;
      }

      cursor = data.result_info?.cursor as string | undefined;
      hasMore = data.result_info?.is_truncated ?? false;

      // Add small delay to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (err) {
      void logError(env, err instanceof Error ? err : new Error(String(err)), { module: 'helpers', operation: 'bucket_stats', bucketName }, false);
      return { size: totalSize, objectCount };
    }
  }

  return { size: totalSize, objectCount };
}
