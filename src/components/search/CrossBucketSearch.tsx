import { useState, useCallback, useMemo, type JSX } from 'react'
import { useSearch } from '../../hooks/useSearch'
import { SearchResultsTable } from './SearchResultsTable'
import { ExtensionFilter } from '../filters/ExtensionFilter'
import { SizeFilter } from '../filters/SizeFilter'
import { DateFilter } from '../filters/DateFilter'
import { detectExtensions, SIZE_PRESETS, DATE_PRESETS, EXTENSION_GROUPS } from '../../utils/filterUtils'
import type { SizeFilter as SizeFilterType, DateFilter as DateFilterType } from '../../types/filters'

interface CrossBucketSearchProps {
  onNavigateToBucket?: (bucketName: string) => void
}

export function CrossBucketSearch({ onNavigateToBucket }: CrossBucketSearchProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const [extensionDropdownOpen, setExtensionDropdownOpen] = useState(false)
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false)
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false)
  
  const {
    filters,
    results,
    isSearching,
    error,
    sortColumn,
    sortDirection,
    total,
    setQuery,
    setExtensions,
    setSizeRange,
    setDateRange,
    executeSearch,
    clearSearch,
    sortResults
  } = useSearch()

  // Detect available extensions from results using useMemo
  const availableExtensions = useMemo(() => {
    // Convert SearchResult[] to FileObject[] format for detectExtensions
    const fileObjects = results.map(r => ({
      key: r.key,
      size: r.size,
      uploaded: r.uploaded,
      url: r.url
    }))
    return detectExtensions(fileObjects)
  }, [results])

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  const handleExtensionToggle = useCallback((extension: string) => {
    setExtensions(
      filters.extensions.includes(extension)
        ? filters.extensions.filter(e => e !== extension)
        : [...filters.extensions, extension]
    )
  }, [filters.extensions, setExtensions])

  const handleExtensionGroupSelect = useCallback((groupName: string) => {
    const groupExtensions = EXTENSION_GROUPS[groupName as keyof typeof EXTENSION_GROUPS]
    if (groupExtensions === undefined) return
    const availableInGroup = groupExtensions.filter(ext => availableExtensions.has(ext))
    
    // Toggle: if all are selected, deselect; otherwise select all
    const allSelected = availableInGroup.every(ext => filters.extensions.includes(ext))
    
    if (allSelected) {
      setExtensions(filters.extensions.filter(e => !availableInGroup.includes(e)))
    } else {
      const newExtensions = [...new Set([...filters.extensions, ...availableInGroup])]
      setExtensions(newExtensions)
    }
  }, [availableExtensions, filters.extensions, setExtensions])

  const handleSizePresetChange = useCallback((preset: SizeFilterType['preset']) => {
    if (preset === 'all') {
      setSizeRange(null, null)
    } else if (preset !== 'custom') {
      const presetValues = SIZE_PRESETS[preset as keyof typeof SIZE_PRESETS]
      if (presetValues !== undefined) {
        setSizeRange(presetValues.min, presetValues.max)
      }
    }
  }, [setSizeRange])

  const handleCustomSizeRange = useCallback((minMB: number, maxMB: number | null) => {
    setSizeRange(
      minMB * 1024 * 1024,
      maxMB !== null ? maxMB * 1024 * 1024 : null
    )
  }, [setSizeRange])

  const handleDatePresetChange = useCallback((preset: DateFilterType['preset']) => {
    if (preset === 'all') {
      setDateRange(null, null)
    } else if (preset !== 'custom') {
      const presetFn = DATE_PRESETS[preset as keyof typeof DATE_PRESETS]
      if (presetFn !== undefined) {
        const range = typeof presetFn === 'function' ? presetFn() : presetFn
        setDateRange(range.start, range.end)
      }
    }
  }, [setDateRange])

  const handleCustomDateRange = useCallback((start: Date | null, end: Date | null) => {
    setDateRange(start, end)
  }, [setDateRange])

  const handleClearAll = useCallback(() => {
    clearSearch()
    setIsExpanded(false)
  }, [clearSearch])

  const hasActiveFilters = 
    filters.query.trim() !== '' ||
    filters.extensions.length > 0 ||
    filters.minSize !== null ||
    filters.maxSize !== null ||
    filters.startDate !== null ||
    filters.endDate !== null

  return (
    <div className="cross-bucket-search">
      <div className="search-header">
        <button
          className="search-expand-button"
          onClick={handleToggleExpand}
          aria-expanded={isExpanded}
        >
          <span className="search-icon">🔍</span>
          <span>Search Across All Buckets</span>
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
        </button>
        {hasActiveFilters && !isExpanded && (
          <span className="search-active-indicator">
            {total} {total === 1 ? 'result' : 'results'}
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="search-expanded-content">
          <div className="search-filters-bar">
            <div className="search-input-group">
              <input
                type="text"
                id="cross-bucket-search"
                name="cross-bucket-search"
                className="search-input"
                placeholder="Search by filename..."
                value={filters.query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="search-advanced-filters">
              <ExtensionFilter
                selectedExtensions={filters.extensions}
                availableExtensions={availableExtensions}
                isOpen={extensionDropdownOpen}
                onToggle={() => setExtensionDropdownOpen(prev => !prev)}
                onExtensionToggle={handleExtensionToggle}
                onGroupSelect={handleExtensionGroupSelect}
                onClear={() => setExtensions([])}
              />

              <SizeFilter
                sizeFilter={{
                  min: filters.minSize,
                  max: filters.maxSize,
                  preset: filters.minSize !== null || filters.maxSize !== null ? 'custom' : 'all'
                }}
                isOpen={sizeDropdownOpen}
                onToggle={() => setSizeDropdownOpen(prev => !prev)}
                onPresetChange={handleSizePresetChange}
                onCustomRange={handleCustomSizeRange}
                onClear={() => setSizeRange(null, null)}
              />

              <DateFilter
                dateFilter={{
                  start: filters.startDate,
                  end: filters.endDate,
                  preset: filters.startDate !== null || filters.endDate !== null ? 'custom' : 'all'
                }}
                isOpen={dateDropdownOpen}
                onToggle={() => setDateDropdownOpen(prev => !prev)}
                onPresetChange={handleDatePresetChange}
                onCustomRange={handleCustomDateRange}
                onClear={() => setDateRange(null, null)}
              />

              {hasActiveFilters && (
                <button
                  className="clear-all-button"
                  onClick={handleClearAll}
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="search-error">
              <p>⚠ {error}</p>
            </div>
          )}

          {hasActiveFilters && (
            <SearchResultsTable
              results={results}
              isSearching={isSearching}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={sortResults}
              onRefresh={executeSearch}
              onNavigateToBucket={onNavigateToBucket}
            />
          )}

          {!hasActiveFilters && (
            <div className="search-instructions">
              <p>Enter a search query or apply filters to search across all buckets</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

