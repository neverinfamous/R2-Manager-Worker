import { FileObject } from '../types/auth'

interface ContextMenuProps {
  x: number
  y: number
  file: FileObject
  onClose: () => void
  onDelete: (file: FileObject) => void
  onDownload: (file: FileObject) => void
}

export function ContextMenu({
  x,
  y,
  file,
  onClose,
  onDelete,
  onDownload
}: ContextMenuProps) {
  
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
    </div>
  )
}
