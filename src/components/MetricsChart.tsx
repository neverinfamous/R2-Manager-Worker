import { useMemo } from 'react';

interface DataPoint {
  label: string;
  value: number;
  tooltip?: string;
}

interface MetricsChartProps {
  data: DataPoint[];
  title: string;
  color?: string;
  height?: number;
  showGrid?: boolean;
  formatValue?: (value: number) => string;
  ariaLabel?: string;
}

/**
 * Simple SVG-based line/area chart for metrics visualization
 * Lightweight alternative to heavy chart libraries
 */
export function MetricsChart({
  data,
  title,
  color = '#3b82f6',
  height = 200,
  showGrid = true,
  formatValue = (v) => v.toLocaleString(),
  ariaLabel
}: MetricsChartProps): React.JSX.Element {
  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const values = data.map((d) => d.value);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;

    const width = 600;
    const chartHeight = height - 50; // Leave more room for labels
    const padding = { top: 10, right: 20, bottom: 40, left: 50 };

    const points = data.map((d, i) => ({
      x: padding.left + (i / Math.max(data.length - 1, 1)) * (width - padding.left - padding.right),
      y: padding.top + (1 - (d.value - minValue) / range) * (chartHeight - padding.top),
      ...d
    }));

    // Generate SVG path for line
    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${String(p.x)} ${String(p.y)}`)
      .join(' ');

    // Generate SVG path for area (filled below line)
    const areaPath = `${linePath} L ${String(points[points.length - 1]?.x ?? 0)} ${String(chartHeight)} L ${String(points[0]?.x ?? 0)} ${String(chartHeight)} Z`;

    // Generate grid lines
    const gridLines = showGrid
      ? Array.from({ length: 5 }, (_, i) => ({
        y: padding.top + (i / 4) * (chartHeight - padding.top),
        value: maxValue - (i / 4) * range
      }))
      : [];

    return {
      points,
      linePath,
      areaPath,
      gridLines,
      maxValue,
      minValue,
      chartHeight,
      padding,
      width
    };
  }, [data, height, showGrid]);

  if (!chartData || data.length === 0) {
    return (
      <div
        className="chart-empty-state"
        style={{ height }}
        role="img"
        aria-label={ariaLabel ?? `${title} chart - no data available`}
      >
        <p>No data available</p>
      </div>
    );
  }

  const { points, linePath, areaPath, gridLines, maxValue, chartHeight, padding, width } = chartData;

  // Calculate which x-axis labels to show (max 7 labels)
  const labelInterval = Math.ceil(points.length / 7);
  const xLabels = points.filter((_, i) => i % labelInterval === 0 || i === points.length - 1);

  return (
    <div className="chart-wrapper">
      {title && <h4 className="chart-title">{title}</h4>}
      <div
        className="chart-container"
        role="img"
        aria-label={ariaLabel ?? `${title} chart showing ${data.length} data points. Maximum value: ${formatValue(maxValue)}`}
      >
        <svg
          viewBox={`0 0 ${String(width)} ${String(height)}`}
          className="chart-svg"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: 'auto', maxHeight: height }}
        >
          {/* Grid lines */}
          {gridLines.map((line, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                y1={line.y}
                x2={width - padding.right}
                y2={line.y}
                stroke="currentColor"
                strokeOpacity={0.1}
                strokeDasharray="2,2"
              />
              <text
                x={padding.left - 8}
                y={line.y}
                fontSize="14"
                fill="currentColor"
                fillOpacity={0.7}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatValue(line.value)}
              </text>
            </g>
          ))}

          {/* Area fill */}
          <path
            d={areaPath}
            fill={color}
            fillOpacity={0.1}
          />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {points.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r={4}
              fill={color}
            >
              <title>{point.tooltip ?? `${point.label}: ${formatValue(point.value)}`}</title>
            </circle>
          ))}

          {/* X-axis labels */}
          {xLabels.map((point, i) => (
            <text
              key={i}
              x={point.x}
              y={chartHeight + 20}
              fontSize="14"
              fill="currentColor"
              fillOpacity={0.8}
              textAnchor="middle"
            >
              {point.label}
            </text>
          ))}
        </svg>
      </div>
      {/* Screen reader accessible data table */}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point, i) => (
            <tr key={i}>
              <td>{point.label}</td>
              <td>{formatValue(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface BarChartProps {
  data: {
    label: string;
    value: number;
    color?: string;
  }[];
  title: string;
  height?: number;
  formatValue?: (value: number) => string;
  ariaLabel?: string;
}

/**
 * Simple horizontal bar chart
 */
export function MetricsBarChart({
  data,
  title,
  height = 200,
  formatValue = (v) => v.toLocaleString(),
  ariaLabel
}: BarChartProps): React.JSX.Element {
  if (data.length === 0) {
    return (
      <div
        className="chart-empty-state"
        style={{ height }}
        role="img"
        aria-label={ariaLabel ?? `${title} chart - no data available`}
      >
        <p>No data available</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const displayData = data.slice(0, 15); // Show max 15 items

  return (
    <div className="chart-wrapper">
      {title && <h4 className="chart-title">{title}</h4>}
      <div
        className="bar-chart-container"
        role="img"
        aria-label={ariaLabel ?? `${title} bar chart with ${data.length} items`}
        style={{ maxHeight: height, overflowY: 'auto' }}
      >
        {displayData.map((item, i) => (
          <div key={i} className="bar-chart-row">
            <span className="bar-chart-label" title={item.label}>
              {item.label}
            </span>
            <div className="bar-chart-bar-container">
              <div
                className="bar-chart-bar"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  backgroundColor: item.color ?? '#3b82f6'
                }}
                title={`${item.label}: ${formatValue(item.value)}`}
              />
            </div>
            <span className="bar-chart-value">
              {formatValue(item.value)}
            </span>
          </div>
        ))}
        {data.length > 15 && (
          <p className="bar-chart-more">
            +{data.length - 15} more buckets
          </p>
        )}
      </div>
      {/* Screen reader accessible data table */}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Bucket</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr key={i}>
              <td>{item.label}</td>
              <td>{formatValue(item.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
