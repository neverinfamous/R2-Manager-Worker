import { FileObject } from '../types/auth'

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
        title="Open with default application"
      >
        ↗️ Open
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
    </div>
  )
}
