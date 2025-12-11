import { useCallback, useEffect, useState, lazy, Suspense, type JSX } from 'react'
import { useDropzone } from 'react-dropzone'
import './app.css'
import { FileGrid } from './filegrid'
import { api } from './services/api'
import { auth } from './services/auth'
import { logger } from './services/logger'
import { ThemeToggle } from './components/ThemeToggle'
import { CrossBucketSearch } from './components/search/CrossBucketSearch'
import { TagSearch } from './components/search/TagSearch'
import { AISearchPanel } from './components/ai-search'
import { BucketFilterBar } from './components/filters/BucketFilterBar'
import { useBucketFilters } from './hooks/useBucketFilters'
import { UpgradeBanner } from './components/UpgradeBanner'
import { BucketTagPicker } from './components/tags/BucketTagPicker'
import { BucketColorPicker } from './components/colors'
import type { BucketColor } from './utils/bucketColors'
import './styles/metrics.css'
import './styles/tags.css'
import type { FileRejection, FileWithPath } from 'react-dropzone'

// Lazy-loaded tab components for better code splitting
const MetricsDashboard = lazy(() => import('./components/MetricsDashboard').then(m => ({ default: m.MetricsDashboard })))
const S3ImportPanel = lazy(() => import('./components/s3-import').then(m => ({ default: m.S3ImportPanel })))
const JobHistory = lazy(() => import('./components/job-history').then(m => ({ default: m.JobHistory })))
const WebhookManager = lazy(() => import('./components/webhooks/WebhookManager').then(m => ({ default: m.WebhookManager })))

// Loading fallback for lazy-loaded components
const LazyLoadingFallback = (): JSX.Element => (
  <div className="lazy-loading-fallback">
    <div className="loading-spinner" />
    <span>Loading...</span>
  </div>
)

type ActiveView = 'buckets' | 'metrics' | 's3-import' | 'job-history' | 'webhooks'
type BucketsSubView = 'list' | 'file-search' | 'tag-search'

// API response types
interface DeleteBucketResponse {
  success?: boolean
  error?: string
  errors?: { message: string }[]
}

interface BucketListItem {
  name: string
  creation_date: string
  size?: number
  objectCount?: number
}

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

interface BucketObject {
  name: string
  created: string
  size?: number | undefined
  objectCount?: number | undefined
}

interface UploadProgress {
  fileName: string
  progress: number
  status: 'uploading' | 'retrying' | 'verifying' | 'verified' | 'completed' | 'error'
  error?: string | undefined
  currentChunk?: number | undefined
  totalChunks?: number | undefined
  retryAttempt?: number | undefined
  verificationStatus?: 'verifying' | 'verified' | 'failed' | undefined
}

interface RejectedFile {
  file: FileWithPath
  error: string
}

