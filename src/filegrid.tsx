import { useCallback, useState, useEffect, useRef } from 'react'
import type { JSX } from 'react'
import { api } from './services/api'

interface FileObject {
  key: string
  size: number
  uploaded: string
  url: string
}

interface FileGridProps {
  bucketName: string
  onFilesChange?: () => void
  refreshTrigger?: number
  availableBuckets?: string[]
  onBack?: () => void
  onBucketNavigate?: (bucketName: string) => void
}

interface DownloadProgress {
  progress: number
  status: 'preparing' | 'downloading' | 'complete' | 'error'
  error?: string
}

interface PaginatedFiles {
  objects: FileObject[]
  cursor?: string
  hasMore: boolean
}

interface PaginationState {
  isLoading: boolean
  hasError: boolean
  isInitialLoad: boolean
}

interface LoadingState {
  isLoading: boolean
  lastRequestTime?: number
}

enum ViewMode {
  Preview = 'preview',
  List = 'list'
}

type SortField = 'name' | 'size' | 'type' | 'uploaded'
type SortDirection = 'asc' | 'desc'

interface SortState {
  field: SortField
  direction: SortDirection
}

const ITEMS_PER_PAGE = 1000 // Fetch all files in one request (R2 API supports up to 1000)
const INTERSECTION_THRESHOLD = 0.5
const DEBOUNCE_DELAY = 250

const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toLowerCase() || ''
}

const isImageFile = (filename: string): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.heic', '.svg', '.bmp']
  return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext))
}

const isVideoFile = (filename: string): boolean => {
  const ext = getFileExtension(filename)
  return ext === 'mp4' || ext === 'mov' || ext === 'webm'
}

