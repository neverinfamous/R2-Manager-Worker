/**
 * Lifecycle Types for R2 Manager Frontend
 * 
 * Types for managing R2 bucket object lifecycle rules including
 * expiration and transition to Infrequent Access storage.
 */

/**
 * Condition that triggers a lifecycle rule
 */
export interface LifecycleRuleCondition {
    /** Maximum age in seconds before action is triggered */
    maxAgeSeconds?: number
    /** Only apply to objects with this prefix */
    prefix?: string
    /** Only apply to objects with this suffix */
    suffix?: string
}

/**
 * Action to take when condition is met
 */
export interface LifecycleRuleAction {
    /** Type of action: Delete or transition to different storage class */
    type: 'Delete' | 'SetStorageClass'
    /** Target storage class (for SetStorageClass action) */
    storageClass?: 'InfrequentAccess'
}

/**
 * Single lifecycle rule
 */
export interface LifecycleRule {
    /** Unique rule identifier */
    id: string
    /** Whether the rule is active */
    enabled: boolean
    /** Conditions that trigger the rule */
    conditions?: LifecycleRuleCondition
    /** Actions to perform when conditions are met */
    actions?: LifecycleRuleAction[]
    /** Days after which incomplete multipart uploads are aborted */
    abortMultipartUploadsAfterDays?: number
}

/**
 * API response for lifecycle rules
 */
export interface LifecycleRulesResponse {
    success: boolean
    result?: {
        rules: LifecycleRule[]
    }
    error?: string
}

/**
 * Helper to convert seconds to days for display
 */
export function secondsToDays(seconds: number): number {
    return Math.round(seconds / 86400)
}

/**
 * Helper to convert days to seconds for API
 */
export function daysToSeconds(days: number): number {
    return days * 86400
}
