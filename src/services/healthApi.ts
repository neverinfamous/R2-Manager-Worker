/**
 * R2 Manager Health API Service
 *
 * Frontend service layer for the Health Dashboard.
 * Implements caching per project standards (2 min TTL for metrics).
 */

const WORKER_API =
  (import.meta.env["VITE_WORKER_API"] as string | undefined) ??
  window.location.origin;

// ============================================================================
// TYPES
// ============================================================================

export interface LowActivityBucket {
  bucketName: string;
  lastOperation: string | null;
  daysSinceActivity: number;
}

export interface RecentFailedJob {
  jobId: string;
  bucketName: string;
  operationType: string;
  errorCount: number;
  completedAt: string;
}

export interface HealthSummary {
  buckets: {
    total: number;
    withColors: number;
    withTags: number;
  };
  storage: {
    totalOperations: number;
    fileUploads: number;
    fileDeletes: number;
  };
  recentJobs: {
    last24h: number;
    last7d: number;
    failedLast24h: number;
  };
  webhooks: {
    total: number;
    enabled: number;
  };
  lowActivityBuckets: LowActivityBucket[];
  recentFailedJobs: RecentFailedJob[];
}

// ============================================================================
// CACHING
// ============================================================================

const HEALTH_CACHE_TTL = 2 * 60 * 1000; // 2 minutes (metrics tier)

interface HealthCacheEntry {
  data: HealthSummary;
  timestamp: number;
}

let healthCache: HealthCacheEntry | null = null;

function isCacheValid(): boolean {
  if (!healthCache) return false;
  return Date.now() - healthCache.timestamp < HEALTH_CACHE_TTL;
}

// ============================================================================
// API
// ============================================================================

/**
 * Fetch health summary from the API
 * @param skipCache - If true, bypass the cache and fetch fresh data
 */
export async function fetchHealthSummary(
  skipCache = false,
): Promise<HealthSummary> {
  // Return cached data if valid and not skipping cache
  if (!skipCache && isCacheValid() && healthCache) {
    return healthCache.data;
  }

  const response = await fetch(`${WORKER_API}/api/health`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch health summary: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as HealthSummary;

  // Update cache
  healthCache = {
    data,
    timestamp: Date.now(),
  };

  return data;
}

/**
 * Invalidate the health cache
 */
export function invalidateHealthCache(): void {
  healthCache = null;
}

// ============================================================================
// HEALTH SCORE CALCULATION (R2-SPECIFIC)
// ============================================================================

/**
 * Calculate health score based on R2-specific criteria
 * Returns score (0-100), label, and color class
 */
export function calculateHealthScore(health: HealthSummary): {
  score: number;
  label: string;
  color: string;
} {
  let score = 100;

  // Penalty: Any failed jobs in last 24h (-25)
  if (health.recentJobs.failedLast24h > 0) {
    score -= 25;
  }

  // Penalty: Low webhook coverage (-10 if no webhooks enabled)
  if (health.webhooks.total > 0 && health.webhooks.enabled === 0) {
    score -= 10;
  } else if (health.webhooks.total === 0) {
    score -= 5; // Small penalty for no webhooks configured
  }

  // Penalty: Low color organization (-10 if <50% buckets have colors)
  if (health.buckets.total > 0) {
    const colorCoveragePercent =
      (health.buckets.withColors / health.buckets.total) * 100;
    if (colorCoveragePercent < 50) {
      score -= 10;
    }
  }

  // Penalty: Low tag organization (-10 if <50% buckets have tags)
  if (health.buckets.total > 0) {
    const tagCoveragePercent =
      (health.buckets.withTags / health.buckets.total) * 100;
    if (tagCoveragePercent < 50) {
      score -= 10;
    }
  }

  // Penalty: Many low activity buckets (-5)
  if (health.lowActivityBuckets.length > 3) {
    score -= 5;
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine label and color
  let label: string;
  let color: string;

  if (score >= 90) {
    label = "Healthy";
    color = "text-green-500";
  } else if (score >= 70) {
    label = "Good";
    color = "text-blue-500";
  } else if (score >= 50) {
    label = "Fair";
    color = "text-yellow-500";
  } else {
    label = "Needs Attention";
    color = "text-red-500";
  }

  return { score, label, color };
}