const getFileTypeIcon = (filename: string): JSX.Element => {
  const ext = getFileExtension(filename)
  
  // Excel files - spreadsheet with grid pattern
  if (ext === 'xls' || ext === 'xlsx') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <line x1="4" y1="8" x2="20" y2="8" />
        <line x1="4" y1="13" x2="20" y2="13" />
        <line x1="4" y1="18" x2="20" y2="18" />
        <line x1="10" y1="8" x2="10" y2="21" />
        <line x1="15" y1="8" x2="15" y2="21" />
      </svg>
    )
  }
  
  // PowerPoint files - presentation slide icon
  if (ext === 'ppt' || ext === 'pptx') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="12" rx="1" />
        <rect x="6" y="16" width="12" height="1" fill="currentColor" />
        <line x1="12" y1="17" x2="12" y2="20" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <rect x="7" y="7" width="4" height="3" rx="0.5" fill="currentColor" opacity="0.5" />
        <line x1="12" y1="8" x2="16" y2="8" opacity="0.5" />
        <line x1="12" y1="10" x2="15" y2="10" opacity="0.5" />
      </svg>
    )
  }
  
  // Word files - document with text lines
  if (ext === 'doc' || ext === 'docx') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" opacity="0.6" />
        <line x1="8" y1="16" x2="14" y2="16" opacity="0.6" />
        <line x1="8" y1="10" x2="16" y2="10" opacity="0.6" />
      </svg>
    )
  }
  
  // PDF files - updated design with circle badge
  if (ext === 'pdf') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <circle cx="12" cy="14" r="4" opacity="0.7" />
        <text x="9" y="16.5" fontSize="3.5" fontFamily="Arial, sans-serif" fill="currentColor" stroke="none">PDF</text>
      </svg>
    )
  }
  
  // CSV files - simple table/grid icon
  if (ext === 'csv') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="6" width="16" height="12" rx="1" />
        <line x1="4" y1="10" x2="20" y2="10" />
        <line x1="4" y1="14" x2="20" y2="14" />
        <line x1="12" y1="6" x2="12" y2="18" />
      </svg>
    )
  }
  
  // Database files - cylindrical database icon
  if (ext === 'db' || ext === 'sqlite' || ext === 'sqlite3') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M20 12c0 1.7-3.6 3-8 3s-8-1.3-8-3" />
      </svg>
    )
  }
  
  // JSON/XML files - code brackets icon
  if (ext === 'json' || ext === 'xml') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 3C6.5 3 6 4 6 5.5V8.5C6 10 5 10.5 3.5 10.5M3.5 13.5C5 13.5 6 14 6 15.5V18.5C6 20 6.5 21 8 21" />
        <path d="M16 3C17.5 3 18 4 18 5.5V8.5C18 10 19 10.5 20.5 10.5M20.5 13.5C19 13.5 18 14 18 15.5V18.5C18 20 17.5 21 16 21" />
      </svg>
    )
  }
  
  // Jupyter notebook files - notebook with code cells
  if (ext === 'ipynb') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="5" y="2" width="14" height="20" rx="1" />
        <line x1="5" y1="6" x2="19" y2="6" />
        <line x1="5" y1="10" x2="19" y2="10" />
        <line x1="5" y1="14" x2="19" y2="14" />
        <circle cx="8" cy="4" r="0.5" fill="currentColor" />
        <circle cx="10" cy="4" r="0.5" fill="currentColor" />
        <line x1="7" y1="8" x2="17" y2="8" strokeWidth="0.5" opacity="0.6" />
        <line x1="7" y1="12" x2="15" y2="12" strokeWidth="0.5" opacity="0.6" />
      </svg>
    )
  }
  
  // Parquet files - columnar data structure icon
  if (ext === 'parquet') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="3" height="16" rx="0.5" />
        <rect x="8.5" y="8" width="3" height="12" rx="0.5" />
        <rect x="13" y="6" width="3" height="14" rx="0.5" />
        <rect x="17.5" y="10" width="3" height="10" rx="0.5" />
      </svg>
    )
  }
  
  // Archive icons - compressed folder
  if (ext === 'zip' || ext === 'rar' || ext === '7z' || ext === 'tar' || ext === 'gz') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v8l6 4v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6l6-4V2z" />
        <line x1="12" y1="2" x2="12" y2="4" strokeWidth="2" />
        <line x1="12" y1="5" x2="12" y2="7" strokeWidth="2" />
        <line x1="12" y1="8" x2="12" y2="10" strokeWidth="2" />
      </svg>
    )
  }
  
  // Text file icon - document with lines
  if (ext === 'txt') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="12" x2="16" y2="12" opacity="0.5" />
        <line x1="8" y1="14" x2="16" y2="14" opacity="0.5" />
        <line x1="8" y1="16" x2="14" y2="16" opacity="0.5" />
        <line x1="8" y1="18" x2="15" y2="18" opacity="0.5" />
      </svg>
    )
  }
  
  // Code file icons - angle brackets with code symbol
  if (ext === 'js' || ext === 'ts' || ext === 'jsx' || ext === 'tsx' || 
      ext === 'py' || ext === 'java' || ext === 'cpp' || ext === 'c' || 
      ext === 'cs' || ext === 'go' || ext === 'rs' || ext === 'php' || 
      ext === 'rb' || ext === 'swift' || ext === 'kt' || ext === 'html' || 
      ext === 'css' || ext === 'yaml' || ext === 'yml' || ext === 'sql') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <polyline points="10 14 8 16 10 18" strokeWidth="1.8" />
        <polyline points="14 14 16 16 14 18" strokeWidth="1.8" />
        <line x1="12.5" y1="13" x2="11.5" y2="19" strokeWidth="1.2" opacity="0.7" />
      </svg>
    )
  }
  
  // Markdown icon - M with down arrow
  if (ext === 'md') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <text x="6" y="16" fontSize="12" fontFamily="monospace, sans-serif" fill="currentColor" stroke="none" fontWeight="bold">M↓</text>
      </svg>
    )
  }

  // Image file icon - for image files that can't be previewed
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || 
      ext === 'webp' || ext === 'avif' || ext === 'heic' || ext === 'svg' || ext === 'bmp') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    )
  }

  // Generic document icon (no custom icon)
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  )
}

interface VideoPlayerProps {
  src: string
  className?: string
  onClick?: (e: React.MouseEvent) => void
}

const VideoPlayer = ({ src, className, onClick }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!videoRef.current) return

    if (videoRef.current.paused) {
      videoRef.current.play()
    } else {
      videoRef.current.pause()
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
    }
  }, [])

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        controls
        preload="metadata"
        className={className}
        onClick={(e) => {
          e.stopPropagation()
          onClick?.(e)
        }}
      />
      {!isPlaying && (
        <button
          className="video-play-button"
          onClick={togglePlay}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}
    </>
  )
}

