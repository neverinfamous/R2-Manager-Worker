import { useState, type JSX, type FormEvent } from 'react'
import { api } from '../../services/api'
import type { LifecycleRule, LifecycleRuleAction } from '../../types/lifecycle'
import { daysToSeconds } from '../../types/lifecycle'

interface CreateLifecycleRuleModalProps {
    bucketName: string
    existingRuleIds: string[]
    onClose: () => void
    onCreated: () => void
}

type RuleType = 'expiration' | 'transition'

export function CreateLifecycleRuleModal({
    bucketName,
    existingRuleIds,
    onClose,
    onCreated
}: CreateLifecycleRuleModalProps): JSX.Element {
    const [ruleId, setRuleId] = useState('')
    const [ruleType, setRuleType] = useState<RuleType>('expiration')
    const [days, setDays] = useState(30)
    const [prefix, setPrefix] = useState('')
    const [suffix, setSuffix] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const validateRuleId = (id: string): string | null => {
        if (id.length === 0) return 'Rule ID is required'
        if (id.length > 255) return 'Rule ID must be 255 characters or less'
        if (existingRuleIds.includes(id)) return 'A rule with this ID already exists'
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) return 'Rule ID can only contain letters, numbers, hyphens, and underscores'
        return null
    }

    const handleSubmit = async (e: FormEvent): Promise<void> => {
        e.preventDefault()

        const idError = validateRuleId(ruleId)
        if (idError !== null) {
            setError(idError)
            return
        }

        if (days < 1) {
            setError('Days must be at least 1')
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            // Get existing rules first
            const existing = await api.getLifecycleRules(bucketName)
            const existingRules = existing.result?.rules ?? []

            // Build the action based on rule type
            const actions: LifecycleRuleAction[] = ruleType === 'expiration'
                ? [{ type: 'Delete' }]
                : [{ type: 'SetStorageClass', storageClass: 'InfrequentAccess' }]

            // Create the new rule
            const newRule: LifecycleRule = {
                id: ruleId,
                enabled: true,
                conditions: {
                    maxAgeSeconds: daysToSeconds(days),
                    ...(prefix.length > 0 ? { prefix } : {}),
                    ...(suffix.length > 0 ? { suffix } : {})
                },
                actions
            }

            // Add new rule to existing rules
            await api.setLifecycleRules(bucketName, [...existingRules, newRule])
            onCreated()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create lifecycle rule')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={() => !isSubmitting && onClose()}>
            <div className="lifecycle-modal" onClick={e => e.stopPropagation()}>
                <div className="lifecycle-modal-header">
                    <h3>Create Lifecycle Rule</h3>
                    <button
                        className="lifecycle-modal-close"
                        onClick={onClose}
                        disabled={isSubmitting}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={e => { void handleSubmit(e) }}>
                    <div className="lifecycle-modal-content">
                        {error !== null && (
                            <div className="lifecycle-modal-error">
                                {error}
                            </div>
                        )}

                        <div className="lifecycle-form-group">
                            <label htmlFor="rule-id">Rule ID</label>
                            <input
                                id="rule-id"
                                type="text"
                                value={ruleId}
                                onChange={e => setRuleId(e.target.value)}
                                placeholder="e.g., expire-temp-files"
                                disabled={isSubmitting}
                                required
                            />
                            <span className="lifecycle-form-help">Unique identifier for this rule</span>
                        </div>

                        <div className="lifecycle-form-group">
                            <label htmlFor="rule-type">Rule Type</label>
                            <select
                                id="rule-type"
                                value={ruleType}
                                onChange={e => setRuleType(e.target.value as RuleType)}
                                disabled={isSubmitting}
                            >
                                <option value="expiration">Expiration (Delete objects)</option>
                                <option value="transition">Transition to Infrequent Access (33% savings)</option>
                            </select>
                        </div>

                        <div className="lifecycle-form-group">
                            <label htmlFor="days">
                                {ruleType === 'expiration' ? 'Delete after' : 'Transition after'}
                            </label>
                            <div className="lifecycle-days-input">
                                <input
                                    id="days"
                                    type="number"
                                    value={days}
                                    onChange={e => setDays(Number(e.target.value))}
                                    min={1}
                                    max={3650}
                                    disabled={isSubmitting}
                                    required
                                />
                                <span>days</span>
                            </div>
                        </div>

                        <div className="lifecycle-form-section">
                            <h4>Filters (Optional)</h4>
                            <p className="lifecycle-form-section-help">
                                Leave empty to apply to all objects in the bucket
                            </p>

                            <div className="lifecycle-form-group">
                                <label htmlFor="prefix">Prefix</label>
                                <input
                                    id="prefix"
                                    type="text"
                                    value={prefix}
                                    onChange={e => setPrefix(e.target.value)}
                                    placeholder="e.g., temp/ or logs/"
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div className="lifecycle-form-group">
                                <label htmlFor="suffix">Suffix</label>
                                <input
                                    id="suffix"
                                    type="text"
                                    value={suffix}
                                    onChange={e => setSuffix(e.target.value)}
                                    placeholder="e.g., .tmp or .log"
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="lifecycle-modal-actions">
                        <button
                            type="button"
                            className="lifecycle-btn-cancel"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="lifecycle-btn-create"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Creating...' : 'Create Rule'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
