import { HardDrive, FileStack, TrendingUp, TrendingDown } from "lucide-react";
import { MetricsChart, MetricsBarChart } from "./MetricsChart";

// Types
interface StorageDataPoint {
  date: string;
  bucketName: string;
  storageBytes: number;
  objectCount?: number;
}

interface BucketMetricsSummary {
  bucketName: string;
  currentStorageBytes?: number;
}

interface StorageTabProps {
  storageSeries: StorageDataPoint[];
  byBucket: BucketMetricsSummary[];
  totalStorageBytes: number;
  totalObjectCount?: number;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i] ?? "B"}`;
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
 * Format date for display on chart axis
 */
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Aggregate storage data by date for trend visualization
 */
function aggregateStorageByDate(
  data: StorageDataPoint[],
): { date: string; storage: number; objects: number }[] {
  const byDate = new Map<string, { storage: number; objects: number }>();

  for (const point of data) {
    const existing = byDate.get(point.date);
    if (existing) {
      existing.storage += point.storageBytes;
      existing.objects += point.objectCount ?? 0;
    } else {
      byDate.set(point.date, {
        storage: point.storageBytes,
        objects: point.objectCount ?? 0,
      });
    }
  }

  return Array.from(byDate.entries())
    .map(([date, values]) => ({ date, ...values }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate storage growth/decline percentage
 */
function calculateGrowth(
  data: { storage: number }[],
): { value: number; isPositive: boolean } | null {
  if (data.length < 2) return null;
  const first = data[0]?.storage ?? 0;
  const last = data[data.length - 1]?.storage ?? 0;
  if (first === 0) return null;
  const percentChange = ((last - first) / first) * 100;
  return { value: Math.abs(percentChange), isPositive: percentChange >= 0 };
}

/**
 * StorageTab - Dedicated storage trend visualization
 */
export function StorageTab({
  storageSeries,
  byBucket,
  totalStorageBytes,
  totalObjectCount,
}: StorageTabProps): React.JSX.Element {
  // Aggregate storage data for trend charts
  const storageByDate = aggregateStorageByDate(storageSeries);
  const growth = calculateGrowth(storageByDate);

  // Prepare storage trend chart data
  const storageTrendData = storageByDate.map((d) => ({
    label: formatDateLabel(d.date),
    value: d.storage,
    tooltip: `${formatDateLabel(d.date)}: ${formatBytes(d.storage)}`,
  }));

  // Prepare object count trend chart data
  const objectTrendData = storageByDate.map((d) => ({
    label: formatDateLabel(d.date),
    value: d.objects,
    tooltip: `${formatDateLabel(d.date)}: ${formatNumber(d.objects)} objects`,
  }));

  // Prepare storage by bucket bar chart
  const storageBarData = byBucket
    .filter((b) => b.currentStorageBytes !== undefined)
    .slice()
    .sort((a, b) => (b.currentStorageBytes ?? 0) - (a.currentStorageBytes ?? 0))
    .map((b) => ({
      label: b.bucketName,
      value: b.currentStorageBytes ?? 0,
      color: "#10b981",
    }));

  return (
    <div className="storage-tab">
      {/* Storage Summary Cards */}
      <div className="metrics-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="metric-card">
          <div className="metric-header">
            <span>Total Storage</span>
            <HardDrive />
          </div>
          <div className="metric-value">{formatBytes(totalStorageBytes)}</div>
          {growth && (
            <div
              className="metric-detail"
              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              {growth.isPositive ? (
                <TrendingUp
                  style={{ width: "14px", height: "14px", color: "#10b981" }}
                />
              ) : (
                <TrendingDown
                  style={{ width: "14px", height: "14px", color: "#ef4444" }}
                />
              )}
              <span
                style={{ color: growth.isPositive ? "#10b981" : "#ef4444" }}
              >
                {growth.value.toFixed(1)}%{" "}
                {growth.isPositive ? "growth" : "decline"}
              </span>
            </div>
          )}
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Total Objects</span>
            <FileStack />
          </div>
          <div className="metric-value">
            {formatNumber(totalObjectCount ?? 0)}
          </div>
          <div className="metric-detail">
            Across {byBucket.length} bucket{byBucket.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Storage Trends */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>Storage Trend</h3>
          <p>Total storage usage over time</p>
          <MetricsChart
            data={storageTrendData}
            title=""
            color="#10b981"
            height={250}
            formatValue={formatBytes}
            ariaLabel="Storage trend over time chart"
          />
        </div>

        <div className="chart-card">
          <h3>Object Count Trend</h3>
          <p>Total objects stored over time</p>
          <MetricsChart
            data={objectTrendData}
            title=""
            color="#f59e0b"
            height={250}
            formatValue={formatNumber}
            ariaLabel="Object count trend over time chart"
          />
        </div>
      </div>

      {/* Storage by Bucket */}
      <div className="charts-grid" style={{ marginTop: "1.5rem" }}>
        <div className="chart-card" style={{ gridColumn: "1 / -1" }}>
          <h3>Storage by Bucket</h3>
          <p>Current storage distribution across buckets</p>
          <MetricsBarChart
            data={storageBarData}
            title=""
            height={Math.max(200, storageBarData.length * 35)}
            formatValue={formatBytes}
            ariaLabel="Storage per bucket bar chart"
          />
        </div>
      </div>

      {/* Storage Details Table */}
      <div className="metrics-table-card" style={{ marginTop: "1.5rem" }}>
        <h3>Storage Details by Bucket</h3>
        <p>Detailed storage metrics for each bucket</p>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Storage Size</th>
                <th>% of Total</th>
              </tr>
            </thead>
            <tbody>
              {storageBarData.map((bucket) => (
                <tr key={bucket.label}>
                  <td>
                    <strong>{bucket.label}</strong>
                  </td>
                  <td>{formatBytes(bucket.value)}</td>
                  <td>
                    {totalStorageBytes > 0
                      ? `${((bucket.value / totalStorageBytes) * 100).toFixed(1)}%`
                      : "0%"}
                  </td>
                </tr>
              ))}
              {storageBarData.length === 0 && (
                <tr>
                  <td colSpan={3} className="no-data">
                    No storage data available for this time period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
