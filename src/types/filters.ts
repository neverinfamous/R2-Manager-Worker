// Filter type definitions for advanced filtering

export interface SizeFilter {
  min: number | null  // bytes
  max: number | null  // bytes
  preset: 'all' | 'tiny' | 'small' | 'medium' | 'large' | 'xlarge' | 'custom'
}

export interface DateFilter {
  start: Date | null
  end: Date | null
  preset: 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
}

export interface ExtensionFilterState {
  selectedExtensions: string[]
  availableExtensions: Map<string, number>
  dropdownOpen: boolean
}

export interface FilterStats {
  totalSize: number
  dateRange: {
    earliest: Date | null
    latest: Date | null
  }
}