export function FileGrid({ bucketName, onBack, onFilesChange, refreshTrigger = 0, availableBuckets, onBucketNavigate }: FileGridProps) {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [error, setError] = useState<string>('')
  const [infoMessage, setInfoMessage] = useState<string>('')
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [paginatedFiles, setPaginatedFiles] = useState<PaginatedFiles>({
    objects: [],
    cursor: undefined,
    hasMore: true
  })
  const [paginationState, setPaginationState] = useState<PaginationState>({
    isLoading: false,
    hasError: false,
    isInitialLoad: true
  })
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Preview)
  const [sortState, setSortState] = useState<SortState>({
    field: 'uploaded',
    direction: 'desc'
  })
  const [shouldRefresh, setShouldRefresh] = useState(false)
  const [transferState, setTransferState] = useState<{
    isDialogOpen: boolean
    mode: 'move' | 'copy' | null
    targetBucket: string | null
    isTransferring: boolean
    progress: number
  } | null>(null)
  const [isTransferring, setIsTransferring] = useState(false)
  const [transferDropdownOpen, setTransferDropdownOpen] = useState(false)
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)
  const [sortDropdownPosition, setSortDropdownPosition] = useState<{ top: number; left: number } | null>(null)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())
  const [bucketDropdownOpen, setBucketDropdownOpen] = useState(false)
  const [bucketDropdownPosition, setBucketDropdownPosition] = useState<{ top: number; left: number } | null>(null)

  const gridRef = useRef<HTMLDivElement>(null)
  const transferButtonRef = useRef<HTMLButtonElement>(null)
  const sortButtonRef = useRef<HTMLButtonElement>(null)
  const bucketButtonRef = useRef<HTMLButtonElement>(null)
  const lastSelectedRef = useRef<string | null>(null)
  const loadingRef = useRef<LoadingState>({ isLoading: false })
  const mountedRef = useRef<boolean>(true)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadingTriggerRef = useRef<HTMLDivElement>(null)
  const sortedFilesRef = useRef<FileObject[]>([])
  const debounceTimerRef = useRef<number | undefined>(undefined)
  const refreshTimeoutRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const refreshTimeout = refreshTimeoutRef.current
      if (refreshTimeout) {
        window.clearTimeout(refreshTimeout)
      }
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (transferDropdownOpen && !target.closest('.transfer-dropdown-container')) {
        setTransferDropdownOpen(false)
      }
      if (sortDropdownOpen && !target.closest('.sort-dropdown-container')) {
        setSortDropdownOpen(false)
      }
      if (bucketDropdownOpen && !target.closest('.bucket-nav-dropdown-container')) {
        setBucketDropdownOpen(false)
      }
    }

    if (transferDropdownOpen || sortDropdownOpen || bucketDropdownOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [transferDropdownOpen, sortDropdownOpen, bucketDropdownOpen])

  const handleImageError = useCallback((fileName: string) => {
    setFailedImages(prev => new Set(prev).add(fileName))
  }, [])

  const sortFiles = useCallback((files: FileObject[]) => {
    return [...files].sort((a, b) => {
      let result = 0

      switch (sortState.field) {
        case 'name':
          result = a.key.localeCompare(b.key, undefined, {
            numeric: true,
            sensitivity: 'base'
          })
          break
        case 'size':
          result = a.size - b.size
          break
        case 'type': {
          const typeA = getFileExtension(a.key)
          const typeB = getFileExtension(b.key)
          result = typeA.localeCompare(typeB)
          if (result === 0) {
            result = a.key.localeCompare(b.key)
          }
          break
        }
        case 'uploaded': {
          const dateA = new Date(a.uploaded).getTime()
          const dateB = new Date(b.uploaded).getTime()
          result = dateA - dateB
          break
        }
      }

      return sortState.direction === 'asc' ? result : -result
    })
  }, [sortState])

  const loadFiles = useCallback(async (reset: boolean = false) => {
    if (!bucketName || loadingRef.current.isLoading) return
    
    const now = Date.now()
    if (!reset && loadingRef.current.lastRequestTime && now - loadingRef.current.lastRequestTime < DEBOUNCE_DELAY) {
      return
    }

    try {
      loadingRef.current = { isLoading: true, lastRequestTime: now }
      setPaginationState(prev => ({ ...prev, isLoading: true, hasError: false }))
      
      const response = await api.listFiles(
        bucketName,
        reset ? undefined : paginatedFiles.cursor,
        ITEMS_PER_PAGE,
        { skipCache: reset }
      )

      if (!mountedRef.current) return

      setPaginatedFiles(prev => {
        let newObjects: FileObject[]
        if (reset) {
          newObjects = response.objects
        } else {
          const existingKeys = new Set(prev.objects.map(obj => obj.key))
          const uniqueNewObjects = response.objects.filter(obj => !existingKeys.has(obj.key))
          newObjects = [...prev.objects, ...uniqueNewObjects]
        }
        
        const sortedObjects = sortFiles(newObjects)
        sortedFilesRef.current = sortedObjects
        
        return {
          objects: sortedObjects,
          cursor: response.pagination.cursor,
          hasMore: response.pagination.hasMore
        }
      })

      setPaginationState(prev => ({
        ...prev,
        isLoading: false,
        isInitialLoad: false
      }))

      if (shouldRefresh) {
        setShouldRefresh(false)
      }
    } catch (err) {
      console.error('[FileGrid] Error loading files:', err)
      if (mountedRef.current) {
        setError('Failed to load files')
        setPaginationState(prev => ({
          ...prev,
          isLoading: false,
          hasError: true
        }))
      }
    } finally {
      loadingRef.current = { isLoading: false, lastRequestTime: now }
    }
  }, [bucketName, paginatedFiles.cursor, sortFiles, shouldRefresh])

  useEffect(() => {
    if (shouldRefresh) {
      loadFiles(true)
    }
  }, [shouldRefresh, loadFiles])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '100px',
      threshold: INTERSECTION_THRESHOLD
    }

    const handleObserver = (entries: IntersectionObserverEntry[]) => {
      const target = entries[0]
      if (target.isIntersecting && paginatedFiles.hasMore && !paginationState.isLoading && !shouldRefresh) {
        if (debounceTimerRef.current) {
          window.clearTimeout(debounceTimerRef.current)
        }
        debounceTimerRef.current = window.setTimeout(() => {
          loadFiles(false)
        }, DEBOUNCE_DELAY)
      }
    }

    if (loadingTriggerRef.current) {
      observerRef.current = new IntersectionObserver(handleObserver, options)
      observerRef.current.observe(loadingTriggerRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current)
      }
    }
  }, [paginatedFiles.hasMore, paginationState.isLoading, loadFiles, shouldRefresh])

  useEffect(() => {
    if (refreshTrigger > 0) {
      setShouldRefresh(true)
    }
  }, [refreshTrigger])

  useEffect(() => {
    if (mountedRef.current && paginatedFiles.objects.length > 0 && !shouldRefresh) {
      const sortedObjects = sortFiles(paginatedFiles.objects)
      setPaginatedFiles(prev => ({
        ...prev,
        objects: sortedObjects
      }))
    }
  }, [sortState, sortFiles, shouldRefresh, paginatedFiles.objects])

  useEffect(() => {
    setSelectedFiles([])
    setDownloadProgress(null)
    lastSelectedRef.current = null
    setPaginatedFiles({ 
      objects: [], 
      cursor: undefined,
      hasMore: true 
    })
    setPaginationState({
      isLoading: false,
      hasError: false,
      isInitialLoad: true
    })
    
    setSortState({
      field: 'uploaded',
      direction: 'desc'
    })
    
    if (bucketName) {
      setShouldRefresh(true)
    }
  }, [bucketName])

  const handleSelection = useCallback((key: string, event: React.MouseEvent | React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    
    const isShiftClick = 'shiftKey' in event && event.shiftKey && lastSelectedRef.current
    const isCtrlClick = 'ctrlKey' in event && (event.ctrlKey || event.metaKey)
    const lastSelected = lastSelectedRef.current

    if (isShiftClick && lastSelected) {
      // Shift-click: Select range from last selected to current
      const fileKeys = sortedFilesRef.current.map(f => f.key)
      const currentIndex = fileKeys.indexOf(key)
      const lastIndex = fileKeys.indexOf(lastSelected)
      
      const start = Math.min(currentIndex, lastIndex)
      const end = Math.max(currentIndex, lastIndex)
      
      const newSelection = fileKeys.slice(start, end + 1)
      setSelectedFiles(prev => Array.from(new Set([...prev, ...newSelection])))
    } else if (isCtrlClick) {
      // Ctrl/Cmd-click: Toggle individual selection without clearing others
      setSelectedFiles(prev => {
        const newSelection = prev.includes(key)
          ? prev.filter(k => k !== key)
          : [...prev, key]
        return newSelection
      })
    } else {
      // Regular click or checkbox: Toggle individual selection
      setSelectedFiles(prev => {
        const newSelection = prev.includes(key)
          ? prev.filter(k => k !== key)
          : [...prev, key]
        return newSelection
      })
    }
    
    lastSelectedRef.current = key
  }, [])

  const handleRowClick = useCallback((key: string, event: React.MouseEvent) => {
    event.preventDefault()
    handleSelection(key, event)
  }, [handleSelection])

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`Delete ${selectedFiles.length} selected files?`)) return

    setError('')
    try {
      await Promise.all(selectedFiles.map(file => 
        api.deleteFile(bucketName, file)
      ))
      setSelectedFiles([])
      setShouldRefresh(true)
      onFilesChange?.()
    } catch (err) {
      console.error('Failed to delete selected files:', err)
      setError('Failed to delete one or more files')
    }
  }, [bucketName, selectedFiles, onFilesChange])

  const downloadSelected = useCallback(async () => {
    if (selectedFiles.length === 0) return

    setError('')
    setDownloadProgress({ progress: 0, status: 'preparing' })

    try {
      const selectedObjects = paginatedFiles.objects.filter(f => selectedFiles.includes(f.key))
      
      await api.downloadFiles(bucketName, selectedObjects, {
        asZip: selectedFiles.length > 1,
        onProgress: (progress) => {
          setDownloadProgress({
            progress,
            status: progress < 100 ? 'downloading' : 'complete'
          })
        }
      })

      setSelectedFiles([])
      
      setTimeout(() => {
        setDownloadProgress(null)
      }, 2000)

    } catch (err) {
      console.error('Download error:', err)
      setError(err instanceof Error ? err.message : 'Failed to download files')
      setDownloadProgress({
        progress: 0,
        status: 'error',
        error: err instanceof Error ? err.message : 'Download failed'
      })
    }
  }, [bucketName, selectedFiles, paginatedFiles.objects])

  const downloadBucket = useCallback(async () => {
    setError('')
    setDownloadProgress({ progress: 0, status: 'preparing' })

    try {
      await api.downloadBucket(bucketName, {
        onProgress: (progress) => {
          setDownloadProgress({
            progress,
            status: progress < 100 ? 'downloading' : 'complete'
          })
        }
      })

      setTimeout(() => {
        setDownloadProgress(null)
      }, 2000)

    } catch (err) {
      console.error('Bucket download error:', err)
      setError(err instanceof Error ? err.message : 'Failed to download bucket')
      setDownloadProgress({
        progress: 0,
        status: 'error',
        error: err instanceof Error ? err.message : 'Download failed'
      })
    }
  }, [bucketName])

  const handleTransferFiles = useCallback(async () => {
    if (!transferState?.mode || !transferState.targetBucket) return
    
    setIsTransferring(true)
    setError('')
    setInfoMessage('')
    
    try {
      const apiMethod = transferState.mode === 'move' ? api.moveFiles.bind(api) : api.copyFiles.bind(api)
      
      await apiMethod(
        bucketName, 
        selectedFiles, 
        transferState.targetBucket, 
        (completed, total) => {
          const action = transferState.mode === 'move' ? 'Moving' : 'Copying'
          setInfoMessage(`${action} files: ${completed}/${total}...`)
        }
      )
      
      setSelectedFiles([])
      setShouldRefresh(true)
      setTransferState(null)
      
      const action = transferState.mode === 'move' ? 'moved' : 'copied'
      setInfoMessage(`Successfully ${action} ${selectedFiles.length} file(s)`)
      setTimeout(() => setInfoMessage(''), 3000)
      
      onFilesChange?.()
    } catch (err) {
      console.error('Transfer failed:', err)
      setError(`Failed to ${transferState.mode} one or more files`)
      setInfoMessage('')
    } finally {
      setIsTransferring(false)
    }
  }, [transferState, selectedFiles, bucketName, onFilesChange])

  const openTransferDialog = useCallback((mode: 'move' | 'copy') => {
    setTransferState({
      isDialogOpen: true,
      mode,
      targetBucket: null,
      isTransferring: false,
      progress: 0
    })
    setTransferDropdownOpen(false)
  }, [])

  const handleTransferButtonClick = useCallback(() => {
    if (!transferDropdownOpen && transferButtonRef.current) {
      const rect = transferButtonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left
      })
    }
    setTransferDropdownOpen(!transferDropdownOpen)
  }, [transferDropdownOpen])

  const selectedFileObjects = paginatedFiles.objects.filter(f => selectedFiles.includes(f.key))
  const totalSelectedSize = selectedFileObjects.reduce((sum, file) => sum + file.size, 0)
  const isOverSizeLimit = totalSelectedSize > 500 * 1024 * 1024 // 500MB in bytes

  const deselectAll = useCallback(() => {
    setSelectedFiles([])
    lastSelectedRef.current = null
  }, [])

  const handleGridClick = useCallback((event: React.MouseEvent) => {
    if (event.target === gridRef.current) {
      deselectAll()
    }
  }, [deselectAll])

  const toggleViewMode = useCallback(() => {
    setViewMode(prevMode => 
      prevMode === ViewMode.Preview ? ViewMode.List : ViewMode.Preview
    )
  }, [])

  const updateSortState = useCallback((field: SortField) => {
    setSortState(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
    setSortDropdownOpen(false)
  }, [])

  const handleSortButtonClick = useCallback(() => {
    if (!sortDropdownOpen && sortButtonRef.current) {
      const rect = sortButtonRef.current.getBoundingClientRect()
      setSortDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left
      })
    }
    setSortDropdownOpen(!sortDropdownOpen)
  }, [sortDropdownOpen])

  const getSortLabel = useCallback(() => {
    const fieldLabels: Record<SortField, string> = {
      name: 'Name',
      size: 'Size',
      type: 'Type',
      uploaded: 'Uploaded'
    }
    return fieldLabels[sortState.field]
  }, [sortState])

  const handleBucketButtonClick = useCallback(() => {
    if (!bucketDropdownOpen && bucketButtonRef.current) {
      const rect = bucketButtonRef.current.getBoundingClientRect()
      setBucketDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left
      })
    }
    setBucketDropdownOpen(!bucketDropdownOpen)
  }, [bucketDropdownOpen])

  const handleBucketSelect = useCallback((selectedBucket: string) => {
    if (selectedBucket === bucketName) {
      setBucketDropdownOpen(false)
      return
    }
    setBucketDropdownOpen(false)
    // Call the parent callback to navigate to the selected bucket
    if (onBucketNavigate) {
      onBucketNavigate(selectedBucket)
    }
  }, [bucketName, onBucketNavigate])

  return (
    <div className="file-grid-container">
      {onBack && (
        <div style={{ marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #333' }}>
          <button 
            onClick={onBack}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0d47a1',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            ← Back to Buckets
          </button>
        </div>
      )}
      <div className="file-actions-bar">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1 }}>
          {selectedFiles.length > 0 && (
            <span className="selected-count">
              {selectedFiles.length} selected ({formatFileSize(totalSelectedSize)})
              {isOverSizeLimit && (
                <span className="size-warning"> - Exceeds 500MB limit</span>
              )}
            </span>
          )}
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {selectedFiles.length > 0 && (
              <button 
                onClick={downloadSelected}
                className={`action-button download-button ${downloadProgress?.status || ''}`}
                disabled={isOverSizeLimit}
                title={isOverSizeLimit ? 'Total size exceeds 500MB limit' : undefined}
              >
                {downloadProgress ? (
                  downloadProgress.status === 'error' ? 'Download Failed' :
                  downloadProgress.status === 'complete' ? 'Download Complete' :
                  `Downloading (${Math.round(downloadProgress.progress)}%)`
                ) : 'Download Selected'}
              </button>
            )}
            <button 
              onClick={downloadBucket}
              className={`action-button download-button ${downloadProgress?.status || ''}`}
            >
              {downloadProgress ? (
                downloadProgress.status === 'error' ? 'Download Failed' :
                downloadProgress.status === 'complete' ? 'Download Complete' :
                `Downloading (${Math.round(downloadProgress.progress)}%)`
              ) : 'Download Bucket'}
            </button>
          </div>

          {paginatedFiles.objects.length > 0 && selectedFiles.length < paginatedFiles.objects.length && (
            <button 
              onClick={() => setSelectedFiles(paginatedFiles.objects.map(f => f.key))}
              className="action-button select-all-button"
            >
              Select All
            </button>
          )}

          {selectedFiles.length > 0 && (
            <>
              <div className={`transfer-dropdown-container ${transferDropdownOpen ? 'open' : ''}`}>
                <button 
                  ref={transferButtonRef}
                  className="action-button transfer-button"
                  onClick={handleTransferButtonClick}
                >
                  Transfer
                  <span className="dropdown-arrow">▼</span>
                </button>
                {transferDropdownOpen && dropdownPosition && (
                  <div 
                    className="transfer-dropdown-menu"
                    style={{
                      top: `${dropdownPosition.top}px`,
                      left: `${dropdownPosition.left}px`
                    }}
                  >
                    <button onClick={() => openTransferDialog('move')}>
                      Move to...
                    </button>
                    <button onClick={() => openTransferDialog('copy')}>
                      Copy to...
                    </button>
                  </div>
                )}
              </div>
              <button 
                onClick={handleDelete}
                className="action-button delete-button"
              >
                Delete Selected
              </button>
              <button 
                onClick={deselectAll}
                className="action-button deselect-button"
              >
                Deselect All
              </button>
            </>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            {availableBuckets && availableBuckets.length > 1 && (
              <div className={`bucket-nav-dropdown-container ${bucketDropdownOpen ? 'open' : ''}`}>
                <button 
                  ref={bucketButtonRef}
                  className="action-button bucket-nav-button"
                  onClick={handleBucketButtonClick}
                  title="Navigate to another bucket"
                >
                  <span>Jump to Bucket</span>
                  <span className="dropdown-arrow">▼</span>
                </button>
                {bucketDropdownOpen && bucketDropdownPosition && (
                  <div 
                    className="bucket-nav-dropdown-menu"
                    style={{
                      top: `${bucketDropdownPosition.top}px`,
                      left: `${bucketDropdownPosition.left}px`
                    }}
                  >
                    {availableBuckets.map(bucket => (
                      <button 
                        key={bucket}
                        onClick={() => handleBucketSelect(bucket)}
                        className={bucket === bucketName ? 'current-bucket' : ''}
                        disabled={bucket === bucketName}
                      >
                        {bucket}
                        {bucket === bucketName && <span className="current-indicator"> (current)</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className={`sort-dropdown-container ${sortDropdownOpen ? 'open' : ''}`}>
              <button 
                ref={sortButtonRef}
                className="action-button sort-button-combined"
                onClick={handleSortButtonClick}
              >
                <span>Sort: {getSortLabel()}</span>
                <span className="sort-direction-indicator">{sortState.direction === 'asc' ? '▲' : '▼'}</span>
              </button>
              {sortDropdownOpen && sortDropdownPosition && (
                <div 
                  className="sort-dropdown-menu"
                  style={{
                    top: `${sortDropdownPosition.top}px`,
                    left: `${sortDropdownPosition.left}px`
                  }}
                >
                  <button onClick={() => updateSortState('name')}>
                    Name {sortState.field === 'name' && (sortState.direction === 'asc' ? '▲' : '▼')}
                  </button>
                  <button onClick={() => updateSortState('size')}>
                    Size {sortState.field === 'size' && (sortState.direction === 'asc' ? '▲' : '▼')}
                  </button>
                  <button onClick={() => updateSortState('type')}>
                    Type {sortState.field === 'type' && (sortState.direction === 'asc' ? '▲' : '▼')}
                  </button>
                  <button onClick={() => updateSortState('uploaded')}>
                    Uploaded {sortState.field === 'uploaded' && (sortState.direction === 'asc' ? '▲' : '▼')}
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={toggleViewMode}
              className="view-mode-toggle-button"
              title={`Switch to ${viewMode === ViewMode.Preview ? 'List' : 'Grid'} view`}
            >
              {viewMode === ViewMode.Preview ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="view-icon">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  <span>List</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="view-icon">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  <span>Grid</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {infoMessage && <div className="info-message">{infoMessage}</div>}

      {paginationState.isInitialLoad ? (
        <div className="loading-state">Loading...</div>
      ) : viewMode === ViewMode.Preview ? (
        <div 
          ref={gridRef}
          className="file-grid"
          onClick={handleGridClick}
          title={paginatedFiles.objects.length > 0 ? "Click empty space to deselect all files" : undefined}
        >
          {paginatedFiles.objects.map((file) => {
            const isImage = isImageFile(file.key)
            const isVideo = isVideoFile(file.key)
            const isSelected = selectedFiles.includes(file.key)
            const checkboxId = `file-select-${file.key}`
            const fileUrl = api.getFileUrl(bucketName, file.key, file)
            
            return (
              <div
                key={file.key}
                className={`file-item ${isSelected ? 'selected' : ''}`}
                onClick={(e) => handleSelection(file.key, e)}
                style={{ cursor: 'pointer' }}
              >
                <div className="file-select">
                  <input
                    type="checkbox"
                    id={checkboxId}
                    name={checkboxId}
                    checked={isSelected}
                    onChange={(e) => handleSelection(file.key, e)}
                    className="file-checkbox"
                    aria-label={`Select ${file.key}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                
                <div className="file-preview">
                  {isImage && !failedImages.has(file.key) ? (
                    <img 
                      src={fileUrl}
                      alt={file.key}
                      loading="lazy"
                      draggable={false}
                      onError={() => handleImageError(file.key)}
                    />
                  ) : isVideo ? (
                    <VideoPlayer
                      src={fileUrl}
                      className="video-preview"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="file-icon">
                      {getFileTypeIcon(file.key)}
                    </div>
                  )}
                </div>

                <div className="file-info">
                  <p className="file-name" title={file.key}>{file.key}</p>
                  <p className="file-details">
                    {formatFileSize(file.size)} • {new Date(file.uploaded).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )
          })}

          <div 
            ref={loadingTriggerRef}
            style={{ height: '20px', width: '100%' }}
          >
            {paginationState.isLoading && paginatedFiles.objects.length > 0 && (
              <div className="loading-indicator">Loading more...</div>
            )}
          </div>
        </div>
      ) : (
        <div className="file-list">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    id="select-all-files"
                    name="select-all-files"
                    checked={selectedFiles.length === paginatedFiles.objects.length && paginatedFiles.objects.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedFiles(paginatedFiles.objects.map(f => f.key))
                      } else {
                        setSelectedFiles([])
                      }
                    }}
                    className="file-checkbox"
                    aria-label="Select all files"
                  />
                </th>
                <th onClick={() => updateSortState('name')} className="sortable-header">
                  Name
                  {sortState.field === 'name' && (
                    <span className="sort-indicator">
                      {sortState.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
                <th onClick={() => updateSortState('size')} className="sortable-header">
                  Size
                  {sortState.field === 'size' && (
                    <span className="sort-indicator">
                      {sortState.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
                <th onClick={() => updateSortState('type')} className="sortable-header">
                  Type
                  {sortState.field === 'type' && (
                    <span className="sort-indicator">
                      {sortState.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
                <th onClick={() => updateSortState('uploaded')} className="sortable-header">
                  Uploaded
                  {sortState.field === 'uploaded' && (
                    <span className="sort-indicator">
                      {sortState.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedFiles.objects.map(file => {
                const checkboxId = `list-file-select-${file.key}`
                return (
                  <tr 
                    key={file.key}
                    onClick={(e) => handleRowClick(file.key, e)}
                    className={selectedFiles.includes(file.key) ? 'selected' : ''}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        id={checkboxId}
                        name={checkboxId}
                        checked={selectedFiles.includes(file.key)}
                        onChange={(e) => handleSelection(file.key, e)}
                        className="file-checkbox"
                        aria-label={`Select ${file.key}`}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isImageFile(file.key) && !failedImages.has(file.key) ? (
                          <img 
                            src={api.getFileUrl(bucketName, file.key, file)}
                            alt={file.key}
                            style={{ width: '32px', height: '32px', objectFit: 'cover' }}
                            onError={() => handleImageError(file.key)}
                          />
                        ) : !isImageFile(file.key) ? null : (
                          <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {getFileTypeIcon(file.key)}
                          </div>
                        )}
                        <span>{file.key}</span>
                      </div>
                    </td>
                    <td>{formatFileSize(file.size)}</td>
                    <td>{getFileExtension(file.key).toUpperCase()}</td>
                    <td>{new Date(file.uploaded).toLocaleDateString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {paginatedFiles.objects.length === 0 && !paginationState.isLoading && (
        <div className="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <polyline points="13 2 13 9 20 9" />
          </svg>
          <p className="empty-text">No files in this bucket</p>
          <p className="empty-subtext">Upload files to get started</p>
        </div>
      )}

      {transferState?.isDialogOpen && (
        <div className="modal-overlay" onClick={() => !isTransferring && setTransferState(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{transferState.mode === 'move' ? 'Move' : 'Copy'} {selectedFiles.length} File(s)</h2>
            <p>From bucket: <strong>{bucketName}</strong></p>
            
            <div className="bucket-selector">
              <label htmlFor="destination-bucket-select">Select destination bucket:</label>
              <select
                id="destination-bucket-select"
                value={transferState.targetBucket || ''}
                onChange={(e) => setTransferState(prev => prev ? { ...prev, targetBucket: e.target.value || null } : null)}
                disabled={isTransferring}
              >
                <option value="">-- Choose a bucket --</option>
                {availableBuckets?.filter(b => b !== bucketName).map(bucket => (
                  <option key={bucket} value={bucket}>{bucket}</option>
                ))}
              </select>
            </div>

            {isTransferring && (
              <div className="move-progress">
                <p>{infoMessage}</p>
                <div className="progress-bar">
                  <div className="progress-fill"></div>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="modal-button cancel"
                onClick={() => setTransferState(null)}
                disabled={isTransferring}
              >
                Cancel
              </button>
              <button
                className={`modal-button ${transferState.mode === 'move' ? 'move' : 'copy'}`}
                onClick={handleTransferFiles}
                disabled={!transferState.targetBucket || isTransferring}
              >
                {isTransferring 
                  ? (transferState.mode === 'move' ? 'Moving...' : 'Copying...') 
                  : (transferState.mode === 'move' ? 'Move Files' : 'Copy Files')
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {process.env.NODE_ENV === 'development' && (
        <div style={{ 
          position: 'fixed', 
          bottom: 10, 
          right: 10, 
          background: '#1a1f2c', 
          padding: '10px', 
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: 1000
        }}>
          Debug: {paginatedFiles.objects.length} total / Has more: {paginatedFiles.hasMore.toString()}<br />
          Loading: {paginationState.isLoading.toString()}<br />
          Cursor: {paginatedFiles.cursor || 'none'}<br />
          Sort: {sortState.field} ({sortState.direction})
        </div>
      )}
    </div>
  )
}