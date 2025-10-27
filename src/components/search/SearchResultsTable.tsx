import { useState, useCallback, useEffect } from 'react'
import type { SearchResult, SortColumn, SortDirection } from '../../types/search'
import { formatFileSize } from '../../utils/fileUtils'
import { api } from '../../services/api'

interface SearchResultsTableProps {
  results: SearchResult[]
  isSearching: boolean
  sortColumn: SortColumn
  sortDirection: SortDirection
  onSort: (column: SortColumn) => void
  onRefresh?: () => void
  onNavigateToBucket?: (bucketName: string) => void
}

export function SearchResultsTable({
  results,
  isSearching,
  sortColumn,
  sortDirection,
  onSort,
  onRefresh,
  onNavigateToBucket
}: SearchResultsTableProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [transferModalState, setTransferModalState] = useState<{
    show: boolean
    mode: 'move' | 'copy'
    sourceBucket: string
    sourceKey: string
    targetBucket: string | null
    targetPath: string
    isTransferring: boolean
    infoMessage: string
  } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ bucket: string; key: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [availableBuckets, setAvailableBuckets] = useState<string[]>([])

  const toggleFileSelection = useCallback((bucket: string, key: string) => {
    const id = `${bucket}:${key}`
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Load available buckets for transfer
  useEffect(() => {
    const loadBuckets = async () => {
      try {
        const buckets = await api.listBuckets()
        setAvailableBuckets(buckets.map((b: { name: string }) => b.name))
      } catch (err) {
        console.error('Failed to load buckets:', err)
      }
    }
    loadBuckets()
  }, [])

  const handleDownload = useCallback(async (bucket: string, key: string) => {
    try {
      const url = await api.getSignedUrl(bucket, key)
      window.open(url, '_blank')
    } catch (err) {
      console.error('Download error:', err)
      alert('Failed to download file: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }, [])

  const handleDelete = useCallback(async (bucket: string, key: string) => {
    setIsDeleting(true)
    try {
      await api.deleteFile(bucket, key)
      setDeleteConfirm(null)
      if (onRefresh) {
        onRefresh()
      }
    } catch (err) {
      console.error('Delete error:', err)
      alert('Failed to delete file: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsDeleting(false)
    }
  }, [onRefresh])

  const handleMove = useCallback((bucket: string, key: string) => {
    setTransferModalState({
      show: true,
      mode: 'move',
      sourceBucket: bucket,
      sourceKey: key,
      targetBucket: null,
      targetPath: '',
      isTransferring: false,
      infoMessage: ''
    })
  }, [])

  const handleCopy = useCallback((bucket: string, key: string) => {
    setTransferModalState({
      show: true,
      mode: 'copy',
      sourceBucket: bucket,
      sourceKey: key,
      targetBucket: null,
      targetPath: '',
      isTransferring: false,
      infoMessage: ''
    })
  }, [])

  const handleTransferSubmit = useCallback(async () => {
    if (!transferModalState || !transferModalState.targetBucket) return

    setTransferModalState(prev => prev ? { ...prev, isTransferring: true, infoMessage: 'Transferring...' } : null)

    try {
      const fileName = transferModalState.sourceKey.split('/').pop() || transferModalState.sourceKey
      
      if (transferModalState.mode === 'move') {
        await api.moveFile(
          transferModalState.sourceBucket,
          transferModalState.sourceKey,
          transferModalState.targetBucket,
          transferModalState.targetPath ? `${transferModalState.targetPath}${fileName}` : fileName
        )
      } else {
        await api.copyFile(
          transferModalState.sourceBucket,
          transferModalState.sourceKey,
          transferModalState.targetBucket,
          transferModalState.targetPath ? `${transferModalState.targetPath}${fileName}` : fileName
        )
      }

      setTransferModalState(null)
      if (onRefresh) {
        onRefresh()
      }
    } catch (err) {
      console.error('Transfer error:', err)
      setTransferModalState(prev => prev ? {
        ...prev,
        isTransferring: false,
        infoMessage: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      } : null)
    }
  }, [transferModalState, onRefresh])

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return '⇅'
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  const getFileName = (key: string) => {
    return key.split('/').pop() || key
  }

  if (isSearching) {
    return (
      <div className="search-results-loading">
        <div className="loading-spinner"></div>
        <p>Searching across buckets...</p>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="search-results-empty">
        <p>No files found matching your search criteria</p>
        <p className="empty-subtext">Try adjusting your filters or search query</p>
      </div>
    )
  }

  return (
    <>
      <div className="search-results-container">
        <div className="search-results-header">
          <span className="search-results-count">
            {results.length} {results.length === 1 ? 'result' : 'results'} found
          </span>
        </div>

        <div className="search-results-table-wrapper">
          <table className="search-results-table">
            <thead>
              <tr>
                <th className="checkbox-column">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedFiles(new Set(results.map(r => `${r.bucket}:${r.key}`)))
                      } else {
                        setSelectedFiles(new Set())
                      }
                    }}
                    checked={selectedFiles.size === results.length && results.length > 0}
                  />
                </th>
                <th className="sortable" onClick={() => onSort('filename')}>
                  Filename {getSortIcon('filename')}
                </th>
                <th className="sortable" onClick={() => onSort('bucket')}>
                  Bucket {getSortIcon('bucket')}
                </th>
                <th className="sortable" onClick={() => onSort('size')}>
                  Size {getSortIcon('size')}
                </th>
                <th className="sortable" onClick={() => onSort('uploaded')}>
                  Uploaded {getSortIcon('uploaded')}
                </th>
                <th className="actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => {
                const id = `${result.bucket}:${result.key}`
                const isSelected = selectedFiles.has(id)
                
                return (
                  <tr key={id} className={isSelected ? 'selected' : ''}>
                    <td className="checkbox-column">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleFileSelection(result.bucket, result.key)}
                      />
                    </td>
                    <td className="filename-column">
                      <span className="filename" title={result.key}>
                        {getFileName(result.key)}
                      </span>
                    </td>
                    <td className="bucket-column">
                      <span 
                        className="bucket-badge"
                        onClick={() => onNavigateToBucket?.(result.bucket)}
                        title={`Go to ${result.bucket}`}
                      >
                        {result.bucket}
                      </span>
                    </td>
                    <td className="size-column">
                      {formatFileSize(result.size)}
                    </td>
                    <td className="date-column">
                      {new Date(result.uploaded).toLocaleDateString()}
                    </td>
                    <td className="actions-column">
                      <div className="action-buttons">
                        <button
                          className="action-button download"
                          onClick={() => handleDownload(result.bucket, result.key)}
                          title="Download"
                        >
                          ⬇
                        </button>
                        <button
                          className="action-button move"
                          onClick={() => handleMove(result.bucket, result.key)}
                          title="Move"
                        >
                          ➜
                        </button>
                        <button
                          className="action-button copy"
                          onClick={() => handleCopy(result.bucket, result.key)}
                          title="Copy"
                        >
                          ⧉
                        </button>
                        <button
                          className="action-button delete"
                          onClick={() => setDeleteConfirm({ bucket: result.bucket, key: result.key })}
                          title="Delete"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transfer Modal */}
      {transferModalState && transferModalState.show && (
        <div className="modal-overlay" onClick={() => !transferModalState.isTransferring && setTransferModalState(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{transferModalState.mode === 'move' ? 'Move' : 'Copy'} File</h2>
            <p>From bucket: <strong>{transferModalState.sourceBucket}</strong></p>
            <p>File: <strong>{getFileName(transferModalState.sourceKey)}</strong></p>
            
            <div className="bucket-selector">
              <label htmlFor="destination-bucket-select">Select destination bucket:</label>
              <select
                id="destination-bucket-select"
                value={transferModalState.targetBucket || ''}
                onChange={(e) => setTransferModalState(prev => prev ? { ...prev, targetBucket: e.target.value || null } : null)}
                disabled={transferModalState.isTransferring}
              >
                <option value="">-- Choose a bucket --</option>
                {availableBuckets.map(bucket => (
                  <option key={bucket} value={bucket}>{bucket}</option>
                ))}
              </select>
            </div>

            <div className="bucket-selector">
              <label htmlFor="destination-path-input">Destination folder path (optional):</label>
              <input
                id="destination-path-input"
                type="text"
                value={transferModalState.targetPath}
                onChange={(e) => setTransferModalState(prev => prev ? { ...prev, targetPath: e.target.value } : null)}
                disabled={transferModalState.isTransferring}
                placeholder="e.g., images/ or leave empty for root"
              />
              <p style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
                Leave empty to transfer to the root folder. End with / for folders.
              </p>
            </div>

            {transferModalState.infoMessage && (
              <p className="info-message">{transferModalState.infoMessage}</p>
            )}

            <div className="modal-actions">
              <button
                onClick={() => setTransferModalState(null)}
                disabled={transferModalState.isTransferring}
                className="modal-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferSubmit}
                disabled={transferModalState.isTransferring || !transferModalState.targetBucket}
                className="modal-confirm"
              >
                {transferModalState.isTransferring ? 'Transferring...' : (transferModalState.mode === 'move' ? 'Move' : 'Copy')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => !isDeleting && setDeleteConfirm(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Delete File?</h2>
            <p>
              Are you sure you want to delete <strong>{getFileName(deleteConfirm.key)}</strong> from bucket{' '}
              <strong>{deleteConfirm.bucket}</strong>?
            </p>
            <p className="warning-text">This action cannot be undone.</p>
            <div className="modal-actions">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="modal-cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.bucket, deleteConfirm.key)}
                disabled={isDeleting}
                className="modal-confirm-delete"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

