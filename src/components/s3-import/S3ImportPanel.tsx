import { useState, useCallback, type JSX } from 'react'
import { api } from '../../services/api'
import type { S3ImportJob, S3ImportJobsListResponse } from '../../services/api'
import { S3CredentialsForm } from './S3CredentialsForm'
import { MigrationJobsList } from './MigrationJobsList'
import './s3-import.css'

interface S3ImportPanelProps {
    buckets: string[]
    onClose: () => void
    onJobCreated?: () => void
}

type TabType = 'new' | 'active' | 'history'

export function S3ImportPanel({ buckets, onClose, onJobCreated }: S3ImportPanelProps): JSX.Element {
    const [activeTab, setActiveTab] = useState<TabType>('new')
    const [jobs, setJobs] = useState<S3ImportJob[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadJobs = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const data: S3ImportJobsListResponse = await api.listS3ImportJobs()
            setJobs(data.jobs)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load migration jobs')
        } finally {
            setIsLoading(false)
        }
    }, [])

    const handleTabChange = useCallback((tab: TabType) => {
        setActiveTab(tab)
        setError(null)
        if (tab !== 'new') {
            void loadJobs()
        }
    }, [loadJobs])

    const handleJobCreated = useCallback(() => {
        setActiveTab('active')
        void loadJobs()
        onJobCreated?.()
    }, [loadJobs, onJobCreated])

    const handleAbortJob = useCallback(async (jobId: string) => {
        try {
            const result = await api.abortS3ImportJob(jobId)
            if (result.success) {
                void loadJobs()
            } else {
                setError('Failed to abort job')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to abort job')
        }
    }, [loadJobs])

    const handleOpenDashboard = useCallback(() => {
        window.open(api.getS3ImportDashboardUrl(), '_blank')
    }, [])

    // Filter jobs by status for tabs
    const activeJobs = jobs.filter(j => j.status === 'pending' || j.status === 'running')
    const historyJobs = jobs.filter(j => j.status === 'complete' || j.status === 'error' || j.status === 'aborted')

    return (
        <div className="s3-import-panel">
            <div className="s3-import-header">
                <div className="s3-import-title">
                    <svg className="s3-import-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <h2>Import from S3</h2>
                </div>
                <button className="s3-import-close" onClick={onClose} aria-label="Close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="s3-import-tabs">
                <button
                    className={`s3-import-tab ${activeTab === 'new' ? 'active' : ''}`}
                    onClick={() => handleTabChange('new')}
                >
                    New Migration
                </button>
                <button
                    className={`s3-import-tab ${activeTab === 'active' ? 'active' : ''}`}
                    onClick={() => handleTabChange('active')}
                >
                    Active Jobs {activeJobs.length > 0 && <span className="s3-import-badge">{activeJobs.length}</span>}
                </button>
                <button
                    className={`s3-import-tab ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => handleTabChange('history')}
                >
                    History
                </button>
            </div>

            <div className="s3-import-content">
                {error && (
                    <div className="s3-import-error">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 8v4M12 16h.01" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                {isLoading && (
                    <div className="s3-import-loading">
                        <div className="s3-import-spinner" />
                        <span>Loading...</span>
                    </div>
                )}

                {activeTab === 'new' && (
                    <S3CredentialsForm
                        buckets={buckets}
                        onJobCreated={handleJobCreated}
                        onError={setError}
                        onOpenDashboard={handleOpenDashboard}
                    />
                )}

                {activeTab === 'active' && !isLoading && (
                    <MigrationJobsList
                        jobs={activeJobs}
                        showAbort={true}
                        onAbortJob={handleAbortJob}
                        onRefresh={loadJobs}
                        emptyMessage="No active migrations. Start a new migration to import data from S3."
                    />
                )}

                {activeTab === 'history' && !isLoading && (
                    <MigrationJobsList
                        jobs={historyJobs}
                        showAbort={false}
                        onRefresh={loadJobs}
                        emptyMessage="No migration history yet."
                    />
                )}
            </div>
        </div>
    )
}
