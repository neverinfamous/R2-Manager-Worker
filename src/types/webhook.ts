/**
 * Webhook Types for R2 Manager Frontend
 */

/**
 * Webhook event types available in R2 Manager
 */
export type WebhookEventType =
    | 'file_upload'
    | 'file_download'
    | 'file_delete'
    | 'bucket_create'
    | 'bucket_delete'
    | 'job_failed'
    | 'job_completed';

/**
 * Webhook from API
 */
export interface Webhook {
    id: string;
    name: string;
    url: string;
    secret: string | null;
    events: string; // JSON array of WebhookEventType
    enabled: number;
    created_at: string;
    updated_at: string;
}

/**
 * Webhook create/update request
 */
export interface WebhookInput {
    name: string;
    url: string;
    secret?: string | null;
    events: WebhookEventType[];
    enabled?: boolean;
}

/**
 * Webhook test result
 */
export interface WebhookTestResult {
    success: boolean;
    message: string;
    statusCode?: number;
    error?: string;
}

/**
 * API response types
 */
export interface WebhooksResponse {
    webhooks: Webhook[];
}

export interface WebhookResponse {
    webhook: Webhook;
}

/**
 * Event type labels for UI display
 */
export const WEBHOOK_EVENT_LABELS: Record<WebhookEventType, string> = {
    file_upload: 'File Uploaded',
    file_download: 'File Downloaded',
    file_delete: 'File Deleted',
    bucket_create: 'Bucket Created',
    bucket_delete: 'Bucket Deleted',
    job_failed: 'Job Failed',
    job_completed: 'Job Completed',
};

/**
 * Event type descriptions for UI display
 */
export const WEBHOOK_EVENT_DESCRIPTIONS: Record<WebhookEventType, string> = {
    file_upload: 'Triggered when a file is uploaded to a bucket',
    file_download: 'Triggered when a file is downloaded from a bucket',
    file_delete: 'Triggered when a file is deleted from a bucket',
    bucket_create: 'Triggered when a new bucket is created',
    bucket_delete: 'Triggered when a bucket is deleted',
    job_failed: 'Triggered when any tracked operation fails',
    job_completed: 'Triggered when a bulk operation completes successfully',
};

/**
 * All available webhook event types
 */
export const ALL_WEBHOOK_EVENTS: WebhookEventType[] = [
    'file_upload',
    'file_download',
    'file_delete',
    'bucket_create',
    'bucket_delete',
    'job_failed',
    'job_completed',
];
