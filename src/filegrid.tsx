import { useCallback, useState, useEffect, useRef, type JSX } from 'react'
import { api } from './services/api'
import { ExtensionFilter } from './components/filters/ExtensionFilter'
import { SizeFilter } from './components/filters/SizeFilter'
import { DateFilter } from './components/filters/DateFilter'
import { ActiveFilterBadges } from './components/filters/ActiveFilterBadges'
import { FilterStats } from './components/filters/FilterStats'
import { formatFileSize, getFileExtension, isImageFile, isVideoFile } from './utils/fileUtils'
import { getFileTypeIcon, getFolderIcon } from './components/filegrid/FileTypeIcon'
import { VideoPlayer } from './components/filegrid/VideoPlayer'
import { CreateFolderModal } from './components/filegrid/CreateFolderModal'
import { TransferModal } from './components/filegrid/TransferModal'
import { RenameModal } from './components/filegrid/RenameModal'
import { Breadcrumb } from './components/filegrid/Breadcrumb'
import { ContextMenu } from './components/filegrid/ContextMenu'
import { SortDropdown } from './components/filegrid/SortDropdown'
import { TransferDropdown } from './components/filegrid/TransferDropdown'
import { BucketDropdown } from './components/filegrid/BucketDropdown'
import { useFileSort } from './hooks/useFileSort'
import { useModalState } from './hooks/useModalState'
import { useFileFilters } from './hooks/useFileFilters'

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

interface FileGridProps {
  bucketName: string
  onFilesChange?: () => void
  refreshTrigger?: number
  availableBuckets?: string[]
  onBack?: () => void
  onBucketNavigate?: (bucketName: string) => void
  onPathChange?: (path: string) => void
}

interface DownloadProgress {
  progress: number
  status: 'preparing' | 'downloading' | 'complete' | 'error'
  error?: string
}

interface PaginatedFiles {
  objects: FileObject[]
  folders: FolderObject[]
  cursor?: string | undefined
  hasMore: boolean
}

interface PaginationState {
  isLoading: boolean
  hasError: boolean
  isInitialLoad: boolean
}

interface LoadingState {
  isLoading: boolean
  lastRequestTime?: number | undefined
}

enum ViewMode {
  Preview = 'preview',
  List = 'list'
}

const ITEMS_PER_PAGE = 1000 // Fetch all files in one request (R2 API supports up to 1000)
const INTERSECTION_THRESHOLD = 0.5
const DEBOUNCE_DELAY = 250

