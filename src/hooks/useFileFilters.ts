import { useState, useCallback, useMemo, useEffect } from 'react'
import type { SizeFilter as SizeFilterType, DateFilter as DateFilterType, FilterStats } from '../types/filters'
import { detectExtensions, EXTENSION_GROUPS, SIZE_PRESETS, DATE_PRESETS, getFileExtension as getFileExt, calculateFilterStats } from '../utils/filterUtils'

interface FileObject {
  key: string
  size: number
  uploaded: string
  url: string
}

interface FolderObject {
  name: string
  path: string
}

interface UseFileFiltersParams {
  files: FileObject[]
  folders: FolderObject[]
}

interface UseFileFiltersReturn {
  // State
  filterText: string
  setFilterText: (text: string) => void
  filterType: 'all' | 'files' | 'folders'
  setFilterType: (type: 'all' | 'files' | 'folders') => void
  selectedExtensions: string[]
  availableExtensions: Map<string, number>
  sizeFilter: SizeFilterType
  dateFilter: DateFilterType
  
  // Computed
  filteredFiles: FileObject[]
  filteredFolders: FolderObject[]
  filteredCount: number
  totalCount: number
  filterStats: FilterStats
  
  // Handlers
  handleExtensionToggle: (extension: string) => void
  handleExtensionGroupSelect: (groupName: string) => void
  handleSizePresetChange: (preset: SizeFilterType['preset']) => void
  handleCustomSizeRange: (minMB: number, maxMB: number | null) => void
  handleDatePresetChange: (preset: DateFilterType['preset']) => void
  handleCustomDateRange: (start: Date | null, end: Date | null) => void
  clearAllFilters: () => void
  
  // For filter components
  setSelectedExtensions: (exts: string[]) => void
  setSizeFilter: (filter: SizeFilterType) => void
  setDateFilter: (filter: DateFilterType) => void
}

export function useFileFilters({ files, folders }: UseFileFiltersParams): UseFileFiltersReturn {
  const [filterText, setFilterText] = useState<string>('')
  const [filterType, setFilterType] = useState<'all' | 'files' | 'folders'>('all')
  
  // Advanced filter state
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>([])
  const [availableExtensions, setAvailableExtensions] = useState<Map<string, number>>(new Map())
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

  // Update available extensions when files change
  useEffect(() => {
    const extensions = detectExtensions(files)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvailableExtensions(extensions)
  }, [files])

  // Computed filtered results with advanced filters
  const filteredFiles = useMemo(() => {
    const hasAdvancedFilters = selectedExtensions.length > 0 || sizeFilter.preset !== 'all' || dateFilter.preset !== 'all'
    
    if (!filterText && filterType === 'all' && !hasAdvancedFilters) {
      return files
    }
    
    return files.filter(file => {
      // Text filter
      const fileName = file.key.split('/').pop() || file.key
      const matchesText = !filterText || fileName.toLowerCase().includes(filterText.toLowerCase())
      
      // Type filter
      const matchesType = filterType === 'all' || filterType === 'files'
      
      // Extension filter
      const fileExt = getFileExt(file.key).toLowerCase()
      const matchesExtension = selectedExtensions.length === 0 || selectedExtensions.includes(fileExt)
      
      // Size filter
      const matchesSize = 
        (sizeFilter.min === null || file.size >= sizeFilter.min) &&
        (sizeFilter.max === null || file.size <= sizeFilter.max)
      
      // Date filter
      const fileDate = new Date(file.uploaded)
      const matchesDate = 
        (dateFilter.start === null || fileDate >= dateFilter.start) &&
        (dateFilter.end === null || fileDate <= dateFilter.end)
      
      return matchesText && matchesType && matchesExtension && matchesSize && matchesDate
    })
  }, [files, filterText, filterType, selectedExtensions, sizeFilter, dateFilter])

  const filteredFolders = useMemo(() => {
    if (!filterText && filterType === 'all') return folders
    
    return folders.filter(folder => {
      const matchesText = folder.name.toLowerCase().includes(filterText.toLowerCase())
      const matchesType = filterType === 'all' || filterType === 'folders'
      return matchesText && matchesType
    })
  }, [folders, filterText, filterType])

  const filteredCount = filteredFiles.length + filteredFolders.length
  const totalCount = files.length + folders.length
  
  // Calculate filter statistics
  const filterStats = useMemo(() => {
    return calculateFilterStats(filteredFiles)
  }, [filteredFiles])

  // Advanced filter handlers
  const handleExtensionToggle = useCallback((extension: string) => {
    setSelectedExtensions(prev => 
      prev.includes(extension)
        ? prev.filter(e => e !== extension)
        : [...prev, extension]
    )
  }, [])

  const handleExtensionGroupSelect = useCallback((groupName: string) => {
    const groupExtensions = EXTENSION_GROUPS[groupName as keyof typeof EXTENSION_GROUPS] || []
    const availableInGroup = groupExtensions.filter(ext => availableExtensions.has(ext))
    
    // Toggle: if all are selected, deselect; otherwise select all
    const allSelected = availableInGroup.every(ext => selectedExtensions.includes(ext))
    
    if (allSelected) {
      setSelectedExtensions(prev => prev.filter(e => !availableInGroup.includes(e)))
    } else {
      setSelectedExtensions(prev => {
        const newSet = new Set([...prev, ...availableInGroup])
        return Array.from(newSet)
      })
    }
  }, [availableExtensions, selectedExtensions])

  const handleSizePresetChange = useCallback((preset: SizeFilterType['preset']) => {
    if (preset === 'all') {
      setSizeFilter({ min: null, max: null, preset: 'all' })
    } else if (preset === 'custom') {
      // Custom is handled by handleCustomSizeRange
      return
    } else {
      const presetValues = SIZE_PRESETS[preset as keyof typeof SIZE_PRESETS]
      if (presetValues) {
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
      const presetFn = DATE_PRESETS[preset as keyof typeof DATE_PRESETS]
      if (presetFn) {
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
    setSelectedExtensions([])
    setSizeFilter({ min: null, max: null, preset: 'all' })
    setDateFilter({ start: null, end: null, preset: 'all' })
  }, [])

  return {
    filterText,
    setFilterText,
    filterType,
    setFilterType,
    selectedExtensions,
    availableExtensions,
    sizeFilter,
    dateFilter,
    filteredFiles,
    filteredFolders,
    filteredCount,
    totalCount,
    filterStats,
    handleExtensionToggle,
    handleExtensionGroupSelect,
    handleSizePresetChange,
    handleCustomSizeRange,
    handleDatePresetChange,
    handleCustomDateRange,
    clearAllFilters,
    setSelectedExtensions,
    setSizeFilter,
    setDateFilter
  }
}

