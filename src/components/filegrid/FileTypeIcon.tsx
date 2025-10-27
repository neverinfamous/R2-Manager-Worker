import type { JSX } from 'react'
import { getFileExtension } from '../../utils/fileUtils'

export const getFolderIcon = (): JSX.Element => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7l-2-2H5a2 2 0 0 0-2 2z" />
    </svg>
  )
}

export const getFileTypeIcon = (filename: string): JSX.Element => {
  const ext = getFileExtension(filename)
  
  // Excel files - spreadsheet with grid pattern
  if (ext === 'xls' || ext === 'xlsx') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <line x1="4" y1="8" x2="20" y2="8" />
        <line x1="4" y1="13" x2="20" y2="13" />
        <line x1="4" y1="18" x2="20" y2="18" />
        <line x1="10" y1="8" x2="10" y2="21" />
        <line x1="15" y1="8" x2="15" y2="21" />
      </svg>
    )
  }
  
  // PowerPoint files - presentation slide icon
  if (ext === 'ppt' || ext === 'pptx') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="12" rx="1" />
        <rect x="6" y="16" width="12" height="1" fill="currentColor" />
        <line x1="12" y1="17" x2="12" y2="20" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <rect x="7" y="7" width="4" height="3" rx="0.5" fill="currentColor" opacity="0.5" />
        <line x1="12" y1="8" x2="16" y2="8" opacity="0.5" />
        <line x1="12" y1="10" x2="15" y2="10" opacity="0.5" />
      </svg>
    )
  }
  
  // Word files - document with text lines
  if (ext === 'doc' || ext === 'docx') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" opacity="0.6" />
        <line x1="8" y1="16" x2="14" y2="16" opacity="0.6" />
        <line x1="8" y1="10" x2="16" y2="10" opacity="0.6" />
      </svg>
    )
  }
  
  // PDF files - updated design with circle badge
  if (ext === 'pdf') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <circle cx="12" cy="14" r="4" opacity="0.7" />
        <text x="9" y="16.5" fontSize="3.5" fontFamily="Arial, sans-serif" fill="currentColor" stroke="none">PDF</text>
      </svg>
    )
  }
  
  // CSV files - simple table/grid icon
  if (ext === 'csv') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="6" width="16" height="12" rx="1" />
        <line x1="4" y1="10" x2="20" y2="10" />
        <line x1="4" y1="14" x2="20" y2="14" />
        <line x1="12" y1="6" x2="12" y2="18" />
      </svg>
    )
  }
  
  // Database files - cylindrical database icon
  if (ext === 'db' || ext === 'sqlite' || ext === 'sqlite3') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M20 12c0 1.7-3.6 3-8 3s-8-1.3-8-3" />
      </svg>
    )
  }
  
  // JSON/XML files - code brackets icon
  if (ext === 'json' || ext === 'xml') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 3C6.5 3 6 4 6 5.5V8.5C6 10 5 10.5 3.5 10.5M3.5 13.5C5 13.5 6 14 6 15.5V18.5C6 20 6.5 21 8 21" />
        <path d="M16 3C17.5 3 18 4 18 5.5V8.5C18 10 19 10.5 20.5 10.5M20.5 13.5C19 13.5 18 14 18 15.5V18.5C18 20 17.5 21 16 21" />
      </svg>
    )
  }
  
  // Jupyter notebook files - notebook with code cells
  if (ext === 'ipynb') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="5" y="2" width="14" height="20" rx="1" />
        <line x1="5" y1="6" x2="19" y2="6" />
        <line x1="5" y1="10" x2="19" y2="10" />
        <line x1="5" y1="14" x2="19" y2="14" />
        <circle cx="8" cy="4" r="0.5" fill="currentColor" />
        <circle cx="10" cy="4" r="0.5" fill="currentColor" />
        <line x1="7" y1="8" x2="17" y2="8" strokeWidth="0.5" opacity="0.6" />
        <line x1="7" y1="12" x2="15" y2="12" strokeWidth="0.5" opacity="0.6" />
      </svg>
    )
  }
  
  // Parquet files - columnar data structure icon
  if (ext === 'parquet') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="3" height="16" rx="0.5" />
        <rect x="8.5" y="8" width="3" height="12" rx="0.5" />
        <rect x="13" y="6" width="3" height="14" rx="0.5" />
        <rect x="17.5" y="10" width="3" height="10" rx="0.5" />
      </svg>
    )
  }
  
  // Archive icons - compressed folder
  if (ext === 'zip' || ext === 'rar' || ext === '7z' || ext === 'tar' || ext === 'gz') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v8l6 4v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6l6-4V2z" />
        <line x1="12" y1="2" x2="12" y2="4" strokeWidth="2" />
        <line x1="12" y1="5" x2="12" y2="7" strokeWidth="2" />
        <line x1="12" y1="8" x2="12" y2="10" strokeWidth="2" />
      </svg>
    )
  }
  
  // Text file icon - document with lines
  if (ext === 'txt') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="12" x2="16" y2="12" opacity="0.5" />
        <line x1="8" y1="14" x2="16" y2="14" opacity="0.5" />
        <line x1="8" y1="16" x2="14" y2="16" opacity="0.5" />
        <line x1="8" y1="18" x2="15" y2="18" opacity="0.5" />
      </svg>
    )
  }
  
  // Code file icons - angle brackets with code symbol
  if (ext === 'js' || ext === 'ts' || ext === 'jsx' || ext === 'tsx' || 
      ext === 'py' || ext === 'java' || ext === 'cpp' || ext === 'c' || 
      ext === 'cs' || ext === 'go' || ext === 'rs' || ext === 'php' || 
      ext === 'rb' || ext === 'swift' || ext === 'kt' || ext === 'html' || 
      ext === 'css' || ext === 'yaml' || ext === 'yml' || ext === 'sql') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <polyline points="10 14 8 16 10 18" strokeWidth="1.8" />
        <polyline points="14 14 16 16 14 18" strokeWidth="1.8" />
        <line x1="12.5" y1="13" x2="11.5" y2="19" strokeWidth="1.2" opacity="0.7" />
      </svg>
    )
  }
  
  // Markdown icon - M with down arrow
  if (ext === 'md' || ext === 'markdown') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <text x="6" y="16" fontSize="12" fontFamily="monospace, sans-serif" fill="currentColor" stroke="none" fontWeight="bold">M↓</text>
      </svg>
    )
  }
  
  // Configuration files - gear/settings icon
  if (ext === 'conf' || ext === 'ini' || ext === 'toml' || ext === 'jsonc' || 
      ext === 'env' || ext === 'lock') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24M19.78 19.78l-4.24-4.24m-5.08-5.08l-4.24-4.24" />
      </svg>
    )
  }

  // Dev environment files - terminal/console icon
  if (ext === 'gitignore' || ext === 'gitattributes' || ext === 'editorconfig' || 
      ext === 'dockerfile' || ext === 'nvmrc' || ext === 'node-version' || 
      ext === 'browserslistrc') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z" />
        <path d="M7 8h10M7 12h10M7 16h6" strokeLinecap="round" />
      </svg>
    )
  }

  // Data format files - database/table icon
  if (ext === 'feather' || ext === 'avro' || ext === 'ndjson') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="6" width="16" height="12" rx="1" />
        <line x1="4" y1="10" x2="20" y2="10" />
        <line x1="4" y1="14" x2="20" y2="14" />
        <line x1="8" y1="6" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="18" />
      </svg>
    )
  }

  // Documentation/Info files - info icon
  if (ext === 'nfo') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <circle cx="12" cy="16" r="0.5" fill="currentColor" />
      </svg>
    )
  }

  // PSD (Photoshop) file icon - layers icon
  if (ext === 'psd') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <rect x="7" y="7" width="10" height="3" rx="0.5" opacity="0.3" />
        <rect x="7" y="11" width="10" height="3" rx="0.5" opacity="0.6" />
        <rect x="7" y="15" width="10" height="3" rx="0.5" />
      </svg>
    )
  }

  // Video file icons - for formats that don't play reliably in browsers
  if (ext === 'avi' || ext === 'wmv' || ext === 'mkv') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <polygon points="10 9 10 15 15 12" fill="currentColor" />
      </svg>
    )
  }

  // Image file icon - for image files that can't be previewed
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || 
      ext === 'webp' || ext === 'avif' || ext === 'heic' || ext === 'svg' || ext === 'bmp') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    )
  }

  // Generic document icon (no custom icon)
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="file-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  )
}

