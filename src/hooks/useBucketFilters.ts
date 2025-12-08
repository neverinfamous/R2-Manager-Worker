import { useState, useMemo, useCallback } from 'react'
import type { SizeFilter as SizeFilterType, DateFilter as DateFilterType } from '../types/filters'
import { SIZE_PRESETS, DATE_PRESETS } from '../utils/filterUtils'

interface BucketObject {
    name: string
    created: string
    size?: number | undefined
    objectCount?: number | undefined
}

interface UseBucketFiltersParams {
    buckets: BucketObject[]
}

interface UseBucketFiltersReturn {
    // State
    filterText: string
    setFilterText: (text: string) => void
    sizeFilter: SizeFilterType
    dateFilter: DateFilterType

    // Computed
    filteredBuckets: BucketObject[]

    // Handlers
    handleSizePresetChange: (preset: SizeFilterType['preset']) => void
    handleCustomSizeRange: (minMB: number, maxMB: number | null) => void
    handleDatePresetChange: (preset: DateFilterType['preset']) => void
    handleCustomDateRange: (start: Date | null, end: Date | null) => void
    clearAllFilters: () => void

    // For filter components
    setSizeFilter: (filter: SizeFilterType) => void
    setDateFilter: (filter: DateFilterType) => void
}

export function useBucketFilters({ buckets }: UseBucketFiltersParams): UseBucketFiltersReturn {
    const [filterText, setFilterText] = useState<string>('')

    const [sizeFilter, setSizeFilter] = useState<SizeFilterType>({
        min: null,
        max: null,
        preset: 'all'
    })

    const [dateFilter, setDateFilter] = useState<DateFilterType>({
        start: null,
        end: null,
        preset: 'all'
    })

    const filteredBuckets = useMemo(() => {
        return buckets.filter(bucket => {
            // Text filter (Name)
            const matchesText = !filterText || bucket.name.toLowerCase().includes(filterText.toLowerCase())

            // Size filter
            // Note: Some buckets might not have size calculated (?) but existing code suggests it works
            const bucketSize = bucket.size ?? 0
            const matchesSize =
                (sizeFilter.min === null || bucketSize >= sizeFilter.min) &&
                (sizeFilter.max === null || bucketSize <= sizeFilter.max)

            // Date filter
            const bucketTime = new Date(bucket.created).getTime()
            const matchesDate =
                (dateFilter.start === null || bucketTime >= dateFilter.start.getTime()) &&
                (dateFilter.end === null || bucketTime <= dateFilter.end.getTime())

            return matchesText && matchesSize && matchesDate
        })
    }, [buckets, filterText, sizeFilter, dateFilter])

    const handleSizePresetChange = useCallback((preset: SizeFilterType['preset']) => {
        if (preset === 'all') {
            setSizeFilter({ min: null, max: null, preset: 'all' })
        } else if (preset === 'custom') {
            // Custom is handled by handleCustomSizeRange
            return
        } else {
            const presetValues = SIZE_PRESETS[preset]
            if (presetValues !== undefined) {
                setSizeFilter({
                    min: presetValues.min,
                    max: presetValues.max,
                    preset
                })
            }
        }
    }, [])

    const handleCustomSizeRange = useCallback((minMB: number, maxMB: number | null) => {
        setSizeFilter({
            min: minMB * 1024 * 1024,
            max: maxMB !== null ? maxMB * 1024 * 1024 : null,
            preset: 'custom'
        })
    }, [])

    const handleDatePresetChange = useCallback((preset: DateFilterType['preset']) => {
        if (preset === 'all') {
            setDateFilter({ start: null, end: null, preset: 'all' })
        } else if (preset === 'custom') {
            // Custom is handled by handleCustomDateRange
            return
        } else {
            const presetFn = DATE_PRESETS[preset]
            if (presetFn !== undefined) {
                const range = typeof presetFn === 'function' ? presetFn() : presetFn
                setDateFilter({
                    start: range.start,
                    end: range.end,
                    preset
                })
            }
        }
    }, [])

    const handleCustomDateRange = useCallback((start: Date | null, end: Date | null) => {
        setDateFilter({
            start,
            end,
            preset: 'custom'
        })
    }, [])

    const clearAllFilters = useCallback(() => {
        setFilterText('')
        setSizeFilter({ min: null, max: null, preset: 'all' })
        setDateFilter({ start: null, end: null, preset: 'all' })
    }, [])

    return {
        filterText,
        setFilterText,
        sizeFilter,
        dateFilter,
        filteredBuckets,
        handleSizePresetChange,
        handleCustomSizeRange,
        handleDatePresetChange,
        handleCustomDateRange,
        clearAllFilters,
        setSizeFilter,
        setDateFilter
    }
}
