import { FileObject } from '../types/auth'
import { api } from '../services/api'

export interface RecommendedApp {
  name: string
  url: string | null
}

interface ContextMenuProps {
  x: number
  y: number
  file: FileObject
  onClose: () => void
  onOpen: (file: FileObject) => void
  onDelete: (file: FileObject) => void
  onDownload: (file: FileObject) => void
}

export function ContextMenu({
  x,
  y,
  file,
  onClose,
  onOpen,
  onDelete,
  onDownload
}: ContextMenuProps) {
  const suggestedApps = api.getRecommendedApps(file.key)
  
  const handleOpenClick = () => {
    onOpen(file)
    onClose()
  }

  const handleDownloadClick = () => {
    onDownload(file)
    onClose()
  }

  const handleDeleteClick = () => {
    onDelete(file)
    onClose()
  }

  return (
    <div
      className="context-menu"
      style={{ 
        top: `${y}px`, 
        left: `${x}px`,
        position: 'fixed'
      }}
      onMouseLeave={onClose}
      onClick={(e) => e.stopPropagation()}
    >
      <button 
        className="context-menu-button"
        onClick={handleOpenClick}
        title="Download and open with default application"
      >
        ↗️ Open with Default App
      </button>
      
      <button 
        className="context-menu-button"
        onClick={handleDownloadClick}
      >
        ⬇️ Download
      </button>
      
      <button 
        className="context-menu-button delete"
        onClick={handleDeleteClick}
      >
        🗑️ Delete
      </button>
      
      {suggestedApps.length > 0 && (
        <>
          <hr className="context-menu-divider" />
          <span className="context-menu-label">Suggested Apps:</span>
          {suggestedApps.map((app) => (
            <a
              key={app.name}
              href={app.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="context-menu-app"
              onClick={app.url ? undefined : (e) => e.preventDefault()}
            >
              {app.name}
            </a>
          ))}
        </>
      )}
    </div>
  )
}
