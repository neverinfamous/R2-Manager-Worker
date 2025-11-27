import { type RefObject, type JSX } from 'react'

type SortField = 'name' | 'size' | 'type' | 'uploaded'
type SortDirection = 'asc' | 'desc'

interface SortDropdownProps {
  isOpen: boolean
  position: { top: number; left: number } | null
  currentField: SortField
  currentDirection: SortDirection
  buttonRef: RefObject<HTMLButtonElement | null>
  onToggle: () => void
  onSortChange: (field: SortField) => void
  getSortLabel: () => string
}

export const SortDropdown = ({
  isOpen,
  position,
  currentField,
  currentDirection,
  buttonRef,
  onToggle,
  onSortChange,
  getSortLabel
}: SortDropdownProps): JSX.Element => {
  return (
    <div className={`sort-dropdown-container ${isOpen ? 'open' : ''}`}>
      <button 
        ref={buttonRef}
        className="action-button sort-button-combined"
        onClick={onToggle}
      >
        <span>{getSortLabel()}</span>
        <span className="sort-direction-indicator">{currentDirection === 'asc' ? '▲' : '▼'}</span>
      </button>
      {isOpen && position && (
        <div 
          className="sort-dropdown-menu"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`
          }}
        >
          <button onClick={() => onSortChange('name')}>
            Name {currentField === 'name' && (currentDirection === 'asc' ? '▲' : '▼')}
          </button>
          <button onClick={() => onSortChange('size')}>
            Size {currentField === 'size' && (currentDirection === 'asc' ? '▲' : '▼')}
          </button>
          <button onClick={() => onSortChange('type')}>
            Type {currentField === 'type' && (currentDirection === 'asc' ? '▲' : '▼')}
          </button>
          <button onClick={() => onSortChange('uploaded')}>
            Uploaded {currentField === 'uploaded' && (currentDirection === 'asc' ? '▲' : '▼')}
          </button>
        </div>
      )}
    </div>
  )
}

