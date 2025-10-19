import { useCallback, useEffect, useState } from 'react'
import './app.css'
import { FileGrid } from './filegrid'
import { api } from './services/api'
import { auth } from './services/auth'

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

export default function BucketManager() {
  const [buckets, setBuckets] = useState<BucketObject[]>([])
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
  const [newBucketName, setNewBucketName] = useState('')
  const [isCreatingBucket, setIsCreatingBucket] = useState(false)
  const [error, setError] = useState<string>('')
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    bucketName: string | null
    fileCount: number | null
    isDeleting: boolean
  } | null>(null)
  const [editingBucketName, setEditingBucketName] = useState<string | null>(null)
  const [editInputValue, setEditInputValue] = useState('')
  const [editError, setEditError] = useState('')
  const [isRenamingBucket, setIsRenamingBucket] = useState(false)

  const handleHardRefresh = () => {
    window.location.reload()
  }

  const handleLogout = useCallback(async () => {
    await auth.logout()
    // No-op, Cloudflare Access handles auth
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




  // File uploads currently disabled - Cloudflare Access simplified UI
  // Keeping structure for future file upload support

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
          onClick={handleHardRefresh}
        />
        <div className="header-content">
          <h1 className="app-title" onClick={handleHardRefresh}>
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

      {selectedBucket && <FileGrid bucketName={selectedBucket} />}
    </div>
  )
}