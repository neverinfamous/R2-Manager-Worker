import type {
    Env,
    MetricsTimeRange,
    MetricsResponse,
    MetricsDataPoint,
    StorageDataPoint,
    BucketMetricsSummary,
    GraphQLResponse,
    R2AnalyticsResult
} from '../types';
import { logInfo, logError } from '../utils/error-logger';

const GRAPHQL_API = 'https://api.cloudflare.com/client/v4/graphql';

/**
 * Helper to create response headers with CORS
 */
function jsonHeaders(corsHeaders: HeadersInit): Headers {
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', 'application/json');
    return headers;
}

/**
 * Calculate date range based on time range string
 */
function getDateRange(timeRange: MetricsTimeRange): { start: string; end: string } {
    const end = new Date();
    const start = new Date();

    switch (timeRange) {
        case '24h':
            start.setHours(start.getHours() - 24);
            break;
        case '7d':
            start.setDate(start.getDate() - 7);
            break;
        case '30d':
            start.setDate(start.getDate() - 30);
            break;
    }

    return {
        start: start.toISOString().split('T')[0] ?? '',
        end: end.toISOString().split('T')[0] ?? ''
    };
}

/**
 * Build GraphQL query for R2 analytics
 */
function buildAnalyticsQuery(accountId: string, start: string, end: string, bucketName?: string): string {
    const bucketFilter = bucketName ? `, bucketName: "${bucketName}"` : '';
    return `
    query R2Metrics {
      viewer {
        accounts(filter: { accountTag: "${accountId}" }) {
          r2OperationsAdaptiveGroups(
            limit: 10000
            filter: { date_geq: "${start}", date_leq: "${end}"${bucketFilter} }
            orderBy: [date_DESC]
          ) {
            sum {
              requests
            }
            dimensions {
              date
              bucketName
              actionType
            }
          }
          r2StorageAdaptiveGroups(
            limit: 10000
            filter: { date_geq: "${start}", date_leq: "${end}"${bucketFilter} }
            orderBy: [date_DESC]
          ) {
            max {
              payloadSize
              metadataSize
              objectCount
            }
            dimensions {
              date
              bucketName
            }
          }
        }
      }
    }
  `;
}

/**
 * Execute GraphQL query against Cloudflare Analytics API
 */
