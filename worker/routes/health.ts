/**
 * R2 Manager Health Dashboard Route Handler
 *
 * Provides a health summary API for the R2 Manager dashboard,
 * including bucket stats, job history, and webhook coverage.
 */

import type { Env } from '../types';
import { logInfo, logWarning, createErrorContext } from '../utils/error-logger';

// ============================================================================
// TYPES
// ============================================================================

interface LowActivityBucket {
    bucketName: string;
    lastOperation: string | null;
    daysSinceActivity: number;
}

interface RecentFailedJob {
    jobId: string;
    bucketName: string;
    operationType: string;
    errorCount: number;
    completedAt: string;
}

interface HealthSummary {
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
// MOCK DATA
// ============================================================================

const MOCK_HEALTH: HealthSummary = {
    buckets: {
        total: 5,
        withColors: 3,
        withTags: 4,
    },
    storage: {
        totalOperations: 2847,
        fileUploads: 1523,
        fileDeletes: 324,
    },
    recentJobs: {
        last24h: 15,
        last7d: 67,
        failedLast24h: 1,
    },
    webhooks: {
        total: 3,
        enabled: 2,
    },
    lowActivityBuckets: [
        {
            bucketName: 'legacy-archive',
            lastOperation: new Date(Date.now() - 86400000 * 14).toISOString(),
            daysSinceActivity: 14,
        },
    ],
    recentFailedJobs: [
        {
            jobId: 'job-123',
            bucketName: 'my-bucket',
            operationType: 'bulk_delete',
            errorCount: 3,
            completedAt: new Date(Date.now() - 3600000).toISOString(),
        },
    ],
};

// ============================================================================
// TYPES FOR CORS HEADERS
// ============================================================================

type CorsHeaders = Record<string, string>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function jsonResponse(data: unknown, corsHeaders: CorsHeaders): Response {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
}

function errorResponse(message: string, corsHeaders: CorsHeaders, status = 500): Response {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function handleHealthRoutes(
    request: Request,
    env: Env,
    url: URL,
    corsHeaders: CorsHeaders,
    isLocalDev: boolean,
    _userEmail: string | null
): Promise<Response | null> {
    const method = request.method;
    const path = url.pathname;

    // GET /api/health - Get health summary
    if (method === 'GET' && path === '/api/health') {
        return getHealthSummary(env, corsHeaders, isLocalDev);
    }

    return null;
}

// ============================================================================
// HEALTH SUMMARY
// ============================================================================

async function getHealthSummary(
    env: Env,
    corsHeaders: CorsHeaders,
    isLocalDev: boolean
): Promise<Response> {
    const ctx = createErrorContext('health', 'get_summary');

    if (isLocalDev) {
        logInfo('Returning mock health data for local dev', ctx);
        return jsonResponse(MOCK_HEALTH, corsHeaders);
    }

    // Check if D1 database is available
    if (!env.METADATA) {
        logWarning('D1 database not configured, returning empty health data', ctx);
        return jsonResponse({
            buckets: { total: 0, withColors: 0, withTags: 0 },
            storage: { totalOperations: 0, fileUploads: 0, fileDeletes: 0 },
            recentJobs: { last24h: 0, last7d: 0, failedLast24h: 0 },
            webhooks: { total: 0, enabled: 0 },
            lowActivityBuckets: [],
            recentFailedJobs: [],
        }, corsHeaders);
    }

    try {
        // Parallelized D1 queries for performance (following kv-manager/do-manager pattern)
        const [
            bucketColorsResult,
            bucketTagsResult,
            auditStatsResult,
            jobsResult,
            webhooksResult,
            lowActivityResult,
            failedJobsResult,
        ] = await Promise.all([
            // Query 1: Bucket colors count
            safeQuery(env, `
                SELECT COUNT(DISTINCT bucket_name) as withColors
                FROM bucket_colors
            `),

            // Query 2: Bucket tags count
            safeQuery(env, `
                SELECT COUNT(DISTINCT bucket_name) as withTags
                FROM bucket_tags
            `),

            // Query 3: Audit log stats (operations in last 7 days)
            safeQuery(env, `
                SELECT
                    COUNT(*) as totalOperations,
                    SUM(CASE WHEN operation_type = 'file_upload' THEN 1 ELSE 0 END) as fileUploads,
                    SUM(CASE WHEN operation_type = 'file_delete' THEN 1 ELSE 0 END) as fileDeletes
                FROM audit_log
                WHERE datetime(timestamp) > datetime('now', '-7 days')
            `),

            // Query 4: Job history counts
            safeQuery(env, `
                SELECT
                    SUM(CASE WHEN datetime(started_at) > datetime('now', '-1 day') THEN 1 ELSE 0 END) as last24h,
                    SUM(CASE WHEN datetime(started_at) > datetime('now', '-7 days') THEN 1 ELSE 0 END) as last7d,
                    SUM(CASE WHEN datetime(started_at) > datetime('now', '-1 day') AND status = 'failed' THEN 1 ELSE 0 END) as failedLast24h
                FROM bulk_jobs
            `),

            // Query 5: Webhook counts
            safeQuery(env, `
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled
                FROM webhooks
            `),

            // Query 6: Low activity buckets (no operations in 7+ days)
            safeQueryAll(env, `
                SELECT
                    bucket_name as bucketName,
                    MAX(timestamp) as lastOperation
                FROM audit_log
                GROUP BY bucket_name
                HAVING datetime(MAX(timestamp)) < datetime('now', '-7 days')
                ORDER BY lastOperation ASC
                LIMIT 10
            `),

            // Query 7: Recent failed jobs (limit 10)
            safeQueryAll(env, `
                SELECT
                    job_id as jobId,
                    bucket_name as bucketName,
                    operation_type as operationType,
                    error_count as errorCount,
                    completed_at as completedAt
                FROM bulk_jobs
                WHERE status = 'failed'
                    AND datetime(completed_at) > datetime('now', '-7 days')
                ORDER BY completed_at DESC
                LIMIT 10
            `),
        ]);

        // Get total unique buckets from both colors and tags tables
        const uniqueBucketsResult = await safeQuery(env, `
            SELECT COUNT(DISTINCT bucket_name) as total FROM (
                SELECT bucket_name FROM bucket_colors
                UNION
                SELECT bucket_name FROM bucket_tags
                UNION
                SELECT bucket_name FROM audit_log
            )
        `);

        // Helper to safely convert unknown to string
        const asString = (value: unknown, defaultVal = ''): string => {
            if (value === null || value === undefined) return defaultVal;
            if (typeof value === 'string') return value;
            if (typeof value === 'number' || typeof value === 'boolean') return String(value);
            return defaultVal;
        };

        // Helper to safely convert unknown to number
        const asNumber = (value: unknown, defaultVal = 0): number => {
            if (value === null || value === undefined) return defaultVal;
            if (typeof value === 'number') return value;
            if (typeof value === 'string') {
                const parsed = Number(value);
                return isNaN(parsed) ? defaultVal : parsed;
            }
            return defaultVal;
        };

        // Build health summary with graceful defaults for any failed queries
        const health: HealthSummary = {
            buckets: {
                total: asNumber(uniqueBucketsResult?.['total']),
                withColors: asNumber(bucketColorsResult?.['withColors']),
                withTags: asNumber(bucketTagsResult?.['withTags']),
            },
            storage: {
                totalOperations: asNumber(auditStatsResult?.['totalOperations']),
                fileUploads: asNumber(auditStatsResult?.['fileUploads']),
                fileDeletes: asNumber(auditStatsResult?.['fileDeletes']),
            },
            recentJobs: {
                last24h: asNumber(jobsResult?.['last24h']),
                last7d: asNumber(jobsResult?.['last7d']),
                failedLast24h: asNumber(jobsResult?.['failedLast24h']),
            },
            webhooks: {
                total: asNumber(webhooksResult?.['total']),
                enabled: asNumber(webhooksResult?.['enabled']),
            },
            lowActivityBuckets: (lowActivityResult ?? []).map((row: Record<string, unknown>) => {
                const lastOp = row['lastOperation'];
                const lastOpStr = asString(lastOp);
                return {
                    bucketName: asString(row['bucketName']),
                    lastOperation: lastOpStr || null,
                    daysSinceActivity: lastOpStr
                        ? Math.floor((Date.now() - new Date(lastOpStr).getTime()) / 86400000)
                        : 0,
                };
            }),
            recentFailedJobs: (failedJobsResult ?? []).map((row: Record<string, unknown>) => ({
                jobId: asString(row['jobId']),
                bucketName: asString(row['bucketName']),
                operationType: asString(row['operationType']),
                errorCount: asNumber(row['errorCount']),
                completedAt: asString(row['completedAt']),
            })),
        };


        logInfo('Health summary fetched successfully', ctx);
        return jsonResponse(health, corsHeaders);
    } catch (error) {
        logWarning(`Failed to get health summary: ${error instanceof Error ? error.message : String(error)}`, {
            ...ctx,
            metadata: { error: error instanceof Error ? error.message : String(error) },
        });
        return errorResponse('Failed to get health summary', corsHeaders, 500);
    }
}

// ============================================================================
// SAFE QUERY HELPERS (Graceful Degradation)
// ============================================================================

/**
 * Execute a D1 query with graceful error handling.
 * Returns null if the query fails (e.g., table doesn't exist).
 */
async function safeQuery(
    env: Env,
    query: string
): Promise<Record<string, unknown> | null> {
    if (!env.METADATA) return null;
    try {
        const result = await env.METADATA.prepare(query).first();
        return result as Record<string, unknown> | null;
    } catch (error) {
        logWarning(`Safe query failed: ${error instanceof Error ? error.message : String(error)}`, {
            module: 'health',
            operation: 'safe_query',
            metadata: { query: query.substring(0, 100) },
        });
        return null;
    }
}

/**
 * Execute a D1 query returning multiple rows with graceful error handling.
 * Returns empty array if the query fails.
 */
async function safeQueryAll(
    env: Env,
    query: string
): Promise<Record<string, unknown>[]> {
    if (!env.METADATA) return [];
    try {
        const result = await env.METADATA.prepare(query).all();
        return result.results as Record<string, unknown>[];
    } catch (error) {
        logWarning(`Safe query all failed: ${error instanceof Error ? error.message : String(error)}`, {
            module: 'health',
            operation: 'safe_query_all',
            metadata: { query: query.substring(0, 100) },
        });
        return [];
    }
}
