import { useState, useEffect, useCallback, type JSX } from 'react'
import {
  api,
  type JobListItem,
  type JobOperationType
} from '../../services/api'
import { logger } from '../../services/logger'
import { JobHistoryDialog } from './JobHistoryDialog'
import '../../styles/job-history.css'

// Icons
const RefreshIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
)

const SearchIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

const ArrowUpIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m18 15-6-6-6 6" />
  </svg>
)

const ArrowDownIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
)

const XIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
)

const FileTextIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" x2="8" y1="13" y2="13" />
    <line x1="16" x2="8" y1="17" y2="17" />
    <line x1="10" x2="8" y1="9" y2="9" />
  </svg>
)

const LoaderIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)

const CheckCircleIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)

const XCircleIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </svg>
)

const AlertCircleIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
)

const BucketIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
)

const FolderPlusIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    <line x1="12" x2="12" y1="10" y2="16" />
    <line x1="9" x2="15" y1="13" y2="13" />
  </svg>
)

const DatabaseIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
  </svg>
)

const EditIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

// Operation Icons
const UploadIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </svg>
)

const DownloadIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
)

const TrashIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

const MoveIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
)

const CopyIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
)

const AIIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
)

interface JobHistoryProps {
  buckets: { name: string }[]
}

export function JobHistory({ buckets }: JobHistoryProps): JSX.Element {
  const [jobs, setJobs] = useState<JobListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [operationFilter, setOperationFilter] = useState<string>('all')
  const [bucketFilter, setBucketFilter] = useState<string>('all')
  const [datePreset, setDatePreset] = useState<string>('all')
  const [jobIdSearch, setJobIdSearch] = useState<string>('')
  const [jobIdInput, setJobIdInput] = useState<string>('')
  const [minErrors, setMinErrors] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('started_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const limit = 20

  // Debounce job ID search
  useEffect(() => {
    const timer = setTimeout(() => {
      setJobIdSearch(jobIdInput)
    }, 500)
    return () => clearTimeout(timer)
  }, [jobIdInput])

  const loadJobs = useCallback(async (reset?: boolean) => {
    try {
      setLoading(true)
      setError('')

      const currentOffset = reset ? 0 : offset

      const options: {
        limit: number
        offset: number
        status?: string
        operation_type?: string
        bucket_name?: string
        start_date?: string
        end_date?: string
        job_id?: string
        min_errors?: number
        sort_by?: string
        sort_order?: 'asc' | 'desc'
      } = {
        limit,
        offset: currentOffset,
      }

      if (statusFilter !== 'all') {
        options.status = statusFilter
      }

      if (operationFilter !== 'all') {
        options.operation_type = operationFilter
      }

      if (bucketFilter !== 'all') {
        options.bucket_name = bucketFilter
      }

      // Handle date range based on preset
      if (datePreset !== 'all') {
        const now = new Date()
        let startDate: Date

        switch (datePreset) {
          case '24h':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
            break
          case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            break
          default:
            startDate = now
        }

        options.start_date = startDate.toISOString()
      }

      if (jobIdSearch.trim()) {
        options.job_id = jobIdSearch.trim()
      }

      if (minErrors.trim() && !isNaN(parseInt(minErrors))) {
        options.min_errors = parseInt(minErrors)
      }

      options.sort_by = sortBy
      options.sort_order = sortOrder

      const data = await api.getJobList(options)

      if (reset) {
        setJobs(data.jobs)
        setOffset(limit)
      } else {
        setJobs(prevJobs => [...prevJobs, ...data.jobs])
        setOffset(currentOffset + limit)
      }

      setTotal(data.total)
    } catch (err) {
      logger.error('JobHistory', 'Failed to load job history', err)
      setError(err instanceof Error ? err.message : 'Failed to load job history')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, operationFilter, bucketFilter, datePreset, jobIdSearch, minErrors, sortBy, sortOrder, offset])

  useEffect(() => {
    void loadJobs(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, operationFilter, bucketFilter, datePreset, jobIdSearch, minErrors, sortBy, sortOrder])

  const handleLoadMore = (): void => {
    void loadJobs(false)
  }

  const handleResetFilters = (): void => {
    setStatusFilter('all')
    setOperationFilter('all')
    setBucketFilter('all')
    setDatePreset('all')
    setJobIdInput('')
    setJobIdSearch('')
    setMinErrors('')
    setSortBy('started_at')
    setSortOrder('desc')
  }

  const toggleSortOrder = (): void => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
  }

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  const getStatusBadge = (status: string): JSX.Element => {
    switch (status) {
      case 'completed':
        return (
          <span className="job-status-badge completed">
            <CheckCircleIcon />
            Completed
          </span>
        )
      case 'failed':
        return (
          <span className="job-status-badge failed">
            <XCircleIcon />
            Failed
          </span>
        )
      case 'running':
        return (
          <span className="job-status-badge running">
            <LoaderIcon />
            Running
          </span>
        )
      case 'queued':
        return (
          <span className="job-status-badge queued">
            <AlertCircleIcon />
            Queued
          </span>
        )
      case 'cancelled':
        return (
          <span className="job-status-badge cancelled">
            <XIcon />
            Cancelled
          </span>
        )
      default:
        return <span className="job-status-badge">{status}</span>
    }
  }

  const getOperationIcon = (operationType: JobOperationType): JSX.Element => {
    switch (operationType) {
      case 'bulk_upload':
      case 'file_upload':
        return <UploadIcon />
      case 'bulk_download':
      case 'file_download':
        return <DownloadIcon />
      case 'bulk_delete':
      case 'bucket_delete':
      case 'file_delete':
      case 'folder_delete':
        return <TrashIcon />
      case 'file_move':
      case 'folder_move':
        return <MoveIcon />
      case 'file_copy':
      case 'folder_copy':
        return <CopyIcon />
      case 'ai_search_sync':
        return <AIIcon />
      case 'bucket_create':
        return <DatabaseIcon />
      case 'folder_create':
        return <FolderPlusIcon />
      case 'file_rename':
      case 'folder_rename':
      case 'bucket_rename':
        return <EditIcon />
      default:
        return <FileTextIcon />
    }
  }

  const getOperationLabel = (operationType: JobOperationType): string => {
    switch (operationType) {
      case 'bulk_upload':
        return 'Bulk Upload'
      case 'bulk_download':
        return 'Bulk Download'
      case 'bulk_delete':
        return 'Bulk Delete'
      case 'file_upload':
        return 'File Upload'
      case 'file_download':
        return 'File Download'
      case 'file_delete':
        return 'File Delete'
      case 'file_rename':
        return 'File Rename'
      case 'file_move':
        return 'File Move'
      case 'file_copy':
        return 'File Copy'
      case 'folder_create':
        return 'Folder Create'
      case 'folder_delete':
        return 'Folder Delete'
      case 'folder_rename':
        return 'Folder Rename'
      case 'folder_move':
        return 'Folder Move'
      case 'folder_copy':
        return 'Folder Copy'
      case 'bucket_create':
        return 'Bucket Create'
      case 'bucket_delete':
        return 'Bucket Delete'
      case 'bucket_rename':
        return 'Bucket Rename'
      case 'ai_search_sync':
        return 'AI Search Sync'
      default:
        return operationType
    }
  }

  const hasMore = offset < total

  return (
    <div className="job-history-container">
      {/* Header */}
      <div className="job-history-header">
        <div className="job-history-header-content">
          <h2>Job History</h2>
          <p>View history and event timeline for all bulk operations</p>
        </div>
        <button
          className={`job-history-refresh-btn ${loading ? 'spinning' : ''}`}
          onClick={() => void loadJobs(true)}
          disabled={loading}
        >
          <RefreshIcon />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="job-history-filters">
        <div className="job-filters-grid">
          {/* Status Filter */}
          <div className="job-filter-group">
            <label htmlFor="status-filter">Status</label>
            <select
              id="status-filter"
              className="job-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="queued">Queued</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Operation Type Filter */}
          <div className="job-filter-group">
            <label htmlFor="operation-filter">Operation Type</label>
            <select
              id="operation-filter"
              className="job-filter-select"
              value={operationFilter}
              onChange={(e) => setOperationFilter(e.target.value)}
            >
              <option value="all">All Operations</option>
              <optgroup label="Bulk Operations">
                <option value="bulk_upload">Bulk Upload</option>
                <option value="bulk_download">Bulk Download</option>
                <option value="bulk_delete">Bulk Delete</option>
              </optgroup>
              <optgroup label="File Operations">
                <option value="file_upload">File Upload</option>
                <option value="file_download">File Download</option>
                <option value="file_delete">File Delete</option>
                <option value="file_rename">File Rename</option>
                <option value="file_move">File Move</option>
                <option value="file_copy">File Copy</option>
              </optgroup>
              <optgroup label="Folder Operations">
                <option value="folder_create">Folder Create</option>
                <option value="folder_delete">Folder Delete</option>
                <option value="folder_rename">Folder Rename</option>
                <option value="folder_move">Folder Move</option>
                <option value="folder_copy">Folder Copy</option>
              </optgroup>
              <optgroup label="Bucket Operations">
                <option value="bucket_create">Bucket Create</option>
                <option value="bucket_delete">Bucket Delete</option>
                <option value="bucket_rename">Bucket Rename</option>
              </optgroup>
              <optgroup label="AI Search">
                <option value="ai_search_sync">AI Search Sync</option>
              </optgroup>
            </select>
          </div>

          {/* Bucket Filter */}
          <div className="job-filter-group">
            <label htmlFor="bucket-filter">Bucket</label>
            <select
              id="bucket-filter"
              className="job-filter-select"
              value={bucketFilter}
              onChange={(e) => setBucketFilter(e.target.value)}
            >
              <option value="all">All Buckets</option>
              {buckets.map((bucket) => (
                <option key={bucket.name} value={bucket.name}>
                  {bucket.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="job-filter-group">
            <label htmlFor="date-filter">Date Range</label>
            <select
              id="date-filter"
              className="job-filter-select"
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          {/* Job ID Search */}
          <div className="job-filter-group">
            <label htmlFor="job-id-search">Job ID</label>
            <div className="job-search-input-wrapper">
              <SearchIcon />
              <input
                id="job-id-search"
                type="text"
                className="job-filter-input"
                placeholder="Search by Job ID..."
                value={jobIdInput}
                onChange={(e) => setJobIdInput(e.target.value)}
              />
            </div>
          </div>

          {/* Min Errors Filter */}
          <div className="job-filter-group">
            <label htmlFor="min-errors">Min Errors</label>
            <input
              id="min-errors"
              type="number"
              min="0"
              className="job-filter-input"
              placeholder="Min errors..."
              value={minErrors}
              onChange={(e) => setMinErrors(e.target.value)}
            />
          </div>

          {/* Sort By */}
          <div className="job-filter-group">
            <label htmlFor="sort-by">Sort By</label>
            <select
              id="sort-by"
              className="job-filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="started_at">Started At</option>
              <option value="completed_at">Completed At</option>
              <option value="total_items">Total Items</option>
              <option value="error_count">Error Count</option>
              <option value="percentage">Progress</option>
            </select>
          </div>
        </div>

        {/* Filter Actions */}
        <div className="job-filter-actions">
          <button
            className="job-sort-order-btn"
            onClick={toggleSortOrder}
          >
            {sortOrder === 'desc' ? <ArrowDownIcon /> : <ArrowUpIcon />}
            {sortOrder === 'desc' ? 'Descending' : 'Ascending'}
          </button>
          <button
            className="job-clear-filters-btn"
            onClick={handleResetFilters}
          >
            <XIcon />
            Clear All Filters
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="job-history-error">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && jobs.length === 0 && (
        <div className="job-history-loading">
          <LoaderIcon />
          Loading job history...
        </div>
      )}

      {/* Empty State */}
      {!loading && jobs.length === 0 && (
        <div className="job-history-empty">
          <FileTextIcon />
          <h3>No jobs found</h3>
          <p>No bulk operations match the selected filters</p>
        </div>
      )}

      {/* Job List */}
      {jobs.length > 0 && (
        <div className="job-history-list">
          {jobs.map((job) => (
            <div
              key={job.job_id}
              className="job-card"
              onClick={() => setSelectedJobId(job.job_id)}
            >
              <div className="job-card-header">
                <div className="job-card-title-area">
                  <div className="job-operation-icon">
                    {getOperationIcon(job.operation_type)}
                  </div>
                  <div className="job-card-info">
                    <h4>{getOperationLabel(job.operation_type)}</h4>
                    <div className="job-card-bucket">
                      <BucketIcon />
                      {job.bucket_name}
                    </div>
                  </div>
                </div>
                {getStatusBadge(job.status)}
              </div>

              <div className="job-card-stats">
                <div className="job-stat">
                  <span className="job-stat-label">Started</span>
                  <span className="job-stat-value" title={new Date(job.started_at).toLocaleString()}>
                    {formatTimestamp(job.started_at)}
                  </span>
                </div>
                {job.total_items !== null && (
                  <div className="job-stat">
                    <span className="job-stat-label">Total Items</span>
                    <span className="job-stat-value">{job.total_items.toLocaleString()}</span>
                  </div>
                )}
                {job.processed_items !== null && (
                  <div className="job-stat">
                    <span className="job-stat-label">Processed</span>
                    <span className="job-stat-value">{job.processed_items.toLocaleString()}</span>
                  </div>
                )}
                {job.error_count !== null && job.error_count > 0 && (
                  <div className="job-stat">
                    <span className="job-stat-label">Errors</span>
                    <span className="job-stat-value error">{job.error_count.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="job-card-id">
                Job ID: {job.job_id}
              </div>
            </div>
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="job-history-load-more">
              <button
                className="job-load-more-btn"
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading ? 'Loading...' : `Load More (${jobs.length} of ${total})`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Job History Dialog */}
      {selectedJobId && (
        <JobHistoryDialog
          open={!!selectedJobId}
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
        />
      )}
    </div>
  )
}

