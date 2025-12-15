import { useState, useEffect, useCallback } from 'react';
import {
    BarChart3,
    HardDrive,
    RefreshCw,
    Loader2,
    Activity,
    Package
} from 'lucide-react';
import { MetricsChart, MetricsBarChart } from './MetricsChart';

// Types
type MetricsTimeRange = '24h' | '7d' | '30d';

interface MetricsDataPoint {
    date: string;
    bucketName: string;
    readOperations: number;
    writeOperations: number;
    bytesUploaded: number;
    bytesDownloaded: number;
    classAOperations: number;
    classBOperations: number;
}

interface BucketMetricsSummary {
    bucketName: string;
    totalReadOperations: number;
    totalWriteOperations: number;
    totalBytesUploaded: number;
    totalBytesDownloaded: number;
    classAOperations: number;
    classBOperations: number;
    currentStorageBytes?: number;
}

interface MetricsResponse {
    summary: {
        timeRange: MetricsTimeRange;
        startDate: string;
        endDate: string;
        totalReadOperations: number;
        totalWriteOperations: number;
        totalBytesUploaded: number;
        totalBytesDownloaded: number;
        totalStorageBytes: number;
        bucketCount: number;
    };
    byBucket: BucketMetricsSummary[];
    timeSeries: MetricsDataPoint[];
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i] ?? 'B'}`;
}

/**
 * Format large numbers with K, M, B suffixes
 */
function formatNumber(num: number): string {
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toLocaleString();
}

/**
 * Aggregate time series data by date
 */
function aggregateByDate(data: MetricsDataPoint[]): { date: string; reads: number; writes: number }[] {
    const byDate = new Map<string, { reads: number; writes: number }>();

    for (const point of data) {
        const existing = byDate.get(point.date);
        if (existing) {
            existing.reads += point.readOperations;
            existing.writes += point.writeOperations;
        } else {
            byDate.set(point.date, {
                reads: point.readOperations,
                writes: point.writeOperations
            });
        }
    }

    return Array.from(byDate.entries())
        .map(([date, values]) => ({ date, ...values }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Format date for display on chart axis
 */
function formatDateLabel(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface MetricsDashboardProps {
    onClose: () => void;
}

const API_BASE = (import.meta.env['VITE_WORKER_API'] as string | undefined) ?? window.location.origin;

export function MetricsDashboard({ onClose }: MetricsDashboardProps): React.JSX.Element {
    const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<MetricsTimeRange>('7d');

    const loadMetrics = useCallback(async (skipCache = false) => {
        setLoading(true);
        setError(null);

        try {
            const cacheKey = `r2-metrics-${timeRange}`;
            const cached = !skipCache ? sessionStorage.getItem(cacheKey) : null;

            if (cached) {
                setMetrics(JSON.parse(cached) as MetricsResponse);
                setLoading(false);
                return;
            }

            const response = await fetch(`${API_BASE}/api/metrics?range=${timeRange}`);
            const data = await response.json() as { success: boolean; result?: MetricsResponse; message?: string };

            if (!data.success) {
                throw new Error(data.message ?? 'Failed to load metrics');
            }

            if (data.result) {
                setMetrics(data.result);
                sessionStorage.setItem(cacheKey, JSON.stringify(data.result));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load metrics');
        } finally {
            setLoading(false);
        }
    }, [timeRange]);

    useEffect(() => {
        void loadMetrics(false);
    }, [loadMetrics]);

    // Prepare chart data
    const operationsChartData = metrics ? aggregateByDate(metrics.timeSeries).map(d => ({
        label: formatDateLabel(d.date),
        value: d.reads + d.writes,
        tooltip: `${formatDateLabel(d.date)}: ${formatNumber(d.reads)} reads, ${formatNumber(d.writes)} writes`
    })) : [];

    const bucketBarData = metrics?.byBucket
        .slice()
        .sort((a, b) => (b.totalReadOperations + b.totalWriteOperations) - (a.totalReadOperations + a.totalWriteOperations))
        .map(bucket => ({
            label: bucket.bucketName,
            value: bucket.totalReadOperations + bucket.totalWriteOperations,
            color: '#3b82f6'
        })) ?? [];

    const storageBarData = metrics?.byBucket
        .filter(bucket => bucket.currentStorageBytes !== undefined)
        .slice()
        .sort((a, b) => (b.currentStorageBytes ?? 0) - (a.currentStorageBytes ?? 0))
        .map(bucket => ({
            label: bucket.bucketName,
            value: bucket.currentStorageBytes ?? 0,
            color: '#10b981'
        })) ?? [];

    return (
        <div className="metrics-container">
            {/* Header */}
            <div className="metrics-header">
                <div>
                    <h2>R2 Metrics</h2>
                    <p>Analytics and performance metrics for your R2 buckets</p>
                </div>
                <div className="metrics-controls">
                    <select
                        id="metrics-time-range"
                        name="metrics-time-range"
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value as MetricsTimeRange)}
                        disabled={loading}
                        aria-label="Select time range"
                    >
                        <option value="24h">Last 24 hours</option>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                    </select>
                    <button
                        onClick={() => void loadMetrics(true)}
                        disabled={loading}
                        title="Refresh metrics"
                    >
                        {loading ? <Loader2 className="spinner" /> : <RefreshCw />}
                    </button>
                    <button onClick={onClose} title="Close metrics">×</button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="error-message">
                    <strong>Error:</strong> {error}
                </div>
            )}

            {/* Loading State */}
            {loading && !metrics && (
                <div className="loading-state">
                    <Loader2 className="spinner" />
                </div>
            )}

            {/* Summary Cards */}
            {metrics && (
                <>
                    <div className="metrics-grid">
                        <div className="metric-card">
                            <div className="metric-header">
                                <span>Total Operations</span>
                                <BarChart3 />
                            </div>
                            <div className="metric-value">
                                {formatNumber(metrics.summary.totalReadOperations + metrics.summary.totalWriteOperations)}
                            </div>
                            <div className="metric-detail">
                                <span className="read-ops">{formatNumber(metrics.summary.totalReadOperations)} reads</span>
                                {' / '}
                                <span className="write-ops">{formatNumber(metrics.summary.totalWriteOperations)} writes</span>
                            </div>
                        </div>

                        <div className="metric-card">
                            <div className="metric-header">
                                <span>Total Storage</span>
                                <HardDrive />
                            </div>
                            <div className="metric-value">
                                {formatBytes(metrics.summary.totalStorageBytes)}
                            </div>
                            <div className="metric-detail">
                                <Package />
                                {metrics.summary.bucketCount} bucket{metrics.summary.bucketCount !== 1 ? 's' : ''}
                            </div>
                        </div>

                        <div className="metric-card">
                            <div className="metric-header">
                                <span>Class A Operations</span>
                                <Activity />
                            </div>
                            <div className="metric-value">
                                {formatNumber(metrics.byBucket.reduce((sum, b) => sum + b.classAOperations, 0))}
                            </div>
                            <div className="metric-detail">
                                Writes, Lists, Uploads
                            </div>
                        </div>

                        <div className="metric-card">
                            <div className="metric-header">
                                <span>Class B Operations</span>
                                <Activity />
                            </div>
                            <div className="metric-value">
                                {formatNumber(metrics.byBucket.reduce((sum, b) => sum + b.classBOperations, 0))}
                            </div>
                            <div className="metric-detail">
                                Reads, Heads
                            </div>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="charts-grid">
                        <div className="chart-card">
                            <h3>Operations Volume</h3>
                            <p>Total read and write operations over time</p>
                            <MetricsChart
                                data={operationsChartData}
                                title=""
                                color="#3b82f6"
                                height={250}
                                formatValue={formatNumber}
                                ariaLabel="Operations volume over time chart"
                            />
                        </div>
                    </div>

                    {/* Per-Bucket Breakdown */}
                    <div className="charts-grid">
                        <div className="chart-card">
                            <h3>Operations by Bucket</h3>
                            <p>Operation distribution across buckets</p>
                            <MetricsBarChart
                                data={bucketBarData}
                                title=""
                                height={300}
                                formatValue={formatNumber}
                                ariaLabel="Operations per bucket bar chart"
                            />
                        </div>

                        <div className="chart-card">
                            <h3>Storage by Bucket</h3>
                            <p>Current storage usage per bucket</p>
                            <MetricsBarChart
                                data={storageBarData}
                                title=""
                                height={300}
                                formatValue={formatBytes}
                                ariaLabel="Storage per bucket bar chart"
                            />
                        </div>
                    </div>

                    {/* Detailed Table */}
                    <div className="metrics-table-card">
                        <h3>Bucket Details</h3>
                        <p>Detailed metrics for each bucket</p>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Bucket</th>
                                        <th>Read Ops</th>
                                        <th>Write Ops</th>
                                        <th>Class A</th>
                                        <th>Class B</th>
                                        <th>Storage</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {metrics.byBucket.map((bucket) => (
                                        <tr key={bucket.bucketName}>
                                            <td>
                                                <strong>{bucket.bucketName}</strong>
                                            </td>
                                            <td className="read-ops">
                                                {formatNumber(bucket.totalReadOperations)}
                                            </td>
                                            <td className="write-ops">
                                                {formatNumber(bucket.totalWriteOperations)}
                                            </td>
                                            <td>
                                                {formatNumber(bucket.classAOperations)}
                                            </td>
                                            <td>
                                                {formatNumber(bucket.classBOperations)}
                                            </td>
                                            <td>
                                                {bucket.currentStorageBytes ? formatBytes(bucket.currentStorageBytes) : 'N/A'}
                                            </td>
                                        </tr>
                                    ))}
                                    {metrics.byBucket.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="no-data">
                                                No bucket metrics available for this time period
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
