import { useState, useEffect, useCallback } from 'react';
import {
    RefreshCw,
    Loader2,
    Activity,
    Package,
    Bell,
    Briefcase,
    AlertCircle,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    Palette,
    Tag
} from 'lucide-react';
import {
    fetchHealthSummary,
    calculateHealthScore,
    type HealthSummary,
    type LowActivityBucket,
    type RecentFailedJob,
} from '../services/healthApi';
import { logger } from '../services/logger';


interface HealthDashboardProps {
    onClose: () => void;
}

/**
 * Format date for display
 */
function formatDate(dateString: string | null): string {
    if (!dateString) return 'Never';
    try {
        return new Date(dateString).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return 'Invalid date';
    }
}

export function HealthDashboard({ onClose }: HealthDashboardProps): React.JSX.Element {
    const [health, setHealth] = useState<HealthSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const loadHealth = useCallback(async (skipCache = false): Promise<void> => {
        try {
            setLoading(true);
            setError('');

            const data = await fetchHealthSummary(skipCache);
            setHealth(data);
            setLastUpdated(new Date());
        } catch (err) {
            logger.error('HealthDashboard', 'Failed to load health summary', err);
            setError(err instanceof Error ? err.message : 'Failed to load health summary');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadHealth();
    }, [loadHealth]);

    const handleRefresh = (): void => {
        void loadHealth(true);
    };

    const healthScore = health ? calculateHealthScore(health) : null;

    return (
        <div className="metrics-container">
            {/* Header */}
            <div className="metrics-header">
                <div>
                    <h2>Health Dashboard</h2>
                    <p>Operational status and health overview for R2 Manager</p>
                </div>
                <div className="metrics-controls">
                    {lastUpdated && !loading && (
                        <span className="last-updated">
                            <Clock size={14} />
                            {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                    <button
                        onClick={handleRefresh}
                        disabled={loading}
                        title="Refresh health data"
                    >
                        {loading ? <Loader2 className="spinner" /> : <RefreshCw />}
                    </button>
                    <button onClick={onClose} title="Close health dashboard">×</button>
                </div>
            </div>

            {/* Info Banner */}
            <div className="info-banner">
                <p>
                    <strong>About Health:</strong> This dashboard shows the operational status of your R2 buckets,
                    job history, and organization coverage. Data is cached for 2 minutes.
                </p>
            </div>

            {/* Error State */}
            {error && (
                <div className="error-message">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {/* Loading State */}
            {loading && !health && (
                <div className="loading-state">
                    <Loader2 className="spinner" />
                </div>
            )}

            {/* Health Data */}
            {health && healthScore && (
                <>
                    {/* Health Score Banner */}
                    <div
                        className="health-score-banner"
                        style={{
                            background: healthScore.score >= 90
                                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))'
                                : healthScore.score >= 70
                                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))'
                                    : healthScore.score >= 50
                                        ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.1), rgba(234, 179, 8, 0.05))'
                                        : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05))'
                        }}
                    >
                        <div className="health-score-content">
                            <div>
                                <h3>System Health</h3>
                                <p className={healthScore.color} style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                    {healthScore.label}
                                </p>
                            </div>
                            <div className="health-score-number">
                                <span className="score">{healthScore.score}</span>
                                <span className="out-of">out of 100</span>
                            </div>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="metrics-grid">
                        {/* Buckets */}
                        <div className="metric-card">
                            <div className="metric-header">
                                <span>Buckets</span>
                                <Package />
                            </div>
                            <div className="metric-value">{health.buckets.total}</div>
                            <div className="metric-detail">
                                <Palette size={14} />
                                {health.buckets.withColors} with colors
                            </div>
                        </div>

                        {/* Operations */}
                        <div className="metric-card">
                            <div className="metric-header">
                                <span>Operations (7d)</span>
                                <Activity />
                            </div>
                            <div className="metric-value">{health.storage.totalOperations.toLocaleString()}</div>
                            <div className="metric-detail">
                                {health.storage.fileUploads} uploads, {health.storage.fileDeletes} deletes
                            </div>
                        </div>

                        {/* Webhooks */}
                        <div className="metric-card">
                            <div className="metric-header">
                                <span>Webhooks</span>
                                <Bell />
                            </div>
                            <div className="metric-value">{health.webhooks.enabled}</div>
                            <div className="metric-detail">
                                {health.webhooks.enabled} of {health.webhooks.total} enabled
                            </div>
                        </div>

                        {/* Recent Jobs */}
                        <div className="metric-card">
                            <div className="metric-header">
                                <span>Recent Jobs</span>
                                <Briefcase />
                            </div>
                            <div className="metric-value">{health.recentJobs.last24h}</div>
                            <div className="metric-detail">
                                Last 24h ({health.recentJobs.last7d} in 7d)
                            </div>
                        </div>
                    </div>

                    {/* Failed Jobs Alert */}
                    {health.recentJobs.failedLast24h > 0 && (
                        <div className="alert-card alert-error">
                            <div className="alert-header">
                                <XCircle size={20} />
                                <span>Failed Jobs ({health.recentJobs.failedLast24h} in last 24h)</span>
                            </div>
                            <div className="alert-content">
                                {health.recentFailedJobs.length > 0 ? (
                                    <div className="alert-list">
                                        {health.recentFailedJobs.map((job: RecentFailedJob) => (
                                            <div key={job.jobId} className="alert-item">
                                                <div>
                                                    <p className="alert-item-title">{job.operationType}</p>
                                                    <p className="alert-item-detail">
                                                        Job: {job.jobId.substring(0, 8)}... • {job.errorCount} error{job.errorCount !== 1 ? 's' : ''}
                                                    </p>
                                                </div>
                                                <p className="alert-item-time">
                                                    {formatDate(job.completedAt)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p>Failed jobs detected but details unavailable.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Low Activity Buckets */}
                    {health.lowActivityBuckets.length > 0 && (
                        <div className="alert-card alert-warning">
                            <div className="alert-header">
                                <AlertTriangle size={20} />
                                <span>Low Activity Buckets</span>
                            </div>
                            <div className="alert-content">
                                <p className="alert-description">
                                    These buckets have had no operations in the past 7 days.
                                </p>
                                <div className="alert-list">
                                    {health.lowActivityBuckets.map((bucket: LowActivityBucket) => (
                                        <div key={bucket.bucketName} className="alert-item">
                                            <div>
                                                <p className="alert-item-title">{bucket.bucketName}</p>
                                                <p className="alert-item-detail">
                                                    {bucket.daysSinceActivity} days since last activity
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* All Clear State */}
                    {health.recentJobs.failedLast24h === 0 && health.lowActivityBuckets.length === 0 && (
                        <div className="alert-card alert-success">
                            <div className="alert-header">
                                <CheckCircle size={20} />
                                <span>All Systems Operational</span>
                            </div>
                            <div className="alert-content">
                                <p>No failed jobs or alerts detected. Your R2 fleet is healthy.</p>
                            </div>
                        </div>
                    )}

                    {/* Organization Status */}
                    <div className="charts-grid">
                        <div className="chart-card">
                            <h3><Palette size={18} /> Bucket Colors</h3>
                            <p>Visual organization coverage</p>
                            <div className="organization-stat">
                                <div className="stat-value">
                                    {health.buckets.withColors} / {health.buckets.total}
                                </div>
                                <div className="stat-percent">
                                    {health.buckets.total > 0
                                        ? `${Math.round((health.buckets.withColors / health.buckets.total) * 100)}% coverage`
                                        : 'No buckets'}
                                </div>
                            </div>
                        </div>

                        <div className="chart-card">
                            <h3><Tag size={18} /> Bucket Tags</h3>
                            <p>Metadata organization coverage</p>
                            <div className="organization-stat">
                                <div className="stat-value">
                                    {health.buckets.withTags} / {health.buckets.total}
                                </div>
                                <div className="stat-percent">
                                    {health.buckets.total > 0
                                        ? `${Math.round((health.buckets.withTags / health.buckets.total) * 100)}% coverage`
                                        : 'No buckets'}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