export default function BucketManager(): JSX.Element {
  const [buckets, setBuckets] = useState<BucketObject[]>([])
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
  const [newBucketName, setNewBucketName] = useState('')
  const [isCreatingBucket, setIsCreatingBucket] = useState(false)
  const [error, setError] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])
  const [rejectedFiles, setRejectedFiles] = useState<RejectedFile[]>([])
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [currentPath, setCurrentPath] = useState<string>('')
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    bucketNames: string[]
    totalFiles: number | null
    isDeleting: boolean
    currentProgress?: { current: number; total: number }
  } | null>(null)
  const [selectedBuckets, setSelectedBuckets] = useState<string[]>([])
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [bulkDownloadProgress, setBulkDownloadProgress] = useState<{
    progress: number
    status: 'preparing' | 'downloading' | 'complete' | 'error'
    error?: string
  } | null>(null)
  const [showAISearch, setShowAISearch] = useState(false)
  const [activeView, setActiveView] = useState<ActiveView>('buckets')
  const [bucketsSubView, setBucketsSubView] = useState<BucketsSubView>('list')
  const [bucketColors, setBucketColors] = useState<Record<string, BucketColor>>({})

  // Debug: Log currentPath changes
  useEffect(() => {
    logger.debug('App', 'currentPath changed', { currentPath })
  }, [currentPath])

  // Create a stable callback for path changes
  const handlePathChange = useCallback((newPath: string) => {
    logger.debug('App', 'handlePathChange called', { newPath })
    setCurrentPath(newPath)
  }, [])

  const [editingBucketName, setEditingBucketName] = useState<string | null>(null)
  const [editInputValue, setEditInputValue] = useState('')
  const [editError, setEditError] = useState('')
  const [isRenamingBucket, setIsRenamingBucket] = useState(false)

  // Don't use react-dropzone's built-in accept filter since it's too strict
  // Many file types (especially code files) don't have reliable MIME types
  // Instead, we use a custom validator that checks both MIME type and extension

  const handleNavigateHome = useCallback(() => {
    // Just clear selected bucket to return to bucket list (fast React state update)
    setSelectedBucket(null)
    setCurrentPath('')
    setActiveView('buckets')
  }, [])

  const handleBucketNavigate = useCallback((bucketName: string) => {
    // Navigate to a different bucket
    setSelectedBucket(bucketName)
    setCurrentPath('')
  }, [])

  const handleLogout = useCallback(async () => {
    await auth.logout()
    setSelectedBucket(null)
    setBuckets([])
  }, [])

  const loadBuckets = useCallback(async (forceRefresh = false): Promise<void> => {
    try {
      setError('')
      // Use skipCache when user explicitly refreshes
      const bucketList: BucketListItem[] = await api.listBuckets(forceRefresh)
      setBuckets(bucketList.map(b => ({ name: b.name, created: b.creation_date, size: b.size, objectCount: b.objectCount })))
    } catch (err) {
      logger.error('App', 'Error loading buckets', err)
      setError('Failed to load buckets')
      setBuckets([])
      if ((err as Error).message.includes('401')) {
        void handleLogout()
      }
    }
  }, [handleLogout])

  // Load bucket colors
  const loadBucketColors = useCallback(async (): Promise<void> => {
    try {
      const colors = await api.getBucketColors()
      setBucketColors(colors as Record<string, BucketColor>)
    } catch (err) {
      logger.error('App', 'Error loading bucket colors', err)
      // Non-critical, don't show error to user
    }
  }, [])

  // Handle bucket color change
  const handleBucketColorChange = useCallback(async (bucketName: string, color: BucketColor): Promise<void> => {
    try {
      await api.updateBucketColor(bucketName, color)
      setBucketColors(prev => ({
        ...prev,
        [bucketName]: color
      }))
    } catch (err) {
      logger.error('App', 'Error updating bucket color', err)
      setError('Failed to update bucket color')
    }
  }, [])

  const [bucketViewMode, setBucketViewMode] = useState<'list' | 'grid'>(() => {
    // Check for saved preference
    const savedMode = localStorage.getItem('r2_manager_bucket_view_mode')
    return (savedMode as 'list' | 'grid') || 'list'
  })

  // Persist bucket view mode preference
  useEffect(() => {
    localStorage.setItem('r2_manager_bucket_view_mode', bucketViewMode)
  }, [bucketViewMode])

  const toggleBucketViewMode = useCallback(() => {
    setBucketViewMode(prev => prev === 'list' ? 'grid' : 'list')
  }, [])

  const {
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
  } = useBucketFilters({ buckets })

  const clearRejectedFiles = useCallback(() => {
    setRejectedFiles([])
  }, [])

  const updateProgress = useCallback((
    fileName: string,
    progress: number,
    status: UploadProgress['status'] = 'uploading',
    currentChunk?: number,
    totalChunks?: number,
    retryAttempt?: number,
    error?: string
  ) => {
    setUploadProgress(prev => {
      const existing = prev.find(p => p.fileName === fileName)
      if (existing) {
        return prev.map(p =>
          p.fileName === fileName
            ? {
              ...p,
              progress,
              status,
              currentChunk,
              totalChunks,
              retryAttempt,
              error
            }
            : p
        )
      }
      return [...prev, {
        fileName,
        progress,
        status,
        currentChunk,
        totalChunks,
        retryAttempt,
        error
      }]
    })
  }, [])

  const onDrop = useCallback(async (
    acceptedFiles: File[],
    fileRejections: FileRejection[]
  ) => {
    if (!selectedBucket || isUploading) return

    setRejectedFiles([])

    const newRejectedFiles = fileRejections.map(rejection => ({
      file: rejection.file,
      error: rejection.errors[0]?.message || 'File type not allowed'
    }))

    if (newRejectedFiles.length > 0) {
      setRejectedFiles(newRejectedFiles)
    }

    if (acceptedFiles.length > 0) {
      setIsUploading(true)
      setError('')
      setUploadProgress([])

      try {
        for (const file of acceptedFiles) {
          try {
            updateProgress(file.name, 0)

            logger.debug('Upload', 'Uploading file', { fileName: file.name, path: currentPath || '(root)' })

            await api.uploadFile(
              selectedBucket,
              file,
              {
                onProgress: (progress) => {
                  updateProgress(file.name, progress)
                },
                onRetry: (attempt, chunk, error) => {
                  updateProgress(
                    file.name,
                    0,
                    'retrying',
                    chunk,
                    Math.ceil(file.size / (10 * 1024 * 1024)),
                    attempt,
                    error.message
                  )
                },
                onVerification: (status) => {
                  if (status === 'verifying') {
                    updateProgress(file.name, 99, 'verifying')
                  } else if (status === 'verified') {
                    updateProgress(file.name, 100, 'verified')
                  } else if (status === 'failed') {
                    updateProgress(file.name, 0, 'error', undefined, undefined, undefined, 'Verification failed: Checksum mismatch')
                  }
                },
                maxRetries: 3,
                retryDelay: 1000
              },
              currentPath // Pass the path as-is, even if empty string
            )

            updateProgress(file.name, 100, 'completed')
            setRefreshTrigger(prev => prev + 1)
          } catch (err) {
            logger.error('Upload', `Failed to upload ${file.name}`, err)
            updateProgress(
              file.name,
              0,
              'error',
              undefined,
              undefined,
              undefined,
              err instanceof Error ? err.message : 'Unknown error'
            )

            if ((err as Error).message.includes('401')) {
              void handleLogout()
              return
            }
          }
        }
      } catch (err) {
        logger.error('Upload', 'Upload error', err)
        setError('Failed to upload one or more files')
      } finally {
        setIsUploading(false)
      }
    }
  }, [selectedBucket, isUploading, updateProgress, handleLogout, currentPath])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    // Do not pass accept at all since acceptedFileTypes is undefined
    // This lets all files through, and we validate with our custom validator
    validator: (file) => {
      const validation = api.validateFile(file)
      if (!validation.valid) {
        return {
          code: "file-invalid-type",
          message: validation.error ?? 'Invalid file'
        }
      }
      return null
    }
  })

  useEffect(() => {
    void loadBuckets()
    void loadBucketColors()
  }, [loadBuckets, loadBucketColors])

  const createBucket = async (): Promise<void> => {
    if (!newBucketName.trim()) return

    setIsCreatingBucket(true)
    setError('')

    try {
      await api.createBucket(newBucketName.trim())
      await loadBuckets(true) // Force refresh after mutation
      setNewBucketName('')
    } catch (err) {
      setError('Failed to create bucket')
      if ((err as Error).message.includes('401')) {
        void handleLogout()
      }
    } finally {
      setIsCreatingBucket(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!isCreatingBucket) {
      await createBucket()
    }
  }

  const deleteBucket = async (name: string): Promise<void> => {
    setError('')
    try {
      const response: DeleteBucketResponse = await api.deleteBucket(name)
      logger.debug('DeleteBucket', 'Response received', response)

      // Check if deletion failed because bucket isn't empty
      // Cloudflare returns 409 Conflict (success: false, errors array) for non-empty buckets
      if (response.success === false && (response.errors?.length ?? 0) > 0) {
        // Bucket isn't empty - show confirmation dialog
        try {
          const files = await api.listFiles(name, undefined, 1000)
          const fileCount = files.objects.length
          setDeleteConfirmState({
            bucketNames: [name],
            totalFiles: fileCount,
            isDeleting: false
          })
        } catch {
          // If we can't get file count, show a generic count
          setDeleteConfirmState({
            bucketNames: [name],
            totalFiles: null,
            isDeleting: false
          })
        }
        return
      }

      // Check for error in response (for non-JSON responses or other errors)
      if (response.error) {
        setError(response.error)
        return
      }

      if (response.success !== true) {
        setError('Failed to delete bucket.')
        return
      }

      await loadBuckets(true) // Force refresh after mutation
      if (selectedBucket === name) {
        setSelectedBucket(null)
      }
    } catch (err) {
      setError('Failed to delete bucket.')
      logger.error('DeleteBucket', 'Error deleting bucket', err)
      if ((err as Error).message.includes('401')) {
        void handleLogout()
      }
    }
  }

  const handleBulkDelete = async (): Promise<void> => {
    if (selectedBuckets.length === 0) return

    setIsBulkDeleting(true)
    setError('')

    try {
      // Get file counts for all selected buckets
      let totalFiles = 0
      const fileCounts: Record<string, number> = {}

      for (const bucketName of selectedBuckets) {
        try {
          const files = await api.listFiles(bucketName, undefined, 1000)
          fileCounts[bucketName] = files.objects.length
          totalFiles += files.objects.length
        } catch {
          // If we can't get file count, just continue
          fileCounts[bucketName] = -1
        }
      }

      // Show confirmation modal
      setDeleteConfirmState({
        bucketNames: selectedBuckets,
        totalFiles: totalFiles > 0 ? totalFiles : null,
        isDeleting: false
      })
    } catch (err) {
      setError('Failed to prepare bulk delete')
      logger.error('App', 'Bulk delete preparation error', err)
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleBulkDownload = async (): Promise<void> => {
    if (selectedBuckets.length === 0) return

    setError('')
    setBulkDownloadProgress({ progress: 0, status: 'preparing' })

    try {
      await api.downloadMultipleBuckets(selectedBuckets, {
        onProgress: (progress) => {
          setBulkDownloadProgress({
            progress,
            status: progress < 100 ? 'downloading' : 'complete'
          })
        }
      })

      // Clear selection after successful download
      setSelectedBuckets([])

      setTimeout(() => {
        setBulkDownloadProgress(null)
      }, 2000)
    } catch (err) {
      logger.error('App', 'Bulk download error', err)
      setError(err instanceof Error ? err.message : 'Failed to download buckets')
      setBulkDownloadProgress({
        progress: 0,
        status: 'error',
        error: err instanceof Error ? err.message : 'Download failed'
      })
    }
  }

  const confirmForceBucketDelete = async (): Promise<void> => {
    if (!deleteConfirmState?.bucketNames || deleteConfirmState.bucketNames.length === 0) return

    const bucketNames = deleteConfirmState.bucketNames
    setError('')
    setDeleteConfirmState(prev => prev ? { ...prev, isDeleting: true } : null)

    try {
      const errors: string[] = []

      for (let i = 0; i < bucketNames.length; i++) {
        const bucketName = bucketNames[i]
        if (bucketName === undefined) continue

        // Update progress
        setDeleteConfirmState(prev => prev !== null ? {
          ...prev,
          currentProgress: { current: i + 1, total: bucketNames.length }
        } : null)

        try {
          const response = await api.deleteBucket(bucketName, { force: true }) as { success?: boolean; error?: string }

          if (!response.success) {
            errors.push(`${bucketName}: ${response.error || 'Failed to delete'}`)
          }

          // Clear from selected buckets if it was selected
          if (selectedBucket === bucketName) {
            setSelectedBucket(null)
          }
        } catch (err) {
          errors.push(`${bucketName}: ${err instanceof Error ? err.message : 'Unknown error'}`)
          logger.error('App', `Force delete error for ${bucketName}`, err)
        }
      }

      // Reload buckets to reflect changes
      await loadBuckets(true) // Force refresh after mutation

      // Clear selection
      setSelectedBuckets([])
      setIsBulkDeleting(false)

      // Show errors if any
      if (errors.length > 0) {
        setError(`Some buckets failed to delete:\n${errors.join('\n')}`)
      }

      setDeleteConfirmState(null)
    } catch (err) {
      setError('Failed to delete buckets')
      logger.error('App', 'Force delete error', err)
      setDeleteConfirmState(prev => prev ? { ...prev, isDeleting: false } : null)
    }
  }

  const toggleBucketSelection = (bucketName: string): void => {
    setSelectedBuckets(prev => {
      if (prev.includes(bucketName)) {
        return prev.filter(name => name !== bucketName)
      } else {
        return [...prev, bucketName]
      }
    })
  }

  const clearBucketSelection = (): void => {
    setSelectedBuckets([])
  }

  const startEditingBucket = (bucketName: string): void => {
    setEditingBucketName(bucketName)
    setEditInputValue(bucketName)
    setEditError('')
  }

  const cancelEditingBucket = (): void => {
    setEditingBucketName(null)
    setEditInputValue('')
    setEditError('')
  }

  const saveBucketRename = async (): Promise<void> => {
    if (!editingBucketName) return
    const newName = editInputValue.trim()
    setEditError('')
    const validation = api.validateBucketName(newName)
    if (!validation.valid) {
      setEditError(validation.error || 'Invalid bucket name')
      return
    }
    if (newName === editingBucketName) {
      cancelEditingBucket()
      return
    }
    try {
      setIsRenamingBucket(true)
      setEditError('Creating new bucket and copying files... This may take a minute.')
      await api.renameBucket(editingBucketName, newName)
      await loadBuckets(true) // Force refresh after mutation
      cancelEditingBucket()
      setIsRenamingBucket(false)
    } catch (err) {
      setIsRenamingBucket(false)
      const errorMessage = err instanceof Error ? err.message : 'Failed to rename bucket'
      setEditError(errorMessage)
      logger.error('App', 'Rename error', err)
    }
  }

  return (
    <div className="container">
      <header className="app-header">
        <img
          src="/logo.png"
          alt="R2 Manager"
          className="app-logo"
          onClick={handleNavigateHome}
          style={{ cursor: 'pointer' }}
        />
        <div className="header-content">
          <h1 className="app-title" onClick={handleNavigateHome} style={{ cursor: 'pointer' }}>
            R2 Bucket Manager for Cloudflare
          </h1>
          <div className="header-actions">
            <a
              href="https://dash.cloudflare.com/?to=/:account/r2/overview/buckets"
              target="_blank"
              rel="noopener noreferrer"
              className="cloudflare-dashboard-link"
              title="Open Cloudflare Dashboard"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="logout-button"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Upgrade Banner - Show when migrations are pending */}
      {!selectedBucket && <UpgradeBanner />}

      {/* Navigation Tabs - Show when not viewing a specific bucket */}
      {!selectedBucket && (
        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeView === 'buckets' ? 'active' : ''}`}
            onClick={() => setActiveView('buckets')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
            Buckets
          </button>
          <button
            className={`nav-tab ${activeView === 'metrics' ? 'active' : ''}`}
            onClick={() => setActiveView('metrics')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Metrics
          </button>
          <button
            className={`nav-tab ${activeView === 's3-import' ? 'active' : ''}`}
            onClick={() => setActiveView('s3-import')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            S3 Import
          </button>
          <button
            className={`nav-tab ${activeView === 'job-history' ? 'active' : ''}`}
            onClick={() => setActiveView('job-history')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Job History
          </button>
          <button
            className={`nav-tab ${activeView === 'webhooks' ? 'active' : ''}`}
            onClick={() => setActiveView('webhooks')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            Webhooks
          </button>
        </div>
      )}

      {/* Metrics View */}
      {!selectedBucket && activeView === 'metrics' && (
        <Suspense fallback={<LazyLoadingFallback />}>
          <MetricsDashboard onClose={() => setActiveView('buckets')} />
        </Suspense>
      )}

      {/* S3 Import View */}
      {!selectedBucket && activeView === 's3-import' && (
        <Suspense fallback={<LazyLoadingFallback />}>
          <div className="s3-import-view">
            <S3ImportPanel
              buckets={buckets.map(b => b.name)}
              onClose={() => setActiveView('buckets')}
              onJobCreated={loadBuckets}
            />
          </div>
        </Suspense>
      )}

      {/* Job History View */}
      {!selectedBucket && activeView === 'job-history' && (
        <Suspense fallback={<LazyLoadingFallback />}>
          <JobHistory buckets={buckets.map(b => ({ name: b.name }))} />
        </Suspense>
      )}

      {/* Webhooks View */}
      {!selectedBucket && activeView === 'webhooks' && (
        <Suspense fallback={<LazyLoadingFallback />}>
          <WebhookManager />
        </Suspense>
      )}

      {/* Buckets View */}
      {!selectedBucket && activeView === 'buckets' && (
        <>
          {/* Sub-tabs for Buckets, File Search, Tag Search */}
          <div className="search-sub-tabs">
            <button
              type="button"
              className={`search-sub-tab ${bucketsSubView === 'list' ? 'active' : ''}`}
              onClick={() => setBucketsSubView('list')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
              Buckets
            </button>
            <button
              type="button"
              className={`search-sub-tab ${bucketsSubView === 'file-search' ? 'active' : ''}`}
              onClick={() => setBucketsSubView('file-search')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              File Search
            </button>
            <button
              type="button"
              className={`search-sub-tab ${bucketsSubView === 'tag-search' ? 'active' : ''}`}
              onClick={() => setBucketsSubView('tag-search')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              Tag Search
            </button>
          </div>

          {/* Buckets List Sub-view */}
          {bucketsSubView === 'list' && (
            <>
              <form
                id="createBucketForm"
                name="createBucketForm"
                onSubmit={handleSubmit}
                className="bucket-controls"
              >
                <input
                  type="text"
                  id="newBucketName"
                  name="newBucketName"
                  value={newBucketName}
                  onChange={(e) => setNewBucketName(e.target.value)}
                  placeholder="New bucket name"
                  className="bucket-input"
                  aria-label="New bucket name"
                />
                <button
                  type="submit"
                  disabled={isCreatingBucket || !newBucketName.trim()}
                  className="bucket-button"
                >
                  {isCreatingBucket ? 'Creating...' : 'Create Bucket'}
                </button>
              </form>

              {error && <div className="error-message">{error}</div>}

              <BucketFilterBar
                filterText={filterText}
                onFilterTextChange={setFilterText}
                sizeFilter={sizeFilter}
                dateFilter={dateFilter}
                onSizeFilterChange={setSizeFilter}
                onDateFilterChange={setDateFilter}
                onSizePresetChange={handleSizePresetChange}
                onCustomSizeRange={handleCustomSizeRange}
                onDatePresetChange={handleDatePresetChange}
                onCustomDateRange={handleCustomDateRange}
                onClearAll={clearAllFilters}
              />

              {(selectedBuckets.length > 0 || buckets.length > 0) && (
                <div className="bulk-action-toolbar">
                  <div className="bulk-action-info">
                    {selectedBuckets.length > 0 && (
                      <span className="bulk-selection-count">
                        {selectedBuckets.length} bucket{selectedBuckets.length !== 1 ? 's' : ''} selected
                      </span>
                    )}
                  </div>
                  <div className="bulk-action-buttons">
                    {buckets.length > 0 && (
                      <button
                        onClick={() => setSelectedBuckets(buckets.map(b => b.name))}
                        className="bulk-select-all-button"
                        disabled={isBulkDeleting || bulkDownloadProgress !== null || selectedBuckets.length === buckets.length}
                      >
                        Select All
                      </button>
                    )}
                    {selectedBuckets.length > 0 && (
                      <button
                        onClick={clearBucketSelection}
                        className="bulk-clear-button"
                        disabled={isBulkDeleting || bulkDownloadProgress !== null}
                      >
                        Deselect All
                      </button>
                    )}
                    {selectedBuckets.length > 0 && (
                      <>
                        <button
                          onClick={handleBulkDownload}
                          className="bulk-download-button"
                          disabled={bulkDownloadProgress !== null}
                        >
                          {bulkDownloadProgress ? (
                            bulkDownloadProgress.status === 'error' ? 'Download Failed' :
                              bulkDownloadProgress.status === 'complete' ? 'Download Complete' :
                                bulkDownloadProgress.status === 'preparing' ? 'Preparing...' :
                                  `Downloading (${Math.round(bulkDownloadProgress.progress)}%)`
                          ) : 'Download Selected'}
                        </button>
                        <button
                          onClick={handleBulkDelete}
                          className="bulk-delete-button"
                          disabled={isBulkDeleting || bulkDownloadProgress !== null}
                        >
                          {isBulkDeleting ? 'Preparing...' : 'Delete Selected'}
                        </button>
                      </>
                    )}
                  </div>
                  <div className="view-toggle-container" style={{ marginLeft: 'auto' }}>
                    <button
                      onClick={toggleBucketViewMode}
                      className="view-mode-toggle-button"
                      title={`Switch to ${bucketViewMode === 'list' ? 'Grid' : 'List'} view`}
                    >
                      {bucketViewMode === 'list' ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="view-icon">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                          </svg>
                          <span>Grid</span>
                        </>
                      ) : (
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
                      )}
                    </button>
                  </div>
                </div>
              )}




              {bucketViewMode === 'list' ? (
                <div className="file-list">
                  <table>
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            className="file-checkbox"
                            checked={selectedBuckets.length > 0 && selectedBuckets.length === buckets.length}
                            onChange={() => {
                              if (selectedBuckets.length === buckets.length) {
                                setSelectedBuckets([])
                              } else {
                                setSelectedBuckets(buckets.map(b => b.name))
                              }
                            }}
                            id="select-all-buckets"
                            name="select-all-buckets"
                            aria-label="Select all buckets"
                          />
                        </th>
                        <th>Name</th>
                        <th>Created</th>
                        <th>Size</th>
                        <th>Items</th>
                        <th>Tags</th>
                        <th>Color</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBuckets.map(bucket => {
                        const isEditing = editingBucketName === bucket.name
                        const isSelected = selectedBuckets.includes(bucket.name)
                        return (
                          <tr
                            key={bucket.name}
                            className={`bucket-list-row ${isSelected ? 'selected' : ''}`}
                            onClick={() => setSelectedBucket(bucket.name)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                id={`bucket-checkbox-${bucket.name}`}
                                name={`bucket-checkbox-${bucket.name}`}
                                className="file-checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  toggleBucketSelection(bucket.name)
                                }}
                                aria-label={`Select bucket ${bucket.name}`}
                              />
                            </td>
                            <td>
                              {isEditing ? (
                                <div className="bucket-edit-mode list-mode" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={editInputValue}
                                    onChange={(e) => setEditInputValue(e.target.value)}
                                    className="bucket-edit-input"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') void saveBucketRename()
                                      if (e.key === 'Escape') cancelEditingBucket()
                                    }}
                                  />
                                  <button onClick={saveBucketRename} className="bucket-edit-save" disabled={isRenamingBucket}>✓</button>
                                  <button onClick={cancelEditingBucket} className="bucket-edit-cancel" disabled={isRenamingBucket}>✕</button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-primary)' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="bucket-icon">
                                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                                    <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
                                  </svg>
                                  <span style={{ fontWeight: 500 }}>{bucket.name}</span>
                                </div>
                              )}
                              {isEditing && editError && <div className="list-edit-error">{editError}</div>}
                            </td>
                            <td>
                              {new Date(bucket.created).toLocaleDateString()}
                            </td>
                            <td>
                              {formatFileSize(bucket.size || 0)}
                            </td>
                            <td>
                              {(bucket.objectCount ?? 0).toLocaleString()}
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <BucketTagPicker bucketName={bucket.name} compact />
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <BucketColorPicker
                                value={bucketColors[bucket.name] ?? null}
                                onChange={(color) => handleBucketColorChange(bucket.name, color)}
                              />
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              {!isEditing && (
                                <div className="file-list-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    onClick={() => startEditingBucket(bucket.name)}
                                    className="bucket-list-action-btn"
                                    title="Rename"
                                  >
                                    Rename
                                  </button>
                                  <button
                                    onClick={() => void deleteBucket(bucket.name)}
                                    className="bucket-list-action-btn delete"
                                    title="Delete"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {buckets.length === 0 && !error && (
                    <div className="empty-state">
                      <p className="empty-text">No buckets found</p>
                      <p className="empty-subtext">Create a bucket to get started</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bucket-grid">
                  {filteredBuckets.map(bucket => {
                    const isEditing = editingBucketName === bucket.name
                    const isSelected = selectedBuckets.includes(bucket.name)
                    return (
                      <div key={bucket.name} className={`bucket-item ${isEditing ? 'editing' : ''} ${isSelected ? 'selected' : ''}`}>
                        {isEditing ? (
                          <div className="bucket-edit-mode">
                            <input
                              type="text"
                              id="bucket-edit-name"
                              name="bucket-edit-name"
                              value={editInputValue}
                              onChange={(e) => setEditInputValue(e.target.value)}
                              className="bucket-edit-input"
                              placeholder="New bucket name"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void saveBucketRename()
                                if (e.key === 'Escape') cancelEditingBucket()
                              }}
                            />
                            {editError && <p className="bucket-edit-error">{editError}</p>}
                            <div className="bucket-edit-actions">
                              <button
                                onClick={saveBucketRename}
                                className="bucket-edit-save"
                                disabled={isRenamingBucket}
                              >
                                {isRenamingBucket ? 'Renaming...' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEditingBucket}
                                className="bucket-edit-cancel"
                                disabled={isRenamingBucket}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="bucket-checkbox-container">
                              <input
                                type="checkbox"
                                id={`bucket-select-${bucket.name}`}
                                name={`bucket-select-${bucket.name}`}
                                className="bucket-checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  toggleBucketSelection(bucket.name)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Select ${bucket.name}`}
                              />
                            </div>
                            <div
                              className="bucket-content"
                              onClick={() => setSelectedBucket(bucket.name)}
                            >
                              <h3 className="bucket-name">{bucket.name}</h3>
                              <p className="bucket-date">
                                Created: {new Date(bucket.created).toLocaleDateString()}
                              </p>
                              <p className="bucket-size">
                                Total Size: {formatFileSize(bucket.size || 0)}
                              </p>
                              <p className="bucket-count">
                                Items: {(bucket.objectCount ?? 0).toLocaleString()}
                              </p>
                            </div>
                            <div className="bucket-tags-container" onClick={(e) => e.stopPropagation()}>
                              {/* Tags area (includes tag icon + tags) */}
                              <BucketTagPicker bucketName={bucket.name} />
                              {/* Color picker at bottom - aligns across all cards */}
                              <BucketColorPicker
                                value={bucketColors[bucket.name] ?? null}
                                onChange={(color) => handleBucketColorChange(bucket.name, color)}
                              />
                            </div>
                            <div className="bucket-actions">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startEditingBucket(bucket.name)
                                }}
                                className="bucket-edit"
                                title="Rename bucket"
                              >
                                Rename
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void deleteBucket(bucket.name)
                                }}
                                className="bucket-delete"
                              >
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                  {buckets.length === 0 && !error && (
                    <div className="empty-state">
                      <p className="empty-text">No buckets found</p>
                      <p className="empty-subtext">Create a bucket to get started</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* File Search Sub-view */}
          {bucketsSubView === 'file-search' && (
            <div className="search-content">
              <CrossBucketSearch onNavigateToBucket={handleBucketNavigate} />
            </div>
          )}

          {/* Tag Search Sub-view */}
          {bucketsSubView === 'tag-search' && (
            <div className="search-content">
              <TagSearch onNavigateToBucket={handleBucketNavigate} />
            </div>
          )}

          {/* Delete confirmation modal - always render outside view-specific code */}
          {deleteConfirmState && (
            <div className="modal-overlay" onClick={() => !deleteConfirmState.isDeleting && setDeleteConfirmState(null)}>
              <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                <h2>
                  {deleteConfirmState.bucketNames.length === 1
                    ? 'Delete Non-Empty Bucket?'
                    : `Delete ${deleteConfirmState.bucketNames.length} Non-Empty Buckets?`}
                </h2>

                {deleteConfirmState.bucketNames.length === 1 ? (
                  <p>
                    Bucket <strong>{deleteConfirmState.bucketNames[0]}</strong> contains{' '}
                    <strong>{deleteConfirmState.totalFiles ?? 'multiple'}</strong> file(s).
                  </p>
                ) : (
                  <>
                    <div className="bucket-list-in-modal">
                      <p><strong>Buckets to delete:</strong></p>
                      <ul>
                        {deleteConfirmState.bucketNames.map(name => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                      {deleteConfirmState.totalFiles !== null && (
                        <p className="total-files-count">
                          Total files: <strong>{deleteConfirmState.totalFiles}</strong>
                        </p>
                      )}
                    </div>
                  </>
                )}

                <p style={{ color: '#ff6b6b', fontWeight: 'bold' }}>
                  ⚠️ This will permanently delete all files and {deleteConfirmState.bucketNames.length === 1 ? 'the bucket' : 'these buckets'}. This cannot be undone.
                </p>

                {deleteConfirmState.isDeleting && deleteConfirmState.currentProgress && (
                  <div className="bulk-delete-progress">
                    <p>Deleting bucket {deleteConfirmState.currentProgress.current} of {deleteConfirmState.currentProgress.total}...</p>
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${(deleteConfirmState.currentProgress.current / deleteConfirmState.currentProgress.total) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    className="modal-button cancel"
                    onClick={() => setDeleteConfirmState(null)}
                    disabled={deleteConfirmState.isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    className="modal-button delete"
                    onClick={confirmForceBucketDelete}
                    disabled={deleteConfirmState.isDeleting}
                  >
                    {deleteConfirmState.isDeleting
                      ? 'Deleting...'
                      : deleteConfirmState.bucketNames.length === 1
                        ? 'Delete Bucket & All Files'
                        : `Delete ${deleteConfirmState.bucketNames.length} Buckets & All Files`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Selected Bucket View */}
      {selectedBucket && (
        <div className="upload-overlay">
          <div className="upload-panel">
            <div className="upload-header">
              <h2>Bucket Name: {selectedBucket}</h2>
              <button
                className="ai-search-toggle-btn"
                onClick={() => setShowAISearch(!showAISearch)}
                title="AI Search"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                  <path d="M11 8v6M8 11h6" />
                </svg>
                {showAISearch ? 'Hide AI Search' : 'AI Search'}
              </button>
            </div>

            {showAISearch && (
              <AISearchPanel
                bucketName={selectedBucket}
                onClose={() => setShowAISearch(false)}
              />
            )}

            {error && <div className="error-message">{error}</div>}

            {rejectedFiles.length > 0 && (
              <div className="rejected-files">
                <div className="rejected-files-header">
                  <h3>Invalid Files</h3>
                  <button onClick={clearRejectedFiles} className="clear-rejected">
                    Clear
                  </button>
                </div>
                {rejectedFiles.map(({ file, error }) => (
                  <div key={file.name} className="rejected-file">
                    <span className="rejected-filename">{file.name}</span>
                    <span className="rejected-error">{error}</span>
                  </div>
                ))}
              </div>
            )}

            <div
              {...getRootProps()}
              className={`dropzone ${isDragActive ? 'active' : ''} ${isUploading ? 'uploading' : ''}`}
            >
              <input
                {...getInputProps()}
                id="fileUpload"
                name="fileUpload"
              />
              <div className="dropzone-content">
                {isUploading ? (
                  <div className="upload-progress-container">
                    {uploadProgress.map(({
                      fileName,
                      progress,
                      status,
                      currentChunk,
                      totalChunks,
                      retryAttempt,
                      error: uploadError
                    }) => (
                      <div
                        key={fileName}
                        className={`upload-progress-item upload-${status}`}
                      >
                        <div className="upload-progress-info">
                          <span className="upload-filename">{fileName}</span>
                          <span className="upload-percentage">
                            {status === 'retrying' ? (
                              `Retrying chunk ${currentChunk}/${totalChunks} (Attempt ${retryAttempt})`
                            ) : status === 'verifying' ? (
                              'Verifying...'
                            ) : status === 'verified' ? (
                              '✓ Verified'
                            ) : status === 'error' ? (
                              'Failed'
                            ) : (
                              `${Math.round(progress)}%`
                            )}
                          </span>
                        </div>
                        <div className="upload-progress-bar">
                          <div
                            className="upload-progress-fill"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        {uploadError && (
                          <div className="upload-error-message">
                            {uploadError}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : isDragActive ? (
                  <p>Drop the files here...</p>
                ) : (
                  <div className="upload-instructions">
                    <p>Drag & drop files here or click to select files.</p>
                    <div className="file-type-limits">
                      <p>Accepted file types and size limits:</p>
                      <ul>
                        <li>Archives (7Z, GZ, RAR, TAR, ZIP) - up to 500MB</li>
                        <li>Audio (AAC, FLAC, M4A, MP3, OGG, OPUS, WAV) - up to 100MB</li>
                        <li>Code (CSS, GO, HTML, Java, JS, Rust, TS, Python, etc.) - up to 10MB</li>
                        <li>Config & Metadata (CONF, ENV, INI, JSON, JSONC, LOCK, TOML, etc.) - up to 10MB</li>
                        <li>Data Formats (AVRO, FEATHER, NDJSON) - up to 50MB</li>
                        <li>Databases (DB, PARQUET, SQL) - up to 50MB</li>
                        <li>Dev Environment (Dockerfile, editorconfig, .gitignore, nvmrc, etc.) - up to 1MB</li>
                        <li>Documents (CSV, Excel, Markdown, PDF, PowerPoint, TXT, Word, etc.) - up to 50MB</li>
                        <li>Documentation (NFO) - up to 10MB</li>
                        <li>Fonts (EOT, OTF, TTF, WOFF, WOFF2) - up to 10MB</li>
                        <li>Images (AVIF, BMP, GIF, HEIC, JPG, PNG, PSD, SVG, WebP) - up to 15MB</li>
                        <li>Jupyter Notebooks (.ipynb) - up to 10MB</li>
                        <li>Videos (3GP, AVI, FLV, M4V, MKV, MOV, MP4, MPEG, OGG, WebM, WMV) - up to 500MB</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <FileGrid
              bucketName={selectedBucket}
              onFilesChange={loadBuckets}
              refreshTrigger={refreshTrigger}
              availableBuckets={buckets.map(b => b.name)}
              onBucketNavigate={handleBucketNavigate}
              onPathChange={handlePathChange}
            />
          </div>
        </div>
      )}
    </div>
  )
}

