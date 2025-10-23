import { useCallback, useEffect, useState, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import './app.css'
import { FileGrid } from './filegrid'
import { api } from './services/api'
import { auth } from './services/auth'
import type { FileRejection, FileWithPath } from 'react-dropzone'

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
  size?: number
}

interface UploadProgress {
  fileName: string
  progress: number
  status: 'uploading' | 'retrying' | 'completed' | 'error'
  error?: string
  currentChunk?: number
  totalChunks?: number
  retryAttempt?: number
}

interface RejectedFile {
  file: FileWithPath
  error: string
}

export default function BucketManager() {
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
    bucketName: string | null
    fileCount: number | null
    isDeleting: boolean
  } | null>(null)
  const [editingBucketName, setEditingBucketName] = useState<string | null>(null)
  const [editInputValue, setEditInputValue] = useState('')
  const [editError, setEditError] = useState('')
  const [isRenamingBucket, setIsRenamingBucket] = useState(false)

  // Don't use react-dropzone's built-in accept filter since it's too strict
  // Many file types (especially code files) don't have reliable MIME types
  // Instead, we use a custom validator that checks both MIME type and extension
  const acceptedFileTypes = useMemo(() => {
    return undefined // Accept all files, validate in custom validator
  }, [])

  const handleNavigateHome = useCallback(() => {
    // Just clear selected bucket to return to bucket list (fast React state update)
    setSelectedBucket(null)
    setCurrentPath('')
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

  const loadBuckets = useCallback(async () => {
    try {
      setError('')
      const bucketList = await api.listBuckets()
      setBuckets(bucketList || [])
    } catch (err) {
      console.error('Error loading buckets:', err)
      setError('Failed to load buckets')
      setBuckets([])
      if ((err as Error).message.includes('401')) {
        handleLogout()
      }
    }
  }, [handleLogout])

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
                maxRetries: 3,
                retryDelay: 1000
              },
              currentPath || undefined
            )
            
            updateProgress(file.name, 100, 'completed')
            setRefreshTrigger(prev => prev + 1)
          } catch (err) {
            console.error(`Failed to upload ${file.name}:`, err)
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
              handleLogout()
              return
            }
          }
        }
      } catch (err) {
        console.error('Upload error:', err)
        setError('Failed to upload one or more files')
      } finally {
        setIsUploading(false)
      }
    }
  }, [selectedBucket, isUploading, updateProgress, handleLogout])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    validator: (file) => {
      const validation = api.validateFile(file)
      if (!validation.valid) {
        return {
          code: "file-invalid-type",
          message: validation.error || 'Invalid file'
        }
      }
      return null
    }
  })

  useEffect(() => {
    loadBuckets()
  }, [loadBuckets])

  const createBucket = async () => {
    if (!newBucketName.trim()) return
    
    setIsCreatingBucket(true)
    setError('')
    
    try {
      await api.createBucket(newBucketName.trim())
      await loadBuckets()
      setNewBucketName('')
    } catch (err) {
      setError('Failed to create bucket')
      if ((err as Error).message.includes('401')) {
        handleLogout()
      }
    } finally {
      setIsCreatingBucket(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isCreatingBucket) {
      await createBucket()
    }
  }

  const deleteBucket = async (name: string) => {
    setError('')
    try {
      const response = await api.deleteBucket(name)
      console.log('[DeleteBucket] Response:', response)
      
      // Check if deletion failed because bucket isn't empty
      // Cloudflare returns 409 Conflict (success: false, errors array) for non-empty buckets
      if (response.success === false && response.errors?.length > 0) {
        // Bucket isn't empty - show confirmation dialog
        try {
          const files = await api.listFiles(name, undefined, 1000)
          const fileCount = files.objects.length
          setDeleteConfirmState({
            bucketName: name,
            fileCount,
            isDeleting: false
          })
        } catch {
          // If we can't get file count, show a generic count
          setDeleteConfirmState({
            bucketName: name,
            fileCount: null,
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
      
      if (!response.success) {
        setError('Failed to delete bucket.')
        return
      }
      
      await loadBuckets()
      if (selectedBucket === name) {
        setSelectedBucket(null)
      }
    } catch (err) {
      setError('Failed to delete bucket.')
      console.error('[DeleteBucket] Error:', err)
      if ((err as Error).message.includes('401')) {
        handleLogout()
      }
    }
  }

  const confirmForceBucketDelete = async () => {
    if (!deleteConfirmState?.bucketName) return

    const bucketName = deleteConfirmState.bucketName
    setError('')
    setDeleteConfirmState(prev => prev ? { ...prev, isDeleting: true } : null)

    try {
      const response = await api.deleteBucket(bucketName, { force: true })

      if (response.success) {
        await loadBuckets()
        if (selectedBucket === bucketName) {
          setSelectedBucket(null)
        }
        setDeleteConfirmState(null)
      } else {
        setError(response.error || 'Failed to delete bucket')
        setDeleteConfirmState(prev => prev ? { ...prev, isDeleting: false } : null)
      }
    } catch (err) {
      setError('Failed to delete bucket')
      console.error('Force delete error:', err)
      setDeleteConfirmState(prev => prev ? { ...prev, isDeleting: false } : null)
    }
  }

  const startEditingBucket = (bucketName: string) => {
    setEditingBucketName(bucketName)
    setEditInputValue(bucketName)
    setEditError('')
  }

  const cancelEditingBucket = () => {
    setEditingBucketName(null)
    setEditInputValue('')
    setEditError('')
  }

  const saveBucketRename = async () => {
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
      await loadBuckets()
      cancelEditingBucket()
      setIsRenamingBucket(false)
    } catch (err) {
      setIsRenamingBucket(false)
      const errorMessage = err instanceof Error ? err.message : 'Failed to rename bucket'
      setEditError(errorMessage)
      console.error('Rename error:', err)
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
            R2 Bucket Manager
          </h1>
          <button 
            onClick={handleLogout}
            className="logout-button"
          >
            Logout
          </button>
        </div>
      </header>

      {!selectedBucket && (
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

          <div className="bucket-grid">
            {buckets.map(bucket => {
              const isEditing = editingBucketName === bucket.name
              return (
              <div key={bucket.name} className={`bucket-item ${isEditing ? 'editing' : ''}`}>
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
                        if (e.key === 'Enter') saveBucketRename()
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
                    </div>
                    <div className="bucket-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditingBucket(bucket.name)
                        }}
                        className="bucket-edit"
                        title="Edit bucket name"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteBucket(bucket.name)
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
        </>
      )}

      {deleteConfirmState && (
        <div className="modal-overlay" onClick={() => !deleteConfirmState.isDeleting && setDeleteConfirmState(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Delete Non-Empty Bucket?</h2>
            <p>
              Bucket <strong>{deleteConfirmState.bucketName}</strong> contains{' '}
              <strong>{deleteConfirmState.fileCount !== null ? deleteConfirmState.fileCount : 'multiple'}</strong> file(s).
            </p>
            <p style={{ color: '#ff6b6b', fontWeight: 'bold' }}>
              ⚠️ This will permanently delete all files and the bucket. This cannot be undone.
            </p>
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
                {deleteConfirmState.isDeleting ? 'Deleting...' : 'Delete Bucket & All Files'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedBucket && (
        <div className="upload-overlay">
          <div className="upload-panel">
            <div className="upload-header">
              <h2>{selectedBucket}</h2>
            </div>

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
                    <p>Drag & drop files here, or click to select files</p>
                    <div className="file-type-limits">
                      <p>Accepted file types and size limits:</p>
                      <ul>
                        <li>Archives (7Z, GZ, RAR, TAR, ZIP) - up to 500MB</li>
                        <li>Code (CSS, GO, HTML, Java, JS, Rust, TS, Python, etc.) - up to 10MB</li>
                        <li>Databases (DB, SQL) - up to 50MB</li>
                        <li>Documents (PDF, Word, Excel, PowerPoint, RTF, CSV, text) - up to 50MB</li>
                        <li>Images (AVIF, BMP, GIF, HEIC, JPG, PNG, SVG, WebP) - up to 15MB</li>
                        <li>Jupyter Notebooks (.ipynb) - up to 10MB</li>
                        <li>Videos (MP4, MOV, WebM) - up to 500MB</li>

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
              onPathChange={setCurrentPath}
            />
          </div>
        </div>
      )}
    </div>
  )
}