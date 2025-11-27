import { useState, useCallback, type JSX } from 'react'
import { api } from '../../services/api'
import type { AISearchCompatibility, AISearchInstance, AISearchInstancesResponse } from '../../services/api'
import { CompatibilityReport } from './CompatibilityReport'
import { AISearchQuery } from './AISearchQuery'
import './ai-search.css'

interface AISearchPanelProps {
  bucketName: string
  onClose: () => void
}

type TabType = 'compatibility' | 'instances' | 'query'

export function AISearchPanel({ bucketName, onClose }: AISearchPanelProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>('compatibility')
  const [compatibility, setCompatibility] = useState<AISearchCompatibility | null>(null)
  const [instances, setInstances] = useState<AISearchInstance[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null)
  const [syncingInstance, setSyncingInstance] = useState<string | null>(null)

  const loadCompatibility = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.getAISearchCompatibility(bucketName)
      setCompatibility(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load compatibility data')
    } finally {
      setIsLoading(false)
    }
  }, [bucketName])

  const loadInstances = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data: AISearchInstancesResponse = await api.getAISearchInstances()
      setInstances(data.instances)
      if (data.error) {
        setError(data.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI Search instances')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab)
    setError(null)
    if (tab === 'compatibility' && !compatibility) {
      void loadCompatibility()
    } else if (tab === 'instances') {
      void loadInstances()
    }
  }, [compatibility, loadCompatibility, loadInstances])

  const handleOpenDashboard = useCallback(() => {
    window.open(api.getAISearchDashboardUrl(), '_blank')
  }, [])

  const handleTriggerSync = useCallback(async (instanceName: string) => {
    setSyncingInstance(instanceName)
    try {
      const result = await api.triggerAISearchSync(instanceName)
      if (result.success) {
        setError(null)
        // Reload instances to get updated status
        void loadInstances()
      } else {
        setError(result.error ?? 'Failed to trigger sync')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger sync')
    } finally {
      setSyncingInstance(null)
    }
  }, [loadInstances])

  const handleSelectInstance = useCallback((instanceName: string) => {
    setSelectedInstance(instanceName)
    setActiveTab('query')
  }, [])

  // Load compatibility on mount
  useState(() => {
    void loadCompatibility()
  })

  return (
    <div className="ai-search-panel">
      <div className="ai-search-header">
        <div className="ai-search-title">
          <svg className="ai-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
            <path d="M11 8v6M8 11h6" />
          </svg>
          <h2>AI Search for {bucketName}</h2>
        </div>
        <button className="ai-search-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="ai-search-tabs">
        <button
          className={`ai-search-tab ${activeTab === 'compatibility' ? 'active' : ''}`}
          onClick={() => handleTabChange('compatibility')}
        >
          Compatibility
        </button>
        <button
          className={`ai-search-tab ${activeTab === 'instances' ? 'active' : ''}`}
          onClick={() => handleTabChange('instances')}
        >
          Instances
        </button>
        <button
          className={`ai-search-tab ${activeTab === 'query' ? 'active' : ''}`}
          onClick={() => handleTabChange('query')}
          disabled={!selectedInstance}
        >
          Query
        </button>
      </div>

      <div className="ai-search-content">
        {error && (
          <div className="ai-search-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {isLoading && (
          <div className="ai-search-loading">
            <div className="ai-search-spinner" />
            <span>Loading...</span>
          </div>
        )}

        {activeTab === 'compatibility' && !isLoading && compatibility && (
          <CompatibilityReport 
            compatibility={compatibility} 
            onOpenDashboard={handleOpenDashboard}
          />
        )}

        {activeTab === 'instances' && !isLoading && (
          <div className="ai-search-instances">
            <div className="ai-search-instances-header">
              <h3>AI Search Instances</h3>
              <button className="ai-search-dashboard-btn" onClick={handleOpenDashboard}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Open Dashboard
              </button>
            </div>

            {instances.length === 0 ? (
              <div className="ai-search-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <p>No AI Search instances found.</p>
                <p className="ai-search-empty-hint">
                  Create an instance in the Cloudflare Dashboard to start using AI Search.
                </p>
                <button className="ai-search-create-btn" onClick={handleOpenDashboard}>
                  Create AI Search Instance
                </button>
              </div>
            ) : (
              <div className="ai-search-instances-list">
                {instances.map((instance) => (
                  <div key={instance.name} className="ai-search-instance-card">
                    <div className="ai-search-instance-info">
                      <h4>{instance.name}</h4>
                      {instance.description && (
                        <p className="ai-search-instance-desc">{instance.description}</p>
                      )}
                      <div className="ai-search-instance-meta">
                        {instance.status && (
                          <span className={`ai-search-status ai-search-status-${instance.status}`}>
                            {instance.status}
                          </span>
                        )}
                        {instance.data_source?.bucket_name && (
                          <span className="ai-search-bucket">
                            Bucket: {instance.data_source.bucket_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ai-search-instance-actions">
                      <button
                        className="ai-search-sync-btn"
                        onClick={() => handleTriggerSync(instance.name)}
                        disabled={syncingInstance === instance.name}
                      >
                        {syncingInstance === instance.name ? 'Syncing...' : 'Sync'}
                      </button>
                      <button
                        className="ai-search-query-btn"
                        onClick={() => handleSelectInstance(instance.name)}
                      >
                        Query
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'query' && selectedInstance && (
          <AISearchQuery 
            instanceName={selectedInstance}
            onBack={() => setActiveTab('instances')}
          />
        )}
      </div>
    </div>
  )
}

