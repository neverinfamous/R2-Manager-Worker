import type { Env } from '../types';
import { CF_API } from '../types';

export async function getBucketSize(bucketName: string, env: Env): Promise<number> {
  const cfHeaders = {
    'X-Auth-Email': env.CF_EMAIL,
    'X-Auth-Key': env.API_KEY
  };

  let totalSize = 0;
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    let apiUrl = CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets/' + bucketName + '/objects?limit=100';
    
    if (cursor) {
      apiUrl += '&cursor=' + cursor;
    }

    try {
      const response = await fetch(apiUrl, { headers: cfHeaders });
      
      if (!response.ok) {
        console.error('[BucketSize] Failed to list objects:', response.status);
        return 0;
      }

      const data = await response.json();
      const fileList = Array.isArray(data.result) ? data.result : (data.result?.objects || []);
      
      for (const obj of fileList) {
        totalSize += obj.size || 0;
      }

      cursor = data.result_info?.cursor;
      hasMore = data.result_info?.is_truncated || false;

      // Add small delay to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (err) {
      console.error('[BucketSize] Error calculating size:', err);
      return totalSize;
    }
  }

  return totalSize;
}

