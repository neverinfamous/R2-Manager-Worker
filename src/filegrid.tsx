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

const ITEMS_PER_PAGE = 20
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
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp']
  return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext))
}

const isVideoFile = (filename: string): boolean => {
  return getFileExtension(filename) === 'mp4'
}

const getFileTypeIcon = (filename: string): JSX.Element => {
  const ext = getFileExtension(filename)
  
  if (ext === 'pdf') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <text x="7" y="17" fontSize="4.5" fontFamily="Arial, sans-serif" fill="currentColor" stroke="none">PDF</text>
      </svg>
    )
  }

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

export function FileGrid({ bucketName, onBack, onFilesChange, refreshTrigger = 0, availableBuckets }: FileGridProps) {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [error, setError] = useState<string>('')
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
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)

  const gridRef = useRef<HTMLDivElement>(null)
  const transferButtonRef = useRef<HTMLButtonElement>(null)
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
    }

    if (transferDropdownOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [transferDropdownOpen])

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
    const lastSelected = lastSelectedRef.current

    if (isShiftClick && lastSelected) {
      const fileKeys = sortedFilesRef.current.map(f => f.key)
      const currentIndex = fileKeys.indexOf(key)
      const lastIndex = fileKeys.indexOf(lastSelected)
      
      const start = Math.min(currentIndex, lastIndex)
      const end = Math.max(currentIndex, lastIndex)
      
      const newSelection = fileKeys.slice(start, end + 1)
      setSelectedFiles(prev => Array.from(new Set([...prev, ...newSelection])))
    } else {
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
    
    try {
      const apiMethod = transferState.mode === 'move' ? api.moveFiles.bind(api) : api.copyFiles.bind(api)
      
      await apiMethod(
        bucketName, 
        selectedFiles, 
        transferState.targetBucket, 
        (completed, total) => {
          const action = transferState.mode === 'move' ? 'Moving' : 'Copying'
          setError(`${action} files: ${completed}/${total}...`)
        }
      )
      
      setSelectedFiles([])
      setShouldRefresh(true)
      setTransferState(null)
      
      const action = transferState.mode === 'move' ? 'moved' : 'copied'
      setError(`Successfully ${action} ${selectedFiles.length} file(s)`)
      setTimeout(() => setError(''), 3000)
      
      onFilesChange?.()
    } catch (err) {
      console.error('Transfer failed:', err)
      setError(`Failed to ${transferState.mode} one or more files`)
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
  const isOverSizeLimit = totalSelectedSize > 100 * 1024 * 1024 // 100MB in bytes

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
  }, [])

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
                <span className="size-warning"> - Exceeds 100MB limit</span>
              )}
            </span>
          )}
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {selectedFiles.length > 0 && (
              <button 
                onClick={downloadSelected}
                className={`action-button download-button ${downloadProgress?.status || ''}`}
                disabled={isOverSizeLimit}
                title={isOverSizeLimit ? 'Total size exceeds 100MB limit' : undefined}
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
            <div className="sort-controls">
              <button 
                onClick={() => updateSortState('name')}
                className={`sort-button ${sortState.field === 'name' ? sortState.direction : ''}`}
              >
                Name {sortState.field === 'name' && (sortState.direction === 'asc' ? '▲' : '▼')}
              </button>
              <button
                onClick={() => updateSortState('size')}
                className={`sort-button ${sortState.field === 'size' ? sortState.direction : ''}`}
              >
                Size {sortState.field === 'size' && (sortState.direction === 'asc' ? '▲' : '▼')}
              </button>
              <button
                onClick={() => updateSortState('type')}
                className={`sort-button ${sortState.field === 'type' ? sortState.direction : ''}`}
              >
                Type {sortState.field === 'type' && (sortState.direction === 'asc' ? '▲' : '▼')}
              </button>
              <button
                onClick={() => updateSortState('uploaded')}
                className={`sort-button ${sortState.field === 'uploaded' ? sortState.direction : ''}`}
              >
                Uploaded {sortState.field === 'uploaded' && (sortState.direction === 'asc' ? '▲' : '▼')}
              </button>
            </div>
            <button
              onClick={toggleViewMode}
              className={`view-mode-button ${viewMode === ViewMode.Preview ? 'active' : ''}`}
            >
              Preview
            </button>
            <button
              onClick={toggleViewMode}
              className={`view-mode-button ${viewMode === ViewMode.List ? 'active' : ''}`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {error && <div className={`error-message ${error.includes('Successfully moved') || error.includes('Successfully copied') ? 'success-message' : ''}`}>{error}</div>}

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
                  {isImage ? (
                    <img 
                      src={fileUrl}
                      alt={file.key}
                      loading="lazy"
                      draggable={false}
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
                        {isImageFile(file.key) && (
                          <img 
                            src={api.getFileUrl(bucketName, file.key, file)}
                            alt={file.key}
                            style={{ width: '32px', height: '32px', objectFit: 'cover' }}
                          />
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
              <label>Select destination bucket:</label>
              <select
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
                <p>{error}</p>
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