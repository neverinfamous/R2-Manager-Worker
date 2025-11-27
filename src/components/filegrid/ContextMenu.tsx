import { type JSX } from 'react'

interface ContextMenuProps {
  show: boolean
  x: number
  y: number
  itemType: 'file' | 'folder'
  onClose: () => void
  onRename: () => void
  onCopyLink?: (() => void) | undefined
}

export const ContextMenu = ({
  show,
  x,
  y,
  itemType,
  onClose,
  onRename,
  onCopyLink
}: ContextMenuProps): JSX.Element | null => {
  if (!show) return null

  return (
    <>
      <div 
        className="context-menu-overlay" 
        onClick={onClose}
      />
      <div 
        className="context-menu"
        style={{
          position: 'fixed',
          top: `${y}px`,
          left: `${x}px`,
          zIndex: 1000
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onRename}>
          ✏️ Rename
        </button>
        {itemType === 'file' && onCopyLink && (
          <button onClick={() => {
            onCopyLink()
            onClose()
          }}>
            🔗 Copy Link
          </button>
        )}
      </div>
    </>
  )
}

