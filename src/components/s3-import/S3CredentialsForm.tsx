import { useState, useCallback, type JSX, type FormEvent } from 'react'
import { api } from '../../services/api'
import type { CreateS3ImportJobRequest } from '../../services/api'

interface S3CredentialsFormProps {
    buckets: string[]
    onJobCreated: () => void
    onError: (error: string | null) => void
    onOpenDashboard: () => void
}

// Common AWS regions
const AWS_REGIONS = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-east-2', label: 'US East (Ohio)' },
    { value: 'us-west-1', label: 'US West (N. California)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'eu-west-1', label: 'EU (Ireland)' },
    { value: 'eu-west-2', label: 'EU (London)' },
    { value: 'eu-central-1', label: 'EU (Frankfurt)' },
    { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
]

type ProviderType = 'aws' | 'gcs' | 's3_compatible'

export function S3CredentialsForm({
    buckets,
    onJobCreated,
    onError,
    onOpenDashboard
}: S3CredentialsFormProps): JSX.Element {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [provider, setProvider] = useState<ProviderType>('aws')
    const [sourceBucket, setSourceBucket] = useState('')
    const [accessKeyId, setAccessKeyId] = useState('')
    const [secretAccessKey, setSecretAccessKey] = useState('')
    const [region, setRegion] = useState('us-east-1')
    const [customEndpoint, setCustomEndpoint] = useState('')
    const [destinationBucket, setDestinationBucket] = useState(buckets[0] ?? '')
    const [isNewBucket, setIsNewBucket] = useState(false)
    const [newBucketName, setNewBucketName] = useState('')
    const [bucketSubpath, setBucketSubpath] = useState('')
    const [overwriteExisting, setOverwriteExisting] = useState(false)

    const handleSubmit = useCallback(async (e: FormEvent) => {
        e.preventDefault()
        onError(null)
        setIsSubmitting(true)

        try {
            let targetBucket = destinationBucket

            if (isNewBucket) {
                if (!newBucketName.trim()) {
                    onError('Please enter a name for the new bucket')
                    setIsSubmitting(false)
                    return
                }

                // Create the new bucket first
                try {
                    await api.createBucket(newBucketName)
                    targetBucket = newBucketName
                } catch (err) {
                    onError(`Failed to create bucket: ${err instanceof Error ? err.message : 'Unknown error'}`)
                    setIsSubmitting(false)
                    return
                }
            }

            const request: CreateS3ImportJobRequest = {
                sourceBucketName: sourceBucket,
                sourceAccessKeyId: accessKeyId,
                sourceSecretAccessKey: secretAccessKey,
                sourceRegion: region,
                sourceProvider: provider,
                destinationBucketName: targetBucket,
                overwriteExisting,
            }

            if (provider === 's3_compatible' && customEndpoint) {
                request.sourceEndpoint = customEndpoint
            }

            if (bucketSubpath) {
                request.bucketSubpath = bucketSubpath
            }

            const result = await api.createS3ImportJob(request)

            if (result.success && result.job) {
                onJobCreated()
            } else {
                onError(result.error ?? 'Failed to create migration job')
            }
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Failed to create migration job')
        } finally {
            setIsSubmitting(false)
        }
    }, [
        provider, sourceBucket, accessKeyId, secretAccessKey, region,
        customEndpoint, destinationBucket, bucketSubpath, overwriteExisting,
        isNewBucket, newBucketName, onJobCreated, onError
    ])

    return (
        <form className="s3-credentials-form" onSubmit={handleSubmit}>
            <div className="s3-form-section">
                <h3>Source Configuration</h3>

                <div className="s3-form-group">
                    <label htmlFor="s3-provider">Storage Provider</label>
                    <select
                        id="s3-provider"
                        name="s3-provider"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value as ProviderType)}
                    >
                        <option value="aws">Amazon S3</option>
                        <option value="gcs">Google Cloud Storage</option>
                        <option value="s3_compatible">S3-Compatible</option>
                    </select>
                </div>

                <div className="s3-form-group">
                    <label htmlFor="s3-source-bucket">Source Bucket Name *</label>
                    <input
                        type="text"
                        id="s3-source-bucket"
                        name="s3-source-bucket"
                        value={sourceBucket}
                        onChange={(e) => setSourceBucket(e.target.value)}
                        placeholder="my-s3-bucket"
                        required
                    />
                </div>

                <div className="s3-form-group">
                    <label htmlFor="s3-access-key">Access Key ID *</label>
                    <input
                        type="text"
                        id="s3-access-key"
                        name="s3-access-key"
                        value={accessKeyId}
                        onChange={(e) => setAccessKeyId(e.target.value)}
                        placeholder="AKIA..."
                        autoComplete="off"
                        required
                    />
                </div>

                <div className="s3-form-group">
                    <label htmlFor="s3-secret-key">Secret Access Key *</label>
                    <input
                        type="password"
                        id="s3-secret-key"
                        name="s3-secret-key"
                        value={secretAccessKey}
                        onChange={(e) => setSecretAccessKey(e.target.value)}
                        placeholder="••••••••••••••••"
                        autoComplete="off"
                        required
                    />
                </div>

                {provider !== 's3_compatible' && (
                    <div className="s3-form-group">
                        <label htmlFor="s3-region">Region</label>
                        <select
                            id="s3-region"
                            name="s3-region"
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                        >
                            {AWS_REGIONS.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    </div>
                )}

                {provider === 's3_compatible' && (
                    <div className="s3-form-group">
                        <label htmlFor="s3-endpoint">Custom Endpoint *</label>
                        <input
                            type="url"
                            id="s3-endpoint"
                            name="s3-endpoint"
                            value={customEndpoint}
                            onChange={(e) => setCustomEndpoint(e.target.value)}
                            placeholder="https://s3.example.com"
                            required={provider === 's3_compatible'}
                        />
                        <small>The S3-compatible endpoint URL</small>
                    </div>
                )}

                <div className="s3-form-group">
                    <label htmlFor="s3-subpath">Bucket Subpath (Optional)</label>
                    <input
                        type="text"
                        id="s3-subpath"
                        name="s3-subpath"
                        value={bucketSubpath}
                        onChange={(e) => setBucketSubpath(e.target.value)}
                        placeholder="path/to/files/"
                    />
                    <small>Only migrate files with this prefix</small>
                </div>
            </div>

            <div className="s3-form-section">
                <h3>Destination</h3>

                <div className="s3-form-group">
                    <div id="destination-bucket-label" className="s3-group-label">Destination R2 Bucket</div>
                    <div className="s3-destination-type-selector" role="radiogroup" aria-labelledby="destination-bucket-label">
                        <label className="s3-radio-option">
                            <input
                                type="radio"
                                name="bucket-mode"
                                value="existing"
                                checked={!isNewBucket}
                                onChange={() => setIsNewBucket(false)}
                            />
                            <span>Existing Bucket</span>
                        </label>
                        <label className="s3-radio-option">
                            <input
                                type="radio"
                                name="bucket-mode"
                                value="new"
                                checked={isNewBucket}
                                onChange={() => setIsNewBucket(true)}
                            />
                            <span>Create New Bucket</span>
                        </label>
                    </div>

                    {!isNewBucket ? (
                        <select
                            id="s3-destination-bucket"
                            name="s3-destination-bucket"
                            value={destinationBucket}
                            onChange={(e) => setDestinationBucket(e.target.value)}
                            required
                        >
                            {buckets.map((bucket) => (
                                <option key={bucket} value={bucket}>{bucket}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            id="s3-new-bucket-name"
                            name="s3-new-bucket-name"
                            value={newBucketName}
                            onChange={(e) => setNewBucketName(e.target.value)}
                            placeholder="Enter new bucket name"
                            pattern="^[a-z0-9-]+$"
                            title="Bucket names can only contain lowercase letters, numbers, and hyphens"
                            required
                        />
                    )}
                    {isNewBucket && (
                        <small>Bucket names must be lowercase, alphanumeric, and can contain hyphens.</small>
                    )}
                </div>

                <div className="s3-form-group s3-form-checkbox">
                    <input
                        type="checkbox"
                        id="s3-overwrite"
                        name="s3-overwrite"
                        checked={overwriteExisting}
                        onChange={(e) => setOverwriteExisting(e.target.checked)}
                    />
                    <label htmlFor="s3-overwrite">Overwrite existing objects</label>
                </div>
            </div>

            <div className="s3-form-info">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                </svg>
                <p>
                    Credentials are sent directly to Cloudflare and are not stored locally.
                    Create an IAM user with <code>s3:Get*</code> and <code>s3:List*</code> permissions.
                </p>
            </div>

            <div className="s3-form-actions">
                <button
                    type="button"
                    className="s3-btn-secondary"
                    onClick={onOpenDashboard}
                >
                    Open Dashboard
                </button>
                <button
                    type="submit"
                    className="s3-btn-primary"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Creating...' : 'Start Migration'}
                </button>
            </div>
        </form>
    )
}