async function executeGraphQLQuery(
    env: Env,
    query: string,
    isLocalDev: boolean
): Promise<R2AnalyticsResult | null> {
    const cfHeaders = {
        'Authorization': `Bearer ${env.API_KEY}`,
        'Content-Type': 'application/json'
    };

    try {
        logInfo('Executing GraphQL analytics query', { module: 'metrics', operation: 'graphql_query' });

        const response = await fetch(GRAPHQL_API, {
            method: 'POST',
            headers: cfHeaders,
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            const errorText = await response.text();
            await logError(env, new Error(`GraphQL API error: ${response.status} ${errorText}`), { module: 'metrics', operation: 'graphql_query', metadata: { status: response.status } }, isLocalDev);
            return null;
        }

        const result: GraphQLResponse<R2AnalyticsResult> = await response.json();

        if (result.errors && result.errors.length > 0) {
            const errorMessages = result.errors.map(e => e.message).join(', ');
            await logError(env, new Error(`GraphQL errors: ${errorMessages}`), { module: 'metrics', operation: 'graphql_query' }, isLocalDev);
            return null;
        }

        return result.data ?? null;
    } catch (err) {
        await logError(env, err instanceof Error ? err : String(err), { module: 'metrics', operation: 'graphql_query' }, isLocalDev);
        return null;
    }
}

/**
 * Process raw GraphQL results into structured metrics response
 */
function processMetricsData(
    data: R2AnalyticsResult,
    timeRange: MetricsTimeRange,
    startDate: string,
    endDate: string
): MetricsResponse {
    const accounts = data.viewer.accounts;
    if (accounts === undefined || accounts.length === 0) {
        return generateEmptyMetrics(timeRange, startDate, endDate);
    }

    const account = accounts[0];
    if (!account) {
        return generateEmptyMetrics(timeRange, startDate, endDate);
    }

    const operationsData = account.r2OperationsAdaptiveGroups ?? [];
    const storageData = account.r2StorageAdaptiveGroups ?? [];

    // Aggregate metrics by bucket
    const bucketMap = new Map<string, BucketMetricsSummary>();

    // Process operations data
    for (const op of operationsData) {
        const bucketName = op.dimensions.bucketName;
        const actionType = op.dimensions.actionType;
        const requests = op.sum.requests;

        if (!bucketMap.has(bucketName)) {
            bucketMap.set(bucketName, {
                bucketName,
                totalReadOperations: 0,
                totalWriteOperations: 0,
                totalBytesUploaded: 0,
                totalBytesDownloaded: 0,
                classAOperations: 0,
                classBOperations: 0,
                currentStorageBytes: 0
            });
        }

        const bucket = bucketMap.get(bucketName);
        if (!bucket) continue;

        // Classify operations
        // Class A: PutObject, CopyObject, CompleteMultipartUpload, CreateMultipartUpload, UploadPart, ListBuckets, PutBucketEncryption, PutBucketCors, PutBucketLifecycleConfiguration
        // Class B: GetObject, HeadObject, HeadBucket, ListObjects, ListObjectsV2, ListMultipartUploads, ListParts
        const classAActions = ['PutObject', 'CopyObject', 'CompleteMultipartUpload', 'CreateMultipartUpload', 'UploadPart', 'ListBuckets'];
        const classBActions = ['GetObject', 'HeadObject', 'HeadBucket', 'ListObjects', 'ListObjectsV2'];
        const writeActions = ['PutObject', 'CopyObject', 'CompleteMultipartUpload', 'CreateMultipartUpload', 'UploadPart', 'DeleteObject'];

        if (classAActions.includes(actionType)) {
            bucket.classAOperations += requests;
        }
        if (classBActions.includes(actionType)) {
            bucket.classBOperations += requests;
        }
        if (writeActions.includes(actionType)) {
            bucket.totalWriteOperations += requests;
        } else {
            bucket.totalReadOperations += requests;
        }
    }

    // Process storage data
    for (const storage of storageData) {
        const bucketName = storage.dimensions.bucketName;
        const totalSize = (storage.max.payloadSize ?? 0) + (storage.max.metadataSize ?? 0);

        if (bucketMap.has(bucketName)) {
            const bucket = bucketMap.get(bucketName);
            if (bucket) {
                bucket.currentStorageBytes = Math.max(bucket.currentStorageBytes ?? 0, totalSize);
            }
        } else {
            bucketMap.set(bucketName, {
                bucketName,
                totalReadOperations: 0,
                totalWriteOperations: 0,
                totalBytesUploaded: 0,
                totalBytesDownloaded: 0,
                classAOperations: 0,
                classBOperations: 0,
                currentStorageBytes: totalSize
            });
        }
    }

    const byBucket = Array.from(bucketMap.values());

    // Build time series data
    const timeSeriesMap = new Map<string, Map<string, MetricsDataPoint>>();

    for (const op of operationsData) {
        const date = op.dimensions.date;
        const bucketName = op.dimensions.bucketName;

        if (!timeSeriesMap.has(date)) {
            timeSeriesMap.set(date, new Map());
        }

        const dateMap = timeSeriesMap.get(date);
        if (!dateMap) continue;
        if (!dateMap.has(bucketName)) {
            dateMap.set(bucketName, {
                date,
                bucketName,
                readOperations: 0,
                writeOperations: 0,
                bytesUploaded: 0,
                bytesDownloaded: 0,
                classAOperations: 0,
                classBOperations: 0
            });
        }

        const point = dateMap.get(bucketName);
        if (!point) continue;
        const actionType = op.dimensions.actionType;
        const requests = op.sum.requests;

        const writeActions = ['PutObject', 'CopyObject', 'CompleteMultipartUpload', 'CreateMultipartUpload', 'UploadPart', 'DeleteObject'];
        if (writeActions.includes(actionType)) {
            point.writeOperations += requests;
        } else {
            point.readOperations += requests;
        }
    }

    const timeSeries: MetricsDataPoint[] = [];
    for (const dateMap of timeSeriesMap.values()) {
        timeSeries.push(...Array.from(dateMap.values()));
    }
    timeSeries.sort((a, b) => a.date.localeCompare(b.date));

    // Build storage series
    const storageSeries: StorageDataPoint[] = storageData.map(s => ({
        date: s.dimensions.date,
        bucketName: s.dimensions.bucketName,
        storageBytes: (s.max.payloadSize ?? 0) + (s.max.metadataSize ?? 0),
        objectCount: s.max.objectCount ?? 0
    }));
    storageSeries.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate summary
    const totalReadOperations = byBucket.reduce((sum, b) => sum + b.totalReadOperations, 0);
    const totalWriteOperations = byBucket.reduce((sum, b) => sum + b.totalWriteOperations, 0);
    const totalStorageBytes = byBucket.reduce((sum, b) => sum + (b.currentStorageBytes ?? 0), 0);

    // Calculate total object count from latest storage data per bucket
    const latestObjectCounts = new Map<string, number>();
    for (const s of storageData) {
        if (!latestObjectCounts.has(s.dimensions.bucketName)) {
            latestObjectCounts.set(s.dimensions.bucketName, s.max.objectCount ?? 0);
        }
    }
    const totalObjectCount = Array.from(latestObjectCounts.values()).reduce((sum, count) => sum + count, 0);

    return {
        summary: {
            timeRange,
            startDate,
            endDate,
            totalReadOperations,
            totalWriteOperations,
            totalBytesUploaded: 0, // Not available in current API
            totalBytesDownloaded: 0, // Not available in current API
            totalStorageBytes,
            totalObjectCount,
            bucketCount: byBucket.length
        },
        byBucket,
        timeSeries,
        storageSeries
    };
}

/**
 * Generate empty metrics response
 */
function generateEmptyMetrics(
    timeRange: MetricsTimeRange,
    startDate: string,
    endDate: string
): MetricsResponse {
    return {
        summary: {
            timeRange,
            startDate,
            endDate,
            totalReadOperations: 0,
            totalWriteOperations: 0,
            totalBytesUploaded: 0,
            totalBytesDownloaded: 0,
            totalStorageBytes: 0,
            bucketCount: 0
        },
        byBucket: [],
        timeSeries: [],
        storageSeries: []
    };
}

/**
 * Generate mock metrics for local development
 */
function generateMockMetrics(timeRange: MetricsTimeRange): MetricsResponse {
    const { start, end } = getDateRange(timeRange);
    const mockBuckets = ['assets', 'backups', 'media', 'logs'];

    const byBucket: BucketMetricsSummary[] = mockBuckets.map(name => ({
        bucketName: name,
        totalReadOperations: Math.floor(Math.random() * 10000) + 1000,
        totalWriteOperations: Math.floor(Math.random() * 5000) + 500,
        totalBytesUploaded: Math.floor(Math.random() * 1024 * 1024 * 1024),
        totalBytesDownloaded: Math.floor(Math.random() * 1024 * 1024 * 1024 * 2),
        classAOperations: Math.floor(Math.random() * 5000) + 500,
        classBOperations: Math.floor(Math.random() * 10000) + 1000,
        currentStorageBytes: Math.floor(Math.random() * 10 * 1024 * 1024 * 1024)
    }));

    const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30;
    const timeSeries: MetricsDataPoint[] = [];
    const storageSeries: StorageDataPoint[] = [];

    for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - i - 1));
        const dateStr = date.toISOString().split('T')[0] ?? '';

        for (const bucket of mockBuckets) {
            timeSeries.push({
                date: dateStr,
                bucketName: bucket,
                readOperations: Math.floor(Math.random() * 1000) + 100,
                writeOperations: Math.floor(Math.random() * 500) + 50,
                bytesUploaded: Math.floor(Math.random() * 100 * 1024 * 1024),
                bytesDownloaded: Math.floor(Math.random() * 200 * 1024 * 1024),
                classAOperations: Math.floor(Math.random() * 500) + 50,
                classBOperations: Math.floor(Math.random() * 1000) + 100
            });

            storageSeries.push({
                date: dateStr,
                bucketName: bucket,
                storageBytes: Math.floor(Math.random() * 10 * 1024 * 1024 * 1024),
                objectCount: Math.floor(Math.random() * 200) + 50
            });
        }
    }

    const totalReadOperations = byBucket.reduce((sum, b) => sum + b.totalReadOperations, 0);
    const totalWriteOperations = byBucket.reduce((sum, b) => sum + b.totalWriteOperations, 0);
    const totalBytesUploaded = byBucket.reduce((sum, b) => sum + b.totalBytesUploaded, 0);
    const totalBytesDownloaded = byBucket.reduce((sum, b) => sum + b.totalBytesDownloaded, 0);
    const totalStorageBytes = byBucket.reduce((sum, b) => sum + (b.currentStorageBytes ?? 0), 0);

    return {
        summary: {
            timeRange,
            startDate: start,
            endDate: end,
            totalReadOperations,
            totalWriteOperations,
            totalBytesUploaded,
            totalBytesDownloaded,
            totalStorageBytes,
            totalObjectCount: mockBuckets.length * 150, // ~150 objects per bucket
            bucketCount: mockBuckets.length
        },
        byBucket,
        timeSeries,
        storageSeries
    };
}

