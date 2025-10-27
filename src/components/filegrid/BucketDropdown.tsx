import { RefObject } from 'react'

interface BucketDropdownProps {
  isOpen: boolean
  position: { top: number; left: number } | null
  currentBucket: string
  availableBuckets: string[]
  buttonRef: RefObject<HTMLButtonElement | null>
  onToggle: () => void
  onSelect: (bucket: string) => void
}

export const BucketDropdown = ({
  isOpen,
  position,
  currentBucket,
  availableBuckets,
  buttonRef,
  onToggle,
  onSelect
}: BucketDropdownProps) => {
  return (
    <div className={`bucket-nav-dropdown-container ${isOpen ? 'open' : ''}`}>
      <button 
        ref={buttonRef}
        className="action-button bucket-nav-button"
        onClick={onToggle}
        title="Navigate to another bucket"
      >
        <span>Jump to Bucket</span>
        <span className="dropdown-arrow">▼</span>
      </button>
      {isOpen && position && (
        <div 
          className="bucket-nav-dropdown-menu"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`
          }}
        >
          {availableBuckets.map(bucket => (
            <button 
              key={bucket}
              onClick={() => onSelect(bucket)}
              className={bucket === currentBucket ? 'current-bucket' : ''}
              disabled={bucket === currentBucket}
            >
              {bucket}
              {bucket === currentBucket && <span className="current-indicator"> (current)</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

