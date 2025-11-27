import { useState, useCallback, useEffect, useRef } from 'react'
import { api } from '../services/api'
import { logger } from '../services/logger'
import type { SearchResult, SearchFilters, SortColumn, SortDirection } from '../types/search'

interface UseSearchReturn {
  // State
  filters: SearchFilters
  results: SearchResult[]
  isSearching: boolean
  error: string | null
  sortColumn: SortColumn
  sortDirection: SortDirection
  total: number
  hasMore: boolean
  
  // Handlers
  setQuery: (query: string) => void
  setExtensions: (extensions: string[]) => void
  setSizeRange: (min: number | null, max: number | null) => void
  setDateRange: (start: Date | null, end: Date | null) => void
  executeSearch: () => Promise<void>
  clearSearch: () => void
  setSortColumn: (column: SortColumn) => void
  toggleSortDirection: () => void
  sortResults: (column: SortColumn) => void
}

const INITIAL_FILTERS: SearchFilters = {
  query: '',
  extensions: [],
  minSize: null,
  maxSize: null,
  startDate: null,
  endDate: null
}

export function useSearch(): UseSearchReturn {
  const [filters, setFilters] = useState<SearchFilters>(INITIAL_FILTERS)
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn>('uploaded')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  
  // Debounce timer
  const debounceTimer = useRef<number | null>(null)

  // Set individual filter values
  const setQuery = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, query }))
  }, [])

  const setExtensions = useCallback((extensions: string[]) => {
    setFilters(prev => ({ ...prev, extensions }))
  }, [])

  const setSizeRange = useCallback((min: number | null, max: number | null) => {
    setFilters(prev => ({ ...prev, minSize: min, maxSize: max }))
  }, [])

  const setDateRange = useCallback((start: Date | null, end: Date | null) => {
    setFilters(prev => ({ ...prev, startDate: start, endDate: end }))
  }, [])

  // Execute search
  const executeSearch = useCallback(async () => {
    // Don't search if no filters are set
    const hasFilters = 
      filters.query.trim() !== '' ||
      filters.extensions.length > 0 ||
      filters.minSize !== null ||
      filters.maxSize !== null ||
      filters.startDate !== null ||
      filters.endDate !== null

    if (!hasFilters) {
      setResults([])
      setTotal(0)
      setHasMore(false)
      return
    }

    setIsSearching(true)
    setError(null)

    try {
      const searchParams: {
        query?: string
        extensions?: string[]
        minSize?: number | null
        maxSize?: number | null
        startDate?: Date | null
        endDate?: Date | null
        limit?: number
      } = {
        minSize: filters.minSize,
        maxSize: filters.maxSize,
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: 100
      }
      if (filters.query !== '') {
        searchParams.query = filters.query
      }
      if (filters.extensions.length > 0) {
        searchParams.extensions = filters.extensions
      }
      const response = await api.searchAcrossBuckets(searchParams) as { results?: SearchResult[]; pagination?: { total?: number; hasMore?: boolean } }

      setResults(response.results ?? [])
      setTotal(response.pagination?.total ?? 0)
      setHasMore(response.pagination?.hasMore ?? false)
    } catch (err) {
      logger.error('useSearch', 'Search error', err)
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
      setTotal(0)
      setHasMore(false)
    } finally {
      setIsSearching(false)
    }
  }, [filters])

  // Clear search
  const clearSearch = useCallback(() => {
    setFilters(INITIAL_FILTERS)
    setResults([])
    setError(null)
    setTotal(0)
    setHasMore(false)
    setSortColumn('uploaded')
    setSortDirection('desc')
  }, [])

  // Toggle sort direction
  const toggleSortDirection = useCallback(() => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
  }, [])

  // Sort results by column
  const sortResults = useCallback((column: SortColumn) => {
    // If clicking the same column, toggle direction
    if (column === sortColumn) {
      toggleSortDirection()
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }, [sortColumn, toggleSortDirection])

  // Apply sorting to results whenever sort settings change
  useEffect(() => {
    if (results.length === 0) return

    setResults(prev => {
      const sorted = [...prev].sort((a, b) => {
        let comparison = 0

        switch (sortColumn) {
          case 'filename': {
            const aName = a.key.split('/').pop() || a.key
            const bName = b.key.split('/').pop() || b.key
            comparison = aName.localeCompare(bName)
            break
          }
          case 'bucket':
            comparison = a.bucket.localeCompare(b.bucket)
            break
          case 'size':
            comparison = a.size - b.size
            break
          case 'uploaded':
            comparison = new Date(a.uploaded).getTime() - new Date(b.uploaded).getTime()
            break
        }

        return sortDirection === 'asc' ? comparison : -comparison
      })

      // Only update if order actually changed
      if (JSON.stringify(sorted) === JSON.stringify(prev)) {
        return prev
      }
      return sorted
    })
  }, [sortColumn, sortDirection, results.length]) // Re-sort when settings or result count changes

  // Debounced auto-search when query changes
  useEffect(() => {
    // Clear existing timer
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current)
    }

    // Only auto-search if there's a query or other filters
    const hasFilters = 
      filters.query.trim() !== '' ||
      filters.extensions.length > 0 ||
      filters.minSize !== null ||
      filters.maxSize !== null ||
      filters.startDate !== null ||
      filters.endDate !== null

    if (hasFilters) {
      // Set new timer for debounced search
      debounceTimer.current = window.setTimeout(() => {
        void executeSearch()
      }, 300)
    } else {
      // Clear results if no filters
      setResults([])
      setTotal(0)
      setHasMore(false)
    }

    // Cleanup
    return () => {
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [filters, executeSearch])

  return {
    filters,
    results,
    isSearching,
    error,
    sortColumn,
    sortDirection,
    total,
    hasMore,
    setQuery,
    setExtensions,
    setSizeRange,
    setDateRange,
    executeSearch,
    clearSearch,
    setSortColumn,
    toggleSortDirection,
    sortResults
  }
}

