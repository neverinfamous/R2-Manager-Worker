import { useCallback, useEffect, useRef, type JSX } from 'react'
import { type EXTENSION_GROUPS } from '../../utils/filterUtils'

interface ExtensionFilterProps {
  selectedExtensions: string[]
  availableExtensions: Map<string, number>
  isOpen: boolean
  onToggle: () => void
  onExtensionToggle: (extension: string) => void
  onGroupSelect: (groupName: string) => void
  onClear: () => void
}

export function ExtensionFilter({
  selectedExtensions,
  availableExtensions,
  isOpen,
  onToggle,
  onExtensionToggle,
  onGroupSelect,
  onClear
}: ExtensionFilterProps): JSX.Element {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (isOpen && 
          dropdownRef.current !== null && 
          buttonRef.current !== null &&
          !dropdownRef.current.contains(event.target as Node) &&
          !buttonRef.current.contains(event.target as Node)) {
        onToggle()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return (): void => { document.removeEventListener('mousedown', handleClickOutside) }
    }
    return undefined
  }, [isOpen, onToggle])

  const sortedExtensions = Array.from(availableExtensions.entries())
    .sort((a, b) => b[1] - a[1]) // Sort by count descending

  const handleGroupClick = useCallback((groupName: keyof typeof EXTENSION_GROUPS) => {
    onGroupSelect(groupName)
  }, [onGroupSelect])

  return (
    <div className="filter-dropdown">
      <button
        ref={buttonRef}
        className="filter-dropdown-button"
        onClick={onToggle}
        aria-label="Filter by file extension"
        aria-expanded={isOpen}
        aria-controls="extension-dropdown-menu"
      >
        Extensions
        {selectedExtensions.length > 0 && (
          <span className="filter-badge-count">({selectedExtensions.length})</span>
        )}
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          id="extension-dropdown-menu"
          className="filter-dropdown-menu"
          role="menu"
          aria-label="Select file extensions to filter"
        >
          <div className="filter-dropdown-section">
            <div className="filter-dropdown-header">
              <span>Quick Filters</span>
              {selectedExtensions.length > 0 && (
                <button
                  className="filter-clear-link"
                  onClick={onClear}
                  type="button"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="filter-group-buttons">
              <button
                className="filter-group-button"
                onClick={() => handleGroupClick('images')}
                type="button"
              >
                📷 Images
              </button>
              <button
                className="filter-group-button"
                onClick={() => handleGroupClick('documents')}
                type="button"
              >
                📄 Documents
              </button>
              <button
                className="filter-group-button"
                onClick={() => handleGroupClick('videos')}
                type="button"
              >
                🎬 Videos
              </button>
              <button
                className="filter-group-button"
                onClick={() => handleGroupClick('code')}
                type="button"
              >
                💻 Code
              </button>
              <button
                className="filter-group-button"
                onClick={() => handleGroupClick('archives')}
                type="button"
              >
                📦 Archives
              </button>
            </div>
          </div>

          {sortedExtensions.length > 0 && (
            <div className="filter-dropdown-section">
              <div className="filter-dropdown-header">
                <span>Available Extensions</span>
              </div>
              <div className="filter-extension-list">
                {sortedExtensions.map(([ext, count]) => (
                  <label
                    key={ext}
                    className="filter-checkbox-label"
                    role="menuitemcheckbox"
                    aria-checked={selectedExtensions.includes(ext)}
                    htmlFor={`ext-filter-${ext}`}
                  >
                    <input
                      type="checkbox"
                      id={`ext-filter-${ext}`}
                      name={`ext-filter-${ext}`}
                      checked={selectedExtensions.includes(ext)}
                      onChange={() => onExtensionToggle(ext)}
                      className="filter-checkbox-input"
                    />
                    <span className="filter-extension-name">{ext}</span>
                    <span className="filter-extension-count">({count})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {sortedExtensions.length === 0 && (
            <div className="filter-empty-state">
              No files in current folder
            </div>
          )}
        </div>
      )}
    </div>
  )
}

