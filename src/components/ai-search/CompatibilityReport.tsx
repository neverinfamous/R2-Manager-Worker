import { useState, type JSX } from 'react'
import type { AISearchCompatibility } from '../../services/api'

interface CompatibilityReportProps {
  compatibility: AISearchCompatibility
  onOpenDashboard: () => void
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

export function CompatibilityReport({ compatibility, onOpenDashboard }: CompatibilityReportProps): JSX.Element {
  const [showIndexable, setShowIndexable] = useState(false)
  const [showNonIndexable, setShowNonIndexable] = useState(false)

  const indexablePercentage = compatibility.totalFiles > 0
    ? Math.round((compatibility.indexableFiles / compatibility.totalFiles) * 100)
    : 0

  return (
    <div className="compatibility-report">
      <div className="compatibility-summary">
        <div className="compatibility-chart">
          <svg viewBox="0 0 36 36" className="compatibility-donut">
            <path
              className="compatibility-donut-bg"
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              strokeWidth="3"
            />
            <path
              className="compatibility-donut-fill"
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              strokeWidth="3"
              strokeDasharray={`${indexablePercentage}, 100`}
            />
            <text x="18" y="20.35" className="compatibility-donut-text">
              {indexablePercentage}%
            </text>
          </svg>
        </div>
        <div className="compatibility-stats">
          <h3>Indexable Files</h3>
          <div className="compatibility-stat-row">
            <span className="stat-label">Total Files:</span>
            <span className="stat-value">{compatibility.totalFiles}</span>
          </div>
          <div className="compatibility-stat-row indexable">
            <span className="stat-label">Indexable:</span>
            <span className="stat-value">{compatibility.indexableFiles}</span>
          </div>
          <div className="compatibility-stat-row non-indexable">
            <span className="stat-label">Non-indexable:</span>
            <span className="stat-value">{compatibility.nonIndexableFiles}</span>
          </div>
          <div className="compatibility-stat-row">
            <span className="stat-label">Indexable Size:</span>
            <span className="stat-value">{formatFileSize(compatibility.indexableSize)}</span>
          </div>
        </div>
      </div>

      <div className="compatibility-info-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <div>
          <p>
            AI Search can index <strong>{compatibility.indexableFiles}</strong> of your{' '}
            <strong>{compatibility.totalFiles}</strong> files ({indexablePercentage}%).
          </p>
          <p className="compatibility-hint">
            Supported file types include: markdown, text, JSON, YAML, HTML, and code files up to 4MB.
          </p>
        </div>
      </div>

      <div className="compatibility-actions">
        <button className="compatibility-create-btn" onClick={onOpenDashboard}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create AI Search Instance
        </button>
      </div>

      {compatibility.files.indexable.length > 0 && (
        <div className="compatibility-file-section">
          <button
            className="compatibility-section-toggle"
            onClick={() => setShowIndexable(!showIndexable)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={showIndexable ? 'rotated' : ''}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className="indexable-label">Indexable Files ({compatibility.files.indexable.length})</span>
          </button>
          {showIndexable && (
            <div className="compatibility-file-list">
              {compatibility.files.indexable.map((file) => (
                <div key={file.key} className="compatibility-file-item indexable">
                  <span className="file-name">{file.key}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                  <span className="file-ext">{file.extension}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {compatibility.files.nonIndexable.length > 0 && (
        <div className="compatibility-file-section">
          <button
            className="compatibility-section-toggle"
            onClick={() => setShowNonIndexable(!showNonIndexable)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={showNonIndexable ? 'rotated' : ''}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className="non-indexable-label">Non-indexable Files ({compatibility.files.nonIndexable.length})</span>
          </button>
          {showNonIndexable && (
            <div className="compatibility-file-list">
              {compatibility.files.nonIndexable.map((file) => (
                <div key={file.key} className="compatibility-file-item non-indexable">
                  <span className="file-name">{file.key}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                  <span className="file-reason">{file.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="compatibility-supported-types">
        <h4>Supported File Extensions</h4>
        <div className="supported-extensions">
          {compatibility.supportedExtensions.map((ext) => (
            <span key={ext} className="extension-badge">{ext}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

