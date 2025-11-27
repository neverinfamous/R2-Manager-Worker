import { type JSX } from 'react'
import type { SizeFilter, DateFilter } from '../../types/filters'
import { formatFileSize, formatDateRange } from '../../utils/filterUtils'

interface ActiveFilterBadgesProps {
  filterText: string
  selectedExtensions: string[]
  sizeFilter: SizeFilter
  dateFilter: DateFilter
  onClearText: () => void
  onClearExtensions: () => void
  onClearSize: () => void
  onClearDate: () => void
  onClearAll: () => void
}

export function ActiveFilterBadges({
  filterText,
  selectedExtensions,
  sizeFilter,
  dateFilter,
  onClearText,
  onClearExtensions,
  onClearSize,
  onClearDate,
  onClearAll
}: ActiveFilterBadgesProps): JSX.Element | null {
  const hasFilters = filterText !== '' || 
                     selectedExtensions.length > 0 || 
                     sizeFilter.preset !== 'all' || 
                     dateFilter.preset !== 'all'

  if (!hasFilters) return null

  return (
    <div className="active-filters-container">
      <div className="active-filters-badges">
        {filterText && (
          <span className="filter-badge">
            <span className="filter-badge-icon">🔍</span>
            <span className="filter-badge-label">Search:</span>
            <span className="filter-badge-value">&quot;{filterText}&quot;</span>
            <button 
              className="filter-badge-remove" 
              onClick={onClearText}
              aria-label="Clear search filter"
              type="button"
            >
              ✕
            </button>
          </span>
        )}

        {selectedExtensions.length > 0 && (
          <span className="filter-badge">
            <span className="filter-badge-icon">📄</span>
            <span className="filter-badge-label">Extensions:</span>
            <span className="filter-badge-value">
              {selectedExtensions.slice(0, 3).join(', ')}
              {selectedExtensions.length > 3 && ` +${selectedExtensions.length - 3} more`}
            </span>
            <button 
              className="filter-badge-remove" 
              onClick={onClearExtensions}
              aria-label="Clear extension filter"
              type="button"
            >
              ✕
            </button>
          </span>
        )}

        {sizeFilter.preset !== 'all' && (
          <span className="filter-badge">
            <span className="filter-badge-icon">📏</span>
            <span className="filter-badge-label">Size:</span>
            <span className="filter-badge-value">
              {sizeFilter.min !== null && formatFileSize(sizeFilter.min)}
              {sizeFilter.min !== null && sizeFilter.max !== null && ' - '}
              {sizeFilter.max !== null && formatFileSize(sizeFilter.max)}
              {sizeFilter.max === null && sizeFilter.min !== null && '+'}
            </span>
            <button 
              className="filter-badge-remove" 
              onClick={onClearSize}
              aria-label="Clear size filter"
              type="button"
            >
              ✕
            </button>
          </span>
        )}

        {dateFilter.preset !== 'all' && (
          <span className="filter-badge">
            <span className="filter-badge-icon">📅</span>
            <span className="filter-badge-label">Date:</span>
            <span className="filter-badge-value">
              {formatDateRange(dateFilter.start, dateFilter.end)}
            </span>
            <button 
              className="filter-badge-remove" 
              onClick={onClearDate}
              aria-label="Clear date filter"
              type="button"
            >
              ✕
            </button>
          </span>
        )}

        <button 
          className="filter-clear-all-button" 
          onClick={onClearAll}
          type="button"
        >
          Clear All Filters
        </button>
      </div>
    </div>
  )
}