export function FileGrid({ bucketName, onBack, onFilesChange, refreshTrigger = 0, availableBuckets, onBucketNavigate, onPathChange }: FileGridProps): JSX.Element {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [selectedFolders, setSelectedFolders] = useState<string[]>([])
  const [currentPath, setCurrentPath] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [infoMessage, setInfoMessage] = useState<string>('')
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [paginatedFiles, setPaginatedFiles] = useState<PaginatedFiles>({
    objects: [],
    folders: [],
    cursor: undefined,
    hasMore: true
  })
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [paginationState, setPaginationState] = useState<PaginationState>({
    isLoading: false,
    hasError: false,
    isInitialLoad: true
  })
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Preview)
  const [shouldRefresh, setShouldRefresh] = useState(false)
  const [transferState, setTransferState] = useState<{
    isDialogOpen: boolean
    mode: 'move' | 'copy' | null
    targetBucket: string | null
    targetPath: string
    isTransferring: boolean
    progress: number
  } | null>(null)
  const [isTransferring, setIsTransferring] = useState(false)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())
  const [copyingUrl, setCopyingUrl] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const gridRef = useRef<HTMLDivElement>(null)
  const transferButtonRef = useRef<HTMLButtonElement>(null)
  const bucketButtonRef = useRef<HTMLButtonElement>(null)
  const lastSelectedRef = useRef<string | null>(null)
  const loadingRef = useRef<LoadingState>({ isLoading: false })
  const mountedRef = useRef<boolean>(true)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadingTriggerRef = useRef<HTMLDivElement>(null)
  const debounceTimerRef = useRef<number | undefined>(undefined)
  const refreshTimeoutRef = useRef<number | undefined>(undefined)

  // Use custom hooks
  const {
    sortState,
    sortDropdownOpen,
    sortDropdownPosition,
    sortButtonRef,
    sortedFilesRef,
    sortFiles,
    updateSortState,
    handleSortButtonClick,
    getSortLabel,
    setSortDropdownOpen
  } = useFileSort()

  const {
    showCreateFolderModal,
    setShowCreateFolderModal,
    transferDropdownOpen,
    setTransferDropdownOpen,
    bucketDropdownOpen,
    setBucketDropdownOpen,
    extensionDropdownOpen,
    setExtensionDropdownOpen,
    sizeDropdownOpen,
    setSizeDropdownOpen,
    dateDropdownOpen,
    setDateDropdownOpen,
    dropdownPosition,
    setDropdownPosition,
    bucketDropdownPosition,
    setBucketDropdownPosition,
    contextMenu,
    setContextMenu,
    renameState,
    setRenameState
  } = useModalState()

  const {
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
  } = useFileFilters({
    files: paginatedFiles.objects,
    folders: paginatedFiles.folders
  })

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
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as HTMLElement
      if (transferDropdownOpen && target.closest('.transfer-dropdown-container') === null) {
        setTransferDropdownOpen(false)
      }
      if (sortDropdownOpen && target.closest('.sort-dropdown-container') === null) {
        setSortDropdownOpen(false)
      }
      if (bucketDropdownOpen && target.closest('.bucket-nav-dropdown-container') === null) {
        setBucketDropdownOpen(false)
      }
    }

    if (transferDropdownOpen || sortDropdownOpen || bucketDropdownOpen) {
      document.addEventListener('click', handleClickOutside)
      return (): void => { document.removeEventListener('click', handleClickOutside) }
    }
    return undefined
  }, [transferDropdownOpen, sortDropdownOpen, bucketDropdownOpen, setSortDropdownOpen, setTransferDropdownOpen, setBucketDropdownOpen])

  // Close context menu when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (): void => {
      if (contextMenu !== null) {
        setContextMenu(null)
      }
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (contextMenu !== null) {
          setContextMenu(null)
        }
        if (renameState !== null) {
          setRenameState(null)
        }
      }
    }

    if (contextMenu !== null) {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
      return (): void => {
        document.removeEventListener('click', handleClickOutside)
        document.removeEventListener('keydown', handleEscape)
      }
    }
    
    if (renameState !== null) {
      document.addEventListener('keydown', handleEscape)
      return (): void => { document.removeEventListener('keydown', handleEscape) }
    }
    return undefined
  }, [contextMenu, renameState, setContextMenu, setRenameState])

  // Prevent browser context menu on file grid items
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent): void => {
      const target = event.target as HTMLElement
      const fileItem = target.closest('.file-item') ?? target.closest('.folder-item')
      const customContextMenu = target.closest('.context-menu')
      
      // Don't prevent default on our custom context menu - let it work normally
      if (customContextMenu) {
        return
      }
      
      // Prevent default browser context menu if clicking on file items, folder items, or the grid
      // Only prevent default, don't stop propagation so React handlers can still fire
      if (fileItem || gridRef.current?.contains(target)) {
        event.preventDefault()
      }
    }

    // Use normal bubbling phase so React's handlers fire first
    document.addEventListener('contextmenu', handleContextMenu)
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [])

  const handleImageError = useCallback((fileName: string) => {
    setFailedImages(prev => new Set(prev).add(fileName))
  }, [])

  const loadFiles = useCallback(async (reset = false) => {
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
        { skipCache: reset, prefix: currentPath || undefined }
      )

      if (!mountedRef.current) return

      setPaginatedFiles(prev => {
        let newObjects: FileObject[]
        let newFolders: FolderObject[]
        
        if (reset) {
          console.log('[FileGrid] Reset load - currentPath:', currentPath);
          console.log('[FileGrid] API returned objects:', response.objects.length);
          console.log('[FileGrid] API returned folders:', response.folders);
          
          newObjects = response.objects
          // Convert folder paths to FolderObject format
          // Only include folders that belong to the current path level
          newFolders = (response.folders ?? []).map((folderPath: string) => {
            // Remove the currentPath prefix if present to get the relative folder name
            const relativePath = currentPath.length > 0 && folderPath.startsWith(currentPath) 
              ? folderPath.substring(currentPath.length)
              : folderPath
            const folderName = relativePath.split('/').find(Boolean) ?? relativePath
            console.log('[FileGrid] Processing folder:', { folderPath, currentPath, relativePath, folderName });
            return {
              name: folderName,
              path: folderPath
            }
          })
          
          console.log('[FileGrid] Processed folders:', newFolders);
        } else {
          const existingKeys = new Set(prev.objects.map(obj => obj.key))
          const uniqueNewObjects = response.objects.filter(obj => !existingKeys.has(obj.key))
          newObjects = [...prev.objects, ...uniqueNewObjects]
          newFolders = prev.folders
        }
        
        const sortedObjects = sortFiles(newObjects)
        sortedFilesRef.current = sortedObjects
        
        return {
          objects: sortedObjects,
          folders: newFolders,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucketName, paginatedFiles.cursor, sortFiles, shouldRefresh, currentPath])

  useEffect(() => {
    if (shouldRefresh) {
      void loadFiles(true)
    }
  }, [shouldRefresh, loadFiles])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '100px',
      threshold: INTERSECTION_THRESHOLD
    }

    const handleObserver = (entries: IntersectionObserverEntry[]): void => {
      const target = entries[0]
      if (target !== undefined && target.isIntersecting && paginatedFiles.hasMore && !paginationState.isLoading && !shouldRefresh) {
        if (debounceTimerRef.current) {
          window.clearTimeout(debounceTimerRef.current)
        }
        debounceTimerRef.current = window.setTimeout(() => {
          void loadFiles(false)
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
    setSelectedFolders([])
    setCurrentPath('')
    setDownloadProgress(null)
    lastSelectedRef.current = null
    setPaginatedFiles({ 
      objects: [],
      folders: [],
      cursor: undefined,
      hasMore: true 
    })
    setPaginationState({
      isLoading: false,
      hasError: false,
      isInitialLoad: true
    })
    
    // Reset path to root when bucket changes
    onPathChange?.('')
    
    if (bucketName) {
      setShouldRefresh(true)
    }
  }, [bucketName, onPathChange])

  const handleSelection = useCallback((key: string, event: React.MouseEvent | React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    
    const isShiftClick = 'shiftKey' in event && event.shiftKey && lastSelectedRef.current !== null
    const isCtrlClick = 'ctrlKey' in event && (event.ctrlKey || event.metaKey)
    const lastSelected = lastSelectedRef.current

    if (isShiftClick && lastSelected !== null) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRowClick = useCallback((key: string, event: React.MouseEvent) => {
    event.preventDefault()
    handleSelection(key, event)
  }, [handleSelection])

  const handleDelete = useCallback(async () => {
    const totalItems = selectedFiles.length + selectedFolders.length
    if (totalItems === 0) return
    
    const itemText = selectedFiles.length > 0 && selectedFolders.length > 0
      ? `${selectedFiles.length} file(s) and ${selectedFolders.length} folder(s)`
      : selectedFiles.length > 0
        ? `${selectedFiles.length} file(s)`
        : `${selectedFolders.length} folder(s)`
    
    if (!window.confirm(`Delete ${itemText}?`)) return

    setError('')
    try {
      // Delete all selected files
      if (selectedFiles.length > 0) {
        await Promise.all(selectedFiles.map(file => 
          api.deleteFile(bucketName, file)
        ))
      }
      
      // Delete all selected folders
      if (selectedFolders.length > 0) {
        await Promise.all(selectedFolders.map(folderPath => 
          api.deleteFolder(bucketName, folderPath, true)
        ))
      }
      
      setSelectedFiles([])
      setSelectedFolders([])
      setShouldRefresh(true)
      onFilesChange?.()
    } catch (err) {
      console.error('Failed to delete selected items:', err)
      setError('Failed to delete one or more items')
    }
  }, [bucketName, selectedFiles, selectedFolders, onFilesChange])

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
      const totalItems = selectedFiles.length + selectedFolders.length
      let completed = 0
      
      // Transfer files
      if (selectedFiles.length > 0) {
        const fileMethod = transferState.mode === 'move' ? api.moveFiles.bind(api) : api.copyFiles.bind(api)
        
        await fileMethod(
          bucketName, 
          selectedFiles, 
          transferState.targetBucket,
          transferState.targetPath || undefined,
          (fileCompleted) => {
            completed = fileCompleted
            const action = transferState.mode === 'move' ? 'Moving' : 'Copying'
            setInfoMessage(`${action} items: ${completed}/${totalItems}...`)
          }
        )
      }
      
      // Transfer folders
      if (selectedFolders.length > 0) {
        const folderMethod = transferState.mode === 'move' ? api.moveFolder.bind(api) : api.copyFolder.bind(api)
        
        for (const folder of selectedFolders) {
          // Extract just the folder name (not the full path)
          const folderName = folder.split('/').filter(p => p !== '').pop() ?? folder
          
          // If destination path is specified, append folder name to it; otherwise use just folder name
          const destPath = transferState.targetPath !== '' 
            ? `${transferState.targetPath}${transferState.targetPath.endsWith('/') ? '' : '/'}${folderName}`
            : folderName
          
          await folderMethod(bucketName, folder, transferState.targetBucket, destPath)
          completed++
          const action = transferState.mode === 'move' ? 'Moving' : 'Copying'
          setInfoMessage(`${action} items: ${completed}/${totalItems}...`)
        }
      }
      
      setSelectedFiles([])
      setSelectedFolders([])
      setShouldRefresh(true)
      setTransferState(null)
      
      const action = transferState.mode === 'move' ? 'moved' : 'copied'
      setInfoMessage(`Successfully ${action} ${totalItems} item(s)`)
      setTimeout(() => setInfoMessage(''), 3000)
      
      onFilesChange?.()
    } catch (err) {
      console.error('Transfer failed:', err)
      setError(`Failed to ${transferState.mode} one or more items`)
      setInfoMessage('')
    } finally {
      setIsTransferring(false)
    }
  }, [transferState, selectedFiles, selectedFolders, bucketName, onFilesChange])

  const openTransferDialog = useCallback((mode: 'move' | 'copy') => {
    setTransferState({
      isDialogOpen: true,
      mode,
      targetBucket: null,
      targetPath: '',
      isTransferring: false,
      progress: 0
    })
    setTransferDropdownOpen(false)
  }, [setTransferDropdownOpen])

  const handleTransferButtonClick = useCallback(() => {
    if (!transferDropdownOpen && transferButtonRef.current) {
      const rect = transferButtonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left
      })
    }
    setTransferDropdownOpen(!transferDropdownOpen)
  }, [transferDropdownOpen, setDropdownPosition, setTransferDropdownOpen])

  const selectedFileObjects = paginatedFiles.objects.filter(f => selectedFiles.includes(f.key))
  const totalSelectedSize = selectedFileObjects.reduce((sum, file) => sum + file.size, 0)
  const isOverSizeLimit = totalSelectedSize > 500 * 1024 * 1024 // 500MB in bytes

  const deselectAll = useCallback(() => {
    setSelectedFiles([])
    setSelectedFolders([])
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

  const handleBucketButtonClick = useCallback(() => {
    if (!bucketDropdownOpen && bucketButtonRef.current) {
      const rect = bucketButtonRef.current.getBoundingClientRect()
      setBucketDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left
      })
    }
    setBucketDropdownOpen(!bucketDropdownOpen)
  }, [bucketDropdownOpen, setBucketDropdownOpen, setBucketDropdownPosition])

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
  }, [bucketName, onBucketNavigate, setBucketDropdownOpen])

  const handleFolderNavigation = useCallback((folderPath: string) => {
    // Ensure the folder path ends with / for proper prefix filtering
    const pathWithSlash = folderPath.endsWith('/') ? folderPath : folderPath + '/'
    console.log('[FileGrid] handleFolderNavigation - navigating to:', pathWithSlash)
    setCurrentPath(pathWithSlash)
    setSelectedFiles([])
    setSelectedFolders([])
    setShouldRefresh(true)
    console.log('[FileGrid] Calling onPathChange with:', pathWithSlash)
    onPathChange?.(pathWithSlash)
  }, [onPathChange])

  const handleBreadcrumbClick = useCallback((path: string) => {
    // Ensure the path ends with / for consistent behavior with folder navigation
    const pathWithSlash = path ? (path.endsWith('/') ? path : path + '/') : ''
    setCurrentPath(pathWithSlash)
    setSelectedFiles([])
    setSelectedFolders([])
    setShouldRefresh(true)
    onPathChange?.(pathWithSlash)
  }, [onPathChange])

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) {
      setError('Folder name cannot be empty')
      return
    }

    setIsCreatingFolder(true)
    setError('')

    try {
      // Remove trailing slash from currentPath if present to avoid double slashes
      const basePath = currentPath.endsWith('/') ? currentPath.slice(0, -1) : currentPath
      const folderPath = basePath ? `${basePath}/${newFolderName}` : newFolderName
      await api.createFolder(bucketName, folderPath)
      setShowCreateFolderModal(false)
      setNewFolderName('')
      setShouldRefresh(true)
      setInfoMessage(`Folder "${newFolderName}" created successfully`)
      setTimeout(() => setInfoMessage(''), 3000)
      onFilesChange?.()
    } catch (err) {
      console.error('Failed to create folder:', err)
      setError(err instanceof Error ? err.message : 'Failed to create folder')
    } finally {
      setIsCreatingFolder(false)
    }
  }, [bucketName, newFolderName, currentPath, onFilesChange, setShowCreateFolderModal])

  const handleCopySignedUrl = useCallback(async (fileName: string, event?: React.MouseEvent) => {
    event?.stopPropagation()
    
    try {
      setCopyingUrl(fileName)
      setError('')
      
      const signedUrl = await api.getSignedUrl(bucketName, fileName)
      
      await navigator.clipboard.writeText(signedUrl)
      
      setCopiedUrl(fileName)
      setInfoMessage(`Copied link for ${fileName}`)
      
      setTimeout(() => {
        setCopiedUrl(null)
        setInfoMessage('')
      }, 3000)
    } catch (err) {
      console.error('Failed to copy signed URL:', err)
      setError('Failed to copy link')
    } finally {
      setCopyingUrl(null)
    }
  }, [bucketName])

  const startRename = useCallback((itemType: 'file' | 'folder', itemKey: string) => {
    const currentName = itemKey.split('/').pop() || itemKey
    setRenameState({
      isRenaming: false,
      itemType,
      itemKey,
      newName: currentName,
      error: ''
    })
    setContextMenu(null)
  }, [setContextMenu, setRenameState])

  const handleRenameSubmit = useCallback(async () => {
    if (!renameState) return
    
    const newName = renameState.newName.trim()
    
    // Validate
    const validation = renameState.itemType === 'file' 
      ? api.validateFileName(newName)
      : api.validateFolderName(newName)
    
    if (!validation.valid) {
      setRenameState(prev => prev ? { ...prev, error: validation.error || '' } : null)
      return
    }
    
    setRenameState(prev => prev ? { ...prev, isRenaming: true, error: '' } : null)
    
    try {
      if (renameState.itemType === 'file') {
        await api.renameFile(bucketName, renameState.itemKey, newName)
      } else {
        // For folders, need to calculate new path
        const pathParts = renameState.itemKey.split('/')
        const newPath = [...pathParts.slice(0, -1), newName].join('/')
        await api.renameFolder(bucketName, renameState.itemKey, newPath)
      }
      
      // Clear failed images cache when renaming files (especially images)
      if (renameState.itemType === 'file') {
        setFailedImages(new Set())
      }
      
      // Close rename modal first
      setRenameState(null)
      
      // Manually trigger file refresh to get updated file list with new filenames and fresh signed URLs
      // This is more reliable than using setShouldRefresh which is async
      await loadFiles(true)
      onFilesChange?.()
      
      setInfoMessage(`${renameState.itemType === 'file' ? 'File' : 'Folder'} renamed successfully`)
      setTimeout(() => setInfoMessage(''), 3000)
    } catch (err) {
      console.error('Rename error:', err)
      setRenameState(prev => prev ? {
        ...prev,
        isRenaming: false,
        error: err instanceof Error ? err.message : 'Rename failed'
      } : null)
    }
  }, [renameState, bucketName, onFilesChange, setRenameState, loadFiles])

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

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-input-container">
          <svg className="filter-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            id="filter-text"
            name="filter-text"
            placeholder="Filter files and folders..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="filter-input"
            aria-label="Filter files and folders"
          />
          {filterText && (
            <button 
              className="filter-clear-button"
              onClick={() => setFilterText('')}
              title="Clear filter"
              aria-label="Clear filter"
            >
              ✕
            </button>
          )}
        </div>
        
        <div className="filter-controls">
          <select 
            id="filter-type"
            name="filter-type"
            className="filter-type-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'files' | 'folders')}
            aria-label="Filter by type"
          >
            <option value="all">All</option>
            <option value="files">Files Only</option>
            <option value="folders">Folders Only</option>
          </select>
          
          <ExtensionFilter
            selectedExtensions={selectedExtensions}
            availableExtensions={availableExtensions}
            isOpen={extensionDropdownOpen}
            onToggle={() => setExtensionDropdownOpen(!extensionDropdownOpen)}
            onExtensionToggle={handleExtensionToggle}
            onGroupSelect={handleExtensionGroupSelect}
            onClear={() => setSelectedExtensions([])}
          />
          
          <SizeFilter
            sizeFilter={sizeFilter}
            isOpen={sizeDropdownOpen}
            onToggle={() => setSizeDropdownOpen(!sizeDropdownOpen)}
            onPresetChange={handleSizePresetChange}
            onCustomRange={handleCustomSizeRange}
            onClear={() => setSizeFilter({ min: null, max: null, preset: 'all' })}
          />
          
          <DateFilter
            dateFilter={dateFilter}
            isOpen={dateDropdownOpen}
            onToggle={() => setDateDropdownOpen(!dateDropdownOpen)}
            onPresetChange={handleDatePresetChange}
            onCustomRange={handleCustomDateRange}
            onClear={() => setDateFilter({ start: null, end: null, preset: 'all' })}
          />
          
          {filteredCount !== totalCount && (
            <span className="filter-match-count">
              {filteredCount} of {totalCount}
            </span>
          )}
        </div>
      </div>

      {/* Active Filter Badges */}
      <ActiveFilterBadges
        filterText={filterText}
        selectedExtensions={selectedExtensions}
        sizeFilter={sizeFilter}
        dateFilter={dateFilter}
        onClearText={() => setFilterText('')}
        onClearExtensions={() => setSelectedExtensions([])}
        onClearSize={() => setSizeFilter({ min: null, max: null, preset: 'all' })}
        onClearDate={() => setDateFilter({ start: null, end: null, preset: 'all' })}
        onClearAll={clearAllFilters}
      />

      {/* Filter Statistics */}
      <FilterStats
        filteredCount={filteredCount}
        totalCount={totalCount}
        stats={filterStats}
      />

      <div className="file-actions-bar">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1 }}>
          {(selectedFiles.length > 0 || selectedFolders.length > 0) && (
            <span className="selected-count">
              {selectedFiles.length > 0 && selectedFolders.length > 0 
                ? `${selectedFiles.length} files, ${selectedFolders.length} folders selected`
                : selectedFiles.length > 0
                ? `${selectedFiles.length} selected (${formatFileSize(totalSelectedSize)})`
                : `${selectedFolders.length} ${selectedFolders.length === 1 ? 'folder' : 'folders'} selected`
              }
              {isOverSizeLimit && (
                <span className="size-warning"> - Exceeds 500MB limit</span>
              )}
            </span>
          )}
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={() => setShowCreateFolderModal(true)}
              className="action-button create-folder-button"
              style={{
                backgroundColor: '#2a7d2e',
                color: 'white'
              }}
            >
               Create Folder
            </button>
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

          {filteredFiles.length > 0 && selectedFiles.length < filteredFiles.length && (
            <button 
              onClick={() => setSelectedFiles(filteredFiles.map(f => f.key))}
              className="action-button select-all-button"
            >
              Select All {filterText || filterType !== 'all' ? 'Filtered' : ''}
            </button>
          )}

          {(selectedFiles.length > 0 || selectedFolders.length > 0) && (
            <>
              <TransferDropdown 
                isOpen={transferDropdownOpen}
                position={dropdownPosition}
                buttonRef={transferButtonRef}
                onToggle={handleTransferButtonClick}
                onCopy={() => openTransferDialog('copy')}
                onMove={() => openTransferDialog('move')}
              />
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
              <BucketDropdown 
                isOpen={bucketDropdownOpen}
                position={bucketDropdownPosition}
                currentBucket={bucketName}
                availableBuckets={availableBuckets}
                buttonRef={bucketButtonRef}
                onToggle={handleBucketButtonClick}
                onSelect={handleBucketSelect}
              />
            )}
            <SortDropdown 
              isOpen={sortDropdownOpen}
              position={sortDropdownPosition}
              currentField={sortState.field}
              currentDirection={sortState.direction}
              buttonRef={sortButtonRef}
              onToggle={handleSortButtonClick}
              onSortChange={updateSortState}
              getSortLabel={getSortLabel}
            />
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

      {/* Breadcrumb Navigation */}
      <Breadcrumb currentPath={currentPath} onNavigate={handleBreadcrumbClick} />

      {paginationState.isInitialLoad ? (
        <div className="loading-state">Loading...</div>
      ) : viewMode === ViewMode.Preview ? (
        <div 
          ref={gridRef}
          className="file-grid"
          onClick={handleGridClick}
          title={filteredFiles.length > 0 || filteredFolders.length > 0 ? "Click empty space to deselect all files" : undefined}
        >
          {/* Render Folders First */}
          {filteredFolders.map((folder) => {
            const isSelected = selectedFolders.includes(folder.path)
            const checkboxId = `folder-select-${folder.path}`
            
            return (
              <div
                key={folder.path}
                className={`file-item folder-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleFolderNavigation(folder.path)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setContextMenu({
                    show: true,
                    x: e.clientX,
                    y: e.clientY,
                    itemType: 'folder',
                    itemKey: folder.path
                  })
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="file-select">
                  <input
                    type="checkbox"
                    id={checkboxId}
                    name={checkboxId}
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation()
                      setSelectedFolders(prev => 
                        prev.includes(folder.path)
                          ? prev.filter(p => p !== folder.path)
                          : [...prev, folder.path]
                      )
                    }}
                    className="file-checkbox"
                    aria-label={`Select folder ${folder.name}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                
                <div className="file-preview">
                  <div className="file-icon">
                    {getFolderIcon()}
                  </div>
                </div>

                <div className="file-info">
                  <p className="file-name" title={folder.name}>📁 {folder.name}</p>
                </div>
              </div>
            )
          })}
          
          {/* Render Files */}
          {filteredFiles.map((file) => {
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
                onContextMenu={(e) => {
                  e.preventDefault()
                  setContextMenu({
                    show: true,
                    x: e.clientX,
                    y: e.clientY,
                    itemType: 'file',
                    itemKey: file.key
                  })
                }}
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

                <button
                  className="copy-url-button"
                  onClick={(e) => handleCopySignedUrl(file.key, e)}
                  disabled={copyingUrl === file.key}
                  title="Copy shareable link"
                >
                  {copyingUrl === file.key ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" opacity="0.3" />
                    </svg>
                  ) : copiedUrl === file.key ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  )}
                </button>
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
                    checked={selectedFiles.length === filteredFiles.length && filteredFiles.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedFiles(filteredFiles.map(f => f.key))
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Render Folders First */}
              {filteredFolders.map((folder) => {
                const isSelected = selectedFolders.includes(folder.path)
                const checkboxId = `list-folder-select-${folder.path}`
                
                return (
                  <tr 
                    key={folder.path}
                    onClick={() => handleFolderNavigation(folder.path)}
                    className={`folder-row ${isSelected ? 'selected' : ''}`}
                    style={{ cursor: 'pointer' }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        id={checkboxId}
                        name={checkboxId}
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation()
                          setSelectedFolders(prev => 
                            prev.includes(folder.path)
                              ? prev.filter(p => p !== folder.path)
                              : [...prev, folder.path]
                          )
                        }}
                        className="file-checkbox"
                        aria-label={`Select folder ${folder.name}`}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {getFolderIcon()}
                        </div>
                        <span>📁 {folder.name}</span>
                      </div>
                    </td>
                    <td style={{ color: '#888', fontStyle: 'italic' }}>—</td>
                    <td>Folder</td>
                    <td style={{ color: '#888', fontStyle: 'italic' }}>—</td>
                    <td></td>
                  </tr>
                )
              })}
              
              {/* Render Files */}
              {filteredFiles.map(file => {
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
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="copy-url-button-list"
                        onClick={(e) => handleCopySignedUrl(file.key, e)}
                        disabled={copyingUrl === file.key}
                        title="Copy shareable link"
                      >
                        {copyingUrl === file.key ? (
                          'Copying...'
                        ) : copiedUrl === file.key ? (
                          '✓ Copied'
                        ) : (
                          'Copy Link'
                        )}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {filteredFiles.length === 0 && filteredFolders.length === 0 && !paginationState.isLoading && (
        <div className="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <polyline points="13 2 13 9 20 9" />
          </svg>
          {(filterText || filterType !== 'all') ? (
            <>
              <p className="empty-text">No matches found for &quot;{filterText}&quot;</p>
              <p className="empty-subtext">Try a different search term or clear the filter</p>
            </>
          ) : (
            <>
              <p className="empty-text">No files or folders {currentPath ? 'in this folder' : 'in this bucket'}</p>
              <p className="empty-subtext">Upload files or create folders to get started</p>
            </>
          )}
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <CreateFolderModal
          show={true}
          bucketName={bucketName}
          currentPath={currentPath}
          newFolderName={newFolderName}
          isCreating={isCreatingFolder}
          onClose={() => {
            setShowCreateFolderModal(false)
            setNewFolderName('')
          }}
          onFolderNameChange={setNewFolderName}
          onSubmit={handleCreateFolder}
        />
      )}

      {transferState?.isDialogOpen && transferState.mode && (
        <TransferModal
          show={true}
          mode={transferState.mode}
          bucketName={bucketName}
          currentPath={currentPath}
          selectedCount={selectedFiles.length + selectedFolders.length}
          availableBuckets={availableBuckets ?? []}
          targetBucket={transferState.targetBucket}
          targetPath={transferState.targetPath}
          isTransferring={isTransferring}
          infoMessage={infoMessage}
          onClose={() => setTransferState(null)}
          onTargetBucketChange={(bucket: string | null) => setTransferState(prev => prev ? { ...prev, targetBucket: bucket } : null)}
          onTargetPathChange={(path: string) => setTransferState(prev => prev ? { ...prev, targetPath: path } : null)}
          onSubmit={handleTransferFiles}
        />
      )}

      <ContextMenu 
        show={contextMenu?.show ?? false}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        itemType={contextMenu?.itemType ?? 'file'}
        onClose={() => { setContextMenu(null) }}
        onRename={() => { if (contextMenu !== null) startRename(contextMenu.itemType, contextMenu.itemKey) }}
        onCopyLink={contextMenu?.itemType === 'file' ? () => {
          if (contextMenu !== null) void handleCopySignedUrl(contextMenu.itemKey)
          setContextMenu(null)
        } : undefined}
      />

      {renameState && (
        <RenameModal
          show={true}
          itemType={renameState.itemType}
          itemKey={renameState.itemKey}
          newName={renameState.newName}
          error={renameState.error}
          isRenaming={renameState.isRenaming}
          onClose={() => setRenameState(null)}
          onNewNameChange={(value: string) => setRenameState(prev => 
            prev ? { ...prev, newName: value, error: '' } : null
          )}
          onSubmit={handleRenameSubmit}
        />
      )}

      {process.env['NODE_ENV'] === 'development' && (
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

