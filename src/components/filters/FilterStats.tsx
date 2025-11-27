import { type JSX } from 'react'
import { formatFileSize, formatDateRange } from '../../utils/filterUtils'
import type { FilterStats as FilterStatsType } from '../../types/filters'

interface FilterStatsProps {
  filteredCount: number
  totalCount: number
  stats: FilterStatsType
}

export function FilterStats({
  filteredCount,
  totalCount,
  stats
}: FilterStatsProps): JSX.Element | null {
  if (filteredCount === totalCount) return null

  return (
    <div className="filter-stats-container">
      <div className="filter-stats-content">
        <div className="filter-stats-item">
          <span className="filter-stats-label">Showing:</span>
          <span className="filter-stats-value">{filteredCount} of {totalCount} items</span>
        </div>
        {stats.totalSize > 0 && (
          <div className="filter-stats-item">
            <span className="filter-stats-label">Total Size:</span>
            <span className="filter-stats-value">{formatFileSize(stats.totalSize)}</span>
          </div>
        )}
        {stats.dateRange.earliest && stats.dateRange.latest && (
          <div className="filter-stats-item">
            <span className="filter-stats-label">Date Range:</span>
            <span className="filter-stats-value">
              {formatDateRange(stats.dateRange.earliest, stats.dateRange.latest)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

