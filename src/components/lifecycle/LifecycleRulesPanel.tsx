import { useState, useEffect, useCallback, type JSX } from 'react'
import { api } from '../../services/api'
import type { LifecycleRule, LifecycleRulesResponse } from '../../types/lifecycle'
import { secondsToDays } from '../../types/lifecycle'
import { CreateLifecycleRuleModal } from './CreateLifecycleRuleModal'
import './lifecycle.css'

interface LifecycleRulesPanelProps {
    bucketName: string
    onClose: () => void
}

export function LifecycleRulesPanel({ bucketName, onClose }: LifecycleRulesPanelProps): JSX.Element {
    const [rules, setRules] = useState<LifecycleRule[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null)

    const loadRules = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const response: LifecycleRulesResponse = await api.getLifecycleRules(bucketName)
            setRules(response.result?.rules ?? [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load lifecycle rules')
        } finally {
            setIsLoading(false)
        }
    }, [bucketName])

    useEffect(() => {
        void loadRules()
    }, [loadRules])

    const handleDeleteRule = useCallback(async (ruleId: string) => {
        if (!confirm(`Delete lifecycle rule "${ruleId}"?`)) return

        setDeletingRuleId(ruleId)
        try {
            await api.deleteLifecycleRule(bucketName, ruleId)
            await loadRules()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete rule')
        } finally {
            setDeletingRuleId(null)
        }
    }, [bucketName, loadRules])

    const handleRuleCreated = useCallback(() => {
        setShowCreateModal(false)
        void loadRules()
    }, [loadRules])

    const handleToggleRule = useCallback(async (rule: LifecycleRule) => {
        try {
            const updatedRules = rules.map(r =>
                r.id === rule.id ? { ...r, enabled: !r.enabled } : r
            )
            await api.setLifecycleRules(bucketName, updatedRules)
            setRules(updatedRules)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update rule')
        }
    }, [bucketName, rules])

    const getRuleDescription = (rule: LifecycleRule): string => {
        const parts: string[] = []

        if (rule.conditions?.prefix) {
            parts.push(`prefix "${rule.conditions.prefix}"`)
        }
        if (rule.conditions?.suffix) {
            parts.push(`suffix "${rule.conditions.suffix}"`)
        }

        const actions = rule.actions ?? []
        for (const action of actions) {
            if (action.type === 'Delete') {
                const days = rule.conditions?.maxAgeSeconds
                    ? secondsToDays(rule.conditions.maxAgeSeconds)
                    : 0
                parts.push(`delete after ${days} days`)
            } else if (action.type === 'SetStorageClass') {
                const days = rule.conditions?.maxAgeSeconds
                    ? secondsToDays(rule.conditions.maxAgeSeconds)
                    : 0
                parts.push(`transition to ${action.storageClass ?? 'IA'} after ${days} days`)
            }
        }

        return parts.join(', ') || 'No conditions'
    }

    return (
        <div className="lifecycle-panel">
            <div className="lifecycle-header">
                <div className="lifecycle-title">
                    <svg className="lifecycle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <h2>Lifecycle Rules</h2>
                    <span className="lifecycle-bucket-badge">{bucketName}</span>
                </div>
                <button className="lifecycle-close" onClick={onClose} aria-label="Close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="lifecycle-info">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                </svg>
                <span>
                    Automate object expiration and transitions to Infrequent Access storage (33% cost savings).
                </span>
            </div>

            {error !== null && (
                <div className="lifecycle-error">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4M12 16h.01" />
                    </svg>
                    <span>{error}</span>
                    <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
                </div>
            )}

            <div className="lifecycle-actions">
                <button className="lifecycle-add-btn" onClick={() => setShowCreateModal(true)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add Rule
                </button>
                <button className="lifecycle-refresh-btn" onClick={() => void loadRules()} disabled={isLoading}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                    </svg>
                    Refresh
                </button>
            </div>

            <div className="lifecycle-content">
                {isLoading ? (
                    <div className="lifecycle-loading">
                        <div className="lifecycle-spinner" />
                        <span>Loading lifecycle rules...</span>
                    </div>
                ) : rules.length === 0 ? (
                    <div className="lifecycle-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <p>No lifecycle rules configured</p>
                        <span>Add a rule to automate object expiration or transition to Infrequent Access storage.</span>
                    </div>
                ) : (
                    <div className="lifecycle-rules-list">
                        {rules.map(rule => (
                            <div key={rule.id} className={`lifecycle-rule ${rule.enabled ? '' : 'disabled'}`}>
                                <div className="lifecycle-rule-header">
                                    <div className="lifecycle-rule-id">{rule.id}</div>
                                    <div className="lifecycle-rule-actions">
                                        <button
                                            className={`lifecycle-toggle ${rule.enabled ? 'enabled' : ''}`}
                                            onClick={() => void handleToggleRule(rule)}
                                            aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
                                        >
                                            {rule.enabled ? 'Enabled' : 'Disabled'}
                                        </button>
                                        <button
                                            className="lifecycle-delete"
                                            onClick={() => void handleDeleteRule(rule.id)}
                                            disabled={deletingRuleId === rule.id}
                                            aria-label="Delete rule"
                                        >
                                            {deletingRuleId === rule.id ? 'Deleting...' : 'Delete'}
                                        </button>
                                    </div>
                                </div>
                                <div className="lifecycle-rule-description">
                                    {getRuleDescription(rule)}
                                </div>
                                {rule.actions?.map((action, i) => (
                                    <div key={i} className={`lifecycle-rule-badge ${action.type === 'Delete' ? 'expire' : 'transition'}`}>
                                        {action.type === 'Delete' ? '⏳ Expiration' : '📦 Transition to IA'}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showCreateModal && (
                <CreateLifecycleRuleModal
                    bucketName={bucketName}
                    existingRuleIds={rules.map(r => r.id)}
                    onClose={() => setShowCreateModal(false)}
                    onCreated={handleRuleCreated}
                />
            )}
        </div>
    )
}
