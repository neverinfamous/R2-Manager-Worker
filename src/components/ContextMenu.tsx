import { useState, useEffect } from 'react'
import { FileObject } from '../types/auth'
import { api } from '../services/api'

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
  const [isElectron, setIsElectron] = useState(false)
  const suggestedApps = api.getRecommendedApps(file.key)

  useEffect(() => {
    // Check if running in Electron/Tauri environment
    const electronAPI = (window as unknown as Record<string, unknown>).electron
    const tauriAPI = (window as unknown as Record<string, unknown>).__TAURI__
    setIsElectron(!!electronAPI || !!tauriAPI)
  }, [])

  // Adjust position to stay within viewport
  useEffect(() => {
    const menu = document.querySelector('.context-menu')
    if (menu) {
      const rect = menu.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let adjustedX = x
      let adjustedY = y

      if (rect.right > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10
      }
      if (rect.bottom > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10
      }

      if (adjustedX !== x || adjustedY !== y) {
        const htmlElement = menu as HTMLElement
        htmlElement.style.left = `${adjustedX}px`
        htmlElement.style.top = `${adjustedY}px`
      }
    }
  }, [x, y])

  const handleClickOutside = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="context-menu-backdrop"
      onClick={handleClickOutside}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="context-menu"
        style={{
          top: `${y}px`,
          left: `${x}px`
        }}
        onMouseLeave={onClose}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="context-menu-item"
          onClick={() => {
            onOpen(file)
            onClose()
          }}
          title={isElectron ? 'Open in default application' : 'Download and open file'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="context-menu-icon"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {isElectron ? 'Open with Default App' : 'Download & Open'}
        </button>

        <button
          className="context-menu-item"
          onClick={() => {
            onDownload(file)
            onClose()
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="context-menu-icon"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download
        </button>

        <button
          className="context-menu-item delete"
          onClick={() => {
            onDelete(file)
            onClose()
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="context-menu-icon"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
          Delete
        </button>

        {suggestedApps.length > 0 && (
          <>
            <hr className="context-menu-divider" />
            <div className="context-menu-label">Recommended Apps</div>
            {suggestedApps.map((app: { name: string; url: string | null }) => (
              app.url ? (
                <a
                  key={app.name}
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="context-menu-app"
                  onClick={onClose}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="context-menu-icon"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  {app.name}
                </a>
              ) : null
            ))}
          </>
        )}
      </div>
    </div>
  )
}
