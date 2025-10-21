/**
 * KV-based caching service for R2 API operations
 * Optimized for bucket listing operations
 * Compatible with Cloudflare Tiered Cache and Cache Reserve
 */

export interface CacheConfig {
  bucketListingTTL: number     // Default: 300 seconds (5 minutes)
  enableCache: boolean          // Default: true
}

export class CacheService {
  private kv: KVNamespace
  private config: CacheConfig

  constructor(kv: KVNamespace, config?: Partial<CacheConfig>) {
    this.kv = kv
    this.config = {
      bucketListingTTL: config?.bucketListingTTL ?? 300,
      enableCache: config?.enableCache ?? true,
    }
  }

  /**
   * Generate cache key for bucket listing
   */
  private getBucketListKey(
    bucket: string, 
    cursor?: string, 
    limit?: number,
    sortBy?: string,
    order?: string
  ): string {
    const parts = [
      'list',
      bucket,
      `cursor:${cursor || 'start'}`,
      `limit:${limit || 1000}`,
      `sort:${sortBy || 'modified'}`,
      `order:${order || 'desc'}`
    ]
    return parts.join(':')
  }

  /**
   * Check if request wants to skip cache
   */
  private shouldSkipCache(request: Request): boolean {
    const url = new URL(request.url)
    return (
      url.searchParams.get('skipCache') === 'true' ||
      request.headers.get('Cache-Control') === 'no-cache'
    )
  }

  /**
   * Get bucket listing from KV cache
   */
  async getBucketListing(
    request: Request,
    bucket: string,
    cursor?: string,
    limit?: number,
    sortBy?: string,
    order?: string
  ): Promise<any | null> {
    if (!this.config.enableCache || this.shouldSkipCache(request)) {
      return null
    }

    try {
      const key = this.getBucketListKey(bucket, cursor, limit, sortBy, order)
      const cached = await this.kv.get(key, 'json')
      
      if (cached) {
        console.log(`KV Cache HIT: Bucket listing ${bucket}`)
        return {
          ...cached,
          _cached: true,
          _cacheType: 'kv-cache',
          _cacheKey: key,
        }
      }
      
      console.log(`KV Cache MISS: Bucket listing ${bucket}`)
      return null
    } catch (error) {
      console.error('KV cache read error:', error)
      return null
    }
  }

  /**
   * Store bucket listing in KV cache
   */
  async setBucketListing(
    bucket: string,
    data: any,
    cursor?: string,
    limit?: number,
    sortBy?: string,
    order?: string
  ): Promise<void> {
    if (!this.config.enableCache) return

    try {
      const key = this.getBucketListKey(bucket, cursor, limit, sortBy, order)
      await this.kv.put(key, JSON.stringify(data), {
        expirationTtl: this.config.bucketListingTTL,
      })
      console.log(`Cached bucket listing: ${bucket} (TTL: ${this.config.bucketListingTTL}s)`)
    } catch (error) {
      console.error('Failed to cache bucket listing:', error)
    }
  }

  /**
   * Invalidate all cached listings for a bucket
   * Uses KV list to find all pagination/sort variants
   */
  async invalidateBucketListing(bucket: string): Promise<void> {
    if (!this.config.enableCache) return

    try {
      // List all keys for this bucket (all pagination pages, all sort orders)
      const prefix = `list:${bucket}:`
      const keys = await this.kv.list({ prefix })
      
      // Delete all cache entries for this bucket
      await Promise.all(
        keys.keys.map((key) => this.kv.delete(key.name))
      )
      
      console.log(`Invalidated bucket listing cache: ${bucket} (${keys.keys.length} entries)`)
    } catch (error) {
      console.error('Bucket listing cache invalidation error:', error)
    }
  }

  /**
   * Invalidate listings for multiple buckets (for move/copy operations)
   */
  async invalidateMultipleBuckets(buckets: string[]): Promise<void> {
    await Promise.all(
      buckets.map(bucket => this.invalidateBucketListing(bucket))
    )
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    kvKeysCount: number
    cacheType: string
    tieredCacheNote: string
  }> {
    try {
      const keys = await this.kv.list()
      return {
        kvKeysCount: keys.keys.length,
        cacheType: 'KV-only (Tiered Cache compatible)',
        tieredCacheNote: 'File content caching handled by R2 Tiered Read Cache',
      }
    } catch (error) {
      console.error('Failed to get cache stats:', error)
      return {
        kvKeysCount: 0,
        cacheType: 'KV-only',
        tieredCacheNote: 'Error retrieving stats',
      }
    }
  }

  /**
   * Clear all caches (admin operation)
   */
  async clearAllCaches(): Promise<number> {
    try {
      // Clear KV storage
      const keys = await this.kv.list()
      await Promise.all(
        keys.keys.map((key) => this.kv.delete(key.name))
      )
      
      const count = keys.keys.length
      console.log(`Cleared all caches: ${count} KV entries deleted`)
      return count
    } catch (error) {
      console.error('Failed to clear all caches:', error)
      throw error
    }
  }

  /**
   * Check if Tiered Cache or Cache Reserve might be available
   * (This is informational only - we can't detect it programmatically)
   */
  getCacheArchitectureInfo(): string {
    return `
This cache service uses KV storage for bucket listing API responses.
R2 file content is automatically cached by R2's built-in Tiered Read Cache.

If you have Tiered Cache or Cache Reserve enabled on your Cloudflare account:
- File downloads are automatically cached at the edge (no additional code needed)
- This KV cache optimizes the bucket listing API calls
- Both systems work together for optimal performance

To check your settings:
- Tiered Cache: Dashboard → Caching → Tiered Cache
- Cache Reserve: Dashboard → Caching → Cache Reserve
    `.trim()
  }
}

