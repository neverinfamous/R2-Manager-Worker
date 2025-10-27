interface RenameModalProps {
  show: boolean
  itemType: 'file' | 'folder'
  itemKey: string
  newName: string
  error: string
  isRenaming: boolean
  onClose: () => void
  onNewNameChange: (name: string) => void
  onSubmit: () => void
}

export const RenameModal = ({
  show,
  itemType,
  itemKey,
  newName,
  error,
  isRenaming,
  onClose,
  onNewNameChange,
  onSubmit
}: RenameModalProps) => {
  if (!show) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Rename {itemType === 'file' ? 'File' : 'Folder'}</h2>
        
        <div className="rename-input-container">
          <div className="rename-current-name-section">
            <span className="rename-label">Current name:</span>
            <p className="current-name">{itemKey.split('/').pop()}</p>
          </div>
          
          <label htmlFor="rename-new-name">New name:</label>
          <input
            id="rename-new-name"
            name="rename-new-name"
            type="text"
            value={newName}
            onChange={(e) => onNewNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit()
              if (e.key === 'Escape') onClose()
            }}
            autoFocus
            placeholder="Enter new name"
            aria-label="New name"
            aria-describedby={error ? 'rename-error' : undefined}
          />
          
          {error && (
            <p id="rename-error" className="error-message" role="alert">{error}</p>
          )}
        </div>

        <div className="modal-actions">
          <button 
            className="modal-button cancel"
            onClick={onClose}
            disabled={isRenaming}
          >
            Cancel
          </button>
          <button
            className="modal-button"
            onClick={onSubmit}
            disabled={!newName.trim() || isRenaming}
          >
            {isRenaming ? 'Renaming...' : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  )
}

