// Utility functions for file filtering

interface FileObject {
  key: string
  size: number
  uploaded: string
}

export const EXTENSION_GROUPS = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.heic', '.svg', '.bmp'],
  documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'],
  videos: ['.mp4', '.mov', '.webm'],
  code: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.cs', '.go', '.rs', '.html', '.css', '.json', '.xml', '.yaml', '.yml', '.sql'],
  archives: ['.zip', '.rar', '.7z', '.tar', '.gz']
}

export const SIZE_PRESETS = {
  all: { min: null, max: null },
  tiny: { min: 0, max: 1024 * 1024 },              // < 1MB
  small: { min: 1024 * 1024, max: 10 * 1024 * 1024 },      // 1-10MB
  medium: { min: 10 * 1024 * 1024, max: 50 * 1024 * 1024 }, // 10-50MB
  large: { min: 50 * 1024 * 1024, max: 100 * 1024 * 1024 }, // 50-100MB
  xlarge: { min: 100 * 1024 * 1024, max: null }     // > 100MB
}

export const DATE_PRESETS = {
  all: { start: null, end: null },
  today: () => ({ 
    start: new Date(new Date().setHours(0, 0, 0, 0)),
    end: new Date(new Date().setHours(23, 59, 59, 999))
  }),
  week: () => ({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date()
  }),
  month: () => ({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date()
  }),
  quarter: () => ({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    end: new Date()
  }),
  year: () => ({
    start: new Date(new Date().getFullYear(), 0, 1),
    end: new Date()
  })
}

export const getFileExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ext ? `.${ext}` : ''
}

export const detectExtensions = (files: FileObject[]): Map<string, number> => {
  const extensionMap = new Map<string, number>()
  files.forEach(file => {
    const ext = getFileExtension(file.key)
    if (ext && ext !== '.') {
      extensionMap.set(ext, (extensionMap.get(ext) || 0) + 1)
    }
  })
  return extensionMap
}

export const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

export const formatDateRange = (start: Date | null, end: Date | null): string => {
  if (!start || !end) return 'All dates'
  
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  
  if (start.toDateString() === end.toDateString()) {
    return formatDate(start)
  }
  
  return `${formatDate(start)} - ${formatDate(end)}`
}

export const calculateFilterStats = (files: FileObject[]): { totalSize: number; dateRange: { earliest: Date | null; latest: Date | null } } => {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  
  const dates = files.map(f => new Date(f.uploaded)).sort((a, b) => a.getTime() - b.getTime())
  const earliest = dates.length > 0 ? (dates[0] ?? null) : null
  const latest = dates.length > 0 ? (dates[dates.length - 1] ?? null) : null
  
  return {
    totalSize,
    dateRange: {
      earliest,
      latest
    }
  }
}

