/**
 * Tag Types
 * 
 * Type definitions for bucket tagging functionality.
 */

/**
 * A single tag assigned to a bucket
 */
export interface BucketTag {
    bucket_name: string;
    tag: string;
    created_at: string;
    created_by?: string | null;
}

/**
 * Summary of a tag with usage count
 */
export interface TagSummary {
    tag: string;
    bucket_count: number;
}

/**
 * Result from tag-based bucket search
 */
export interface TagSearchResult {
    bucket_name: string;
    tags: string[];
}

/**
 * Response from tag search API
 */
export interface TagSearchResponse {
    results: TagSearchResult[];
    matchAll: boolean;
    searchTags: string[];
}

/**
 * Filter state for tag-based filtering
 */
export interface TagFilter {
    selectedTags: string[];
    matchAll: boolean;
}
