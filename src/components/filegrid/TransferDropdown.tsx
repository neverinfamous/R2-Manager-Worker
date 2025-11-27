import { type RefObject, type JSX } from 'react'

interface TransferDropdownProps {
  isOpen: boolean
  position: { top: number; left: number } | null
  buttonRef: RefObject<HTMLButtonElement | null>
  onToggle: () => void
  onCopy: () => void
  onMove: () => void
}

export const TransferDropdown = ({
  isOpen,
  position,
  buttonRef,
  onToggle,
  onCopy,
  onMove
}: TransferDropdownProps): JSX.Element => {
  return (
    <div className={`transfer-dropdown-container ${isOpen ? 'open' : ''}`}>
      <button 
        ref={buttonRef}
        className="action-button transfer-button"
        onClick={onToggle}
      >
        Transfer
        <span className="dropdown-arrow">▼</span>
      </button>
      {isOpen && position && (
        <div 
          className="transfer-dropdown-menu"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`
          }}
        >
         <button onClick={onCopy}>
            Copy to...
          </button>
          <button onClick={onMove}>
            Move to...
          </button>                    
        </div>
      )}
    </div>
  )
}

