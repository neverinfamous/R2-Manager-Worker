/**
 * TagSearch Component
 * 
 * Dedicated tag search page for finding buckets by tags.
 * Provides tag selection, match mode toggle, and results display.
 */

import { useState, useCallback, useEffect, type JSX } from 'react'
import { api } from '../../services/api'
import { logger } from '../../services/logger'
import type { TagSummary, TagSearchResult } from '../../types/tags'
import '../../styles/tags.css'

interface TagSearchProps {
    /** Callback when user wants to navigate to a bucket */
    onNavigateToBucket?: (bucketName: string) => void
}

export function TagSearch({ onNavigateToBucket }: TagSearchProps): JSX.Element {
    const [availableTags, setAvailableTags] = useState<TagSummary[]>([])
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [matchAll, setMatchAll] = useState(false)
    const [results, setResults] = useState<TagSearchResult[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchPerformed, setSearchPerformed] = useState(false)

    // Load available tags on mount
    useEffect(() => {
        async function loadTags(): Promise<void> {
            setIsLoading(true)
            try {
                const tags = await api.getAllTags()
                setAvailableTags(tags)
            } catch (err) {
                logger.error('TagSearch', 'Failed to load tags', err)
                setError('Failed to load tags')
            } finally {
                setIsLoading(false)
            }
        }
        void loadTags()
    }, [])

    // Search when tags change
    useEffect(() => {
        if (selectedTags.length === 0) {
            setResults([])
            setSearchPerformed(false)
            return
        }

        async function search(): Promise<void> {
            setIsSearching(true)
            setError(null)
            try {
                const searchResults = await api.searchByTags(selectedTags, matchAll)
                setResults(searchResults)
                setSearchPerformed(true)
            } catch (err) {
                logger.error('TagSearch', 'Search failed', err)
                setError('Search failed')
                setResults([])
            } finally {
                setIsSearching(false)
            }
        }

        // Debounce search
        const timer = setTimeout(() => {
            void search()
        }, 300)

        return () => clearTimeout(timer)
    }, [selectedTags, matchAll])

    const handleTagToggle = useCallback((tag: string): void => {
        setSelectedTags(prev =>
            prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        )
    }, [])

    const handleRemoveTag = useCallback((tag: string): void => {
        setSelectedTags(prev => prev.filter(t => t !== tag))
    }, [])

    const handleClearAll = useCallback((): void => {
        setSelectedTags([])
        setResults([])
        setSearchPerformed(false)
    }, [])

    const handleRefreshTags = useCallback(async (): Promise<void> => {
        try {
            const tags = await api.getAllTags(true)
            setAvailableTags(tags)
        } catch (err) {
            logger.error('TagSearch', 'Failed to refresh tags', err)
        }
    }, [])

    return (
        <div className="tag-search-container">
            <div className="tag-search-header">
                <h2>Search by Tags</h2>
                <button
                    type="button"
                    className="bucket-button"
                    onClick={() => void handleRefreshTags()}
                    disabled={isLoading}
                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                >
                    Refresh Tags
                </button>
            </div>

            {/* Loading state */}
            {isLoading && (
                <div className="tag-search-empty">Loading tags...</div>
            )}

            {/* Error state */}
            {error && (
                <div className="error-message">{error}</div>
            )}

            {/* Main content */}
            {!isLoading && (
                <>
                    {/* Match mode toggle */}
                    <div className="tag-search-controls">
                        <div className="tag-filter-match-mode">
                            <label>
                                <input
                                    type="radio"
                                    name="tag-search-match-mode"
                                    checked={!matchAll}
                                    onChange={() => setMatchAll(false)}
                                />
                                Match Any
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="tag-search-match-mode"
                                    checked={matchAll}
                                    onChange={() => setMatchAll(true)}
                                />
                                Match All
                            </label>
                        </div>
                        {selectedTags.length > 0 && (
                            <button
                                type="button"
                                className="tag-filter-clear"
                                onClick={handleClearAll}
                            >
                                Clear All
                            </button>
                        )}
                    </div>

                    {/* Selected tags */}
                    {selectedTags.length > 0 && (
                        <div className="tag-search-selected-tags">
                            {selectedTags.map(tag => (
                                <span key={tag} className="tag-badge">
                                    {tag}
                                    <button
                                        type="button"
                                        className="tag-badge-remove"
                                        onClick={() => handleRemoveTag(tag)}
                                        aria-label={`Remove tag ${tag}`}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Available tags grid */}
                    <div className="tag-list" style={{ maxHeight: '180px', marginBottom: '1rem' }}>
                        <div className="tag-list-header">Available Tags ({availableTags.length})</div>
                        {availableTags.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {availableTags.map(({ tag, bucket_count }) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        className={`tag-badge ${selectedTags.includes(tag) ? 'active' : ''}`}
                                        onClick={() => handleTagToggle(tag)}
                                        style={{
                                            cursor: 'pointer',
                                            opacity: selectedTags.includes(tag) ? 1 : 0.7,
                                            background: selectedTags.includes(tag)
                                                ? 'var(--accent-primary)'
                                                : 'var(--accent-primary-alpha, rgba(59, 130, 246, 0.1))',
                                            color: selectedTags.includes(tag) ? 'white' : 'var(--accent-primary)',
                                            border: 'none'
                                        }}
                                        aria-pressed={selectedTags.includes(tag)}
                                        title={`${bucket_count} bucket${bucket_count !== 1 ? 's' : ''}`}
                                    >
                                        {tag}
                                        <span style={{
                                            marginLeft: '0.25rem',
                                            opacity: 0.8,
                                            fontSize: '0.875rem'
                                        }}>
                                            ({bucket_count})
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                No tags found. Add tags to buckets to use this feature.
                            </div>
                        )}
                    </div>

                    {/* Search results */}
                    {searchPerformed && (
                        <div className="tag-search-results">
                            <div className="tag-search-results-header">
                                <span className="tag-search-results-count">
                                    {isSearching ? 'Searching...' : `${results.length} bucket${results.length !== 1 ? 's' : ''} found`}
                                </span>
                            </div>

                            {results.length > 0 ? (
                                <table className="tag-search-results-table">
                                    <thead>
                                        <tr>
                                            <th>Bucket Name</th>
                                            <th>Tags</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map(result => (
                                            <tr key={result.bucket_name}>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="tag-search-bucket-link"
                                                        onClick={() => onNavigateToBucket?.(result.bucket_name)}
                                                        style={{ background: 'none', border: 'none', textAlign: 'left' }}
                                                    >
                                                        {result.bucket_name}
                                                    </button>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                                        {result.tags.map(tag => (
                                                            <span
                                                                key={tag}
                                                                className="tag-badge small"
                                                                style={{
                                                                    background: selectedTags.includes(tag)
                                                                        ? 'var(--accent-primary)'
                                                                        : 'var(--accent-primary-alpha, rgba(59, 130, 246, 0.1))',
                                                                    color: selectedTags.includes(tag) ? 'white' : 'var(--accent-primary)'
                                                                }}
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="bucket-button"
                                                        onClick={() => onNavigateToBucket?.(result.bucket_name)}
                                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                    >
                                                        Open
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="tag-search-empty">
                                    No buckets found matching the selected tags
                                </div>
                            )}
                        </div>
                    )}

                    {/* Instructions */}
                    {!searchPerformed && selectedTags.length === 0 && availableTags.length > 0 && (
                        <div className="tag-search-empty">
                            Select one or more tags above to search for buckets
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
