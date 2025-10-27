interface CreateFolderModalProps {
  show: boolean
  bucketName: string
  currentPath: string
  newFolderName: string
  isCreating: boolean
  onClose: () => void
  onFolderNameChange: (name: string) => void
  onSubmit: () => void
}

export const CreateFolderModal = ({
  show,
  bucketName,
  currentPath,
  newFolderName,
  isCreating,
  onClose,
  onFolderNameChange,
  onSubmit
}: CreateFolderModalProps) => {
  if (!show) return null

  return (
    <div className="modal-overlay" onClick={() => !isCreating && onClose()}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Create New Folder</h2>
        {currentPath && <p>In: <strong>{bucketName}/{currentPath}</strong></p>}
        {!currentPath && <p>In: <strong>{bucketName}</strong></p>}
        
        <div className="bucket-selector">
          <label htmlFor="new-folder-name">Folder name:</label>
          <input
            id="new-folder-name"
            type="text"
            value={newFolderName}
            onChange={(e) => onFolderNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newFolderName.trim()) {
                onSubmit()
              }
            }}
            disabled={isCreating}
            placeholder="Enter folder name"
            autoFocus
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '14px',
              border: '1px solid #444',
              borderRadius: '4px',
              backgroundColor: '#2a2a2a',
              color: '#fff'
            }}
          />
          <p style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
            Use letters, numbers, hyphens, underscores, and forward slashes for nested folders
          </p>
        </div>

        <div className="modal-actions">
          <button
            className="modal-button cancel"
            onClick={() => {
              onClose()
            }}
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            className="modal-button"
            onClick={onSubmit}
            disabled={!newFolderName.trim() || isCreating}
            style={{ backgroundColor: '#2a7d2e' }}
          >
            {isCreating ? 'Creating...' : 'Create Folder'}
          </button>
        </div>
      </div>
    </div>
  )
}