/**
 * Handle metrics API routes
 */
export async function handleMetricsRoutes(
    request: Request,
    env: Env,
    url: URL,
    corsHeaders: HeadersInit,
    isLocalDev: boolean
): Promise<Response | null> {
    // GET /api/metrics - Get R2 analytics
    if (request.method === 'GET' && url.pathname === '/api/metrics') {
        const timeRange = (url.searchParams.get('range') ?? '7d') as MetricsTimeRange;
        const bucketName = url.searchParams.get('bucketName') ?? undefined;

        // Validate time range
        if (!['24h', '7d', '30d'].includes(timeRange)) {
            return new Response(JSON.stringify({
                error: 'Invalid time range',
                message: 'Time range must be one of: 24h, 7d, 30d'
            }), {
                status: 400,
                headers: jsonHeaders(corsHeaders)
            });
        }

        logInfo(`Fetching R2 metrics for range: ${timeRange}${bucketName ? ` (filtered: ${bucketName})` : ''}`, { module: 'metrics', operation: 'get_metrics', metadata: { timeRange, bucketName } });

        // Return mock data for local development
        if (isLocalDev) {
            logInfo('Using mock metrics data for local development', { module: 'metrics', operation: 'get_metrics' });

            return new Response(JSON.stringify({
                result: generateMockMetrics(timeRange),
                success: true
            }), {
                headers: jsonHeaders(corsHeaders)
            });
        }

        const { start, end } = getDateRange(timeRange);
        const query = buildAnalyticsQuery(env.ACCOUNT_ID, start, end, bucketName);

        const analyticsData = await executeGraphQLQuery(env, query, isLocalDev);

        if (!analyticsData) {
            return new Response(JSON.stringify({
                error: 'Failed to fetch metrics',
                message: 'Unable to retrieve analytics data from Cloudflare. This may be a permissions issue with your API token.',
                success: false
            }), {
                status: 500,
                headers: jsonHeaders(corsHeaders)
            });
        }

        const metrics = processMetricsData(analyticsData, timeRange, start, end);

        logInfo('Successfully retrieved R2 metrics', {
            module: 'metrics',
            operation: 'get_metrics',
            metadata: {
                bucketCount: metrics.summary.bucketCount,
                totalOperations: metrics.summary.totalReadOperations + metrics.summary.totalWriteOperations
            }
        });

        return new Response(JSON.stringify({
            result: metrics,
            success: true
        }), {
            headers: jsonHeaders(corsHeaders)
        });
    }

    // Route not handled
    return null;
}
