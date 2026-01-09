/**
 * Webhook Utilities
 * 
 * Handles sending webhook notifications to configured endpoints.
 * Supports HMAC-SHA256 signatures for secure payload verification.
 */

import type { Env, Webhook, WebhookEventType, WebhookPayload, WebhookResult } from '../types';
import { logInfo, logWarning } from './error-logger';

/**
 * Generate current ISO timestamp
 */
function nowISO(): string {
    return new Date().toISOString();
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
async function generateSignature(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Send a webhook to a configured endpoint
 */
export async function sendWebhook(
    webhook: Webhook,
    event: WebhookEventType,
    data: Record<string, unknown>
): Promise<WebhookResult> {
    const payload: WebhookPayload = {
        event,
        timestamp: nowISO(),
        data,
    };

    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'R2-Manager-Webhook/1.0',
        'X-Webhook-Event': event,
    };

    // Add HMAC signature if secret is configured
    if (webhook.secret) {
        const signature = await generateSignature(body, webhook.secret);
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    try {
        const response = await fetch(webhook.url, {
            method: 'POST',
            headers,
            body,
        });

        if (response.ok) {
            return { success: true, statusCode: response.status };
        } else {
            const errorText = await response.text().catch(() => 'Unknown error');
            return {
                success: false,
                statusCode: response.status,
                error: errorText.slice(0, 200),
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Get all enabled webhooks for a specific event type
 */
export async function getWebhooksForEvent(
    db: D1Database,
    event: WebhookEventType
): Promise<Webhook[]> {
    try {
        const result = await db.prepare(
            'SELECT * FROM webhooks WHERE enabled = 1'
        ).all<Webhook>();

        // Filter webhooks that are subscribed to this event
        return result.results.filter((webhook) => {
            try {
                const events = JSON.parse(webhook.events) as string[];
                return events.includes(event);
            } catch {
                return false;
            }
        });
    } catch (error) {
        logWarning(`Failed to get webhooks: ${error instanceof Error ? error.message : String(error)}`, {
            module: 'webhooks',
            operation: 'get_webhooks',
            metadata: { event, error: error instanceof Error ? error.message : String(error) }
        });
        return [];
    }
}

/**
 * Trigger webhooks for a specific event
 * This is a fire-and-forget operation - errors are logged but not propagated
 */
export async function triggerWebhooks(
    env: Env,
    event: WebhookEventType,
    data: Record<string, unknown>,
    isLocalDev: boolean
): Promise<void> {
    if (isLocalDev) {
        logInfo(`Mock trigger: ${event}`, {
            module: 'webhooks',
            operation: 'trigger',
            metadata: { event, data }
        });
        return;
    }

    if (!env.METADATA) {
        return;
    }

    try {
        const webhooks = await getWebhooksForEvent(env.METADATA, event);

        if (webhooks.length === 0) {
            return;
        }

        logInfo(`Triggering ${String(webhooks.length)} webhook(s) for event: ${event}`, {
            module: 'webhooks',
            operation: 'trigger',
            metadata: { event, webhookCount: webhooks.length }
        });

        // Send webhooks in parallel, don't await completion
        const promises = webhooks.map(async (webhook) => {
            try {
                const result = await sendWebhook(webhook, event, data);
                if (!result.success) {
                    logWarning(`Failed to send to ${webhook.name}: ${result.error ?? 'Unknown error'}`, {
                        module: 'webhooks',
                        operation: 'send',
                        metadata: { webhookName: webhook.name, event, error: result.error, statusCode: result.statusCode }
                    });
                }
            } catch (error) {
                logWarning(`Error sending to ${webhook.name}: ${error instanceof Error ? error.message : String(error)}`, {
                    module: 'webhooks',
                    operation: 'send',
                    metadata: { webhookName: webhook.name, event, error: error instanceof Error ? error.message : String(error) }
                });
            }
        });

        // Fire and forget - use waitUntil pattern in production
        void Promise.all(promises);
    } catch (error) {
        logWarning(`Trigger error: ${error instanceof Error ? error.message : String(error)}`, {
            module: 'webhooks',
            operation: 'trigger',
            metadata: { event, error: error instanceof Error ? error.message : String(error) }
        });
    }
}

// ============================================
// Helper functions for creating webhook payloads
// ============================================

/**
 * Create webhook payload for file upload events
 */
export function createFileUploadPayload(
    bucketName: string,
    fileName: string,
    sizeBytes: number,
    userEmail: string | null
): Record<string, unknown> {
    return {
        bucket_name: bucketName,
        file_name: fileName,
        size_bytes: sizeBytes,
        user_email: userEmail,
    };
}

/**
 * Create webhook payload for file download events
 */
export function createFileDownloadPayload(
    bucketName: string,
    fileName: string,
    userEmail: string | null
): Record<string, unknown> {
    return {
        bucket_name: bucketName,
        file_name: fileName,
        user_email: userEmail,
    };
}

/**
 * Create webhook payload for file delete events
 */
export function createFileDeletePayload(
    bucketName: string,
    fileName: string,
    userEmail: string | null
): Record<string, unknown> {
    return {
        bucket_name: bucketName,
        file_name: fileName,
        user_email: userEmail,
    };
}

/**
 * Create webhook payload for bucket creation events
 */
export function createBucketCreatePayload(
    bucketName: string,
    userEmail: string | null
): Record<string, unknown> {
    return {
        bucket_name: bucketName,
        user_email: userEmail,
    };
}

/**
 * Create webhook payload for bucket deletion events
 */
export function createBucketDeletePayload(
    bucketName: string,
    userEmail: string | null
): Record<string, unknown> {
    return {
        bucket_name: bucketName,
        user_email: userEmail,
    };
}

/**
 * Create webhook payload for job failure events
 */
export function createJobFailedPayload(
    jobId: string,
    jobType: string,
    error: string,
    bucketName: string | null,
    userEmail: string | null
): Record<string, unknown> {
    return {
        job_id: jobId,
        job_type: jobType,
        error,
        bucket_name: bucketName,
        user_email: userEmail,
    };
}

/**
 * Create webhook payload for job completion events
 */
export function createJobCompletedPayload(
    jobId: string,
    jobType: string,
    totalItems: number,
    processedItems: number,
    errorCount: number,
    bucketName: string | null,
    userEmail: string | null
): Record<string, unknown> {
    return {
        job_id: jobId,
        job_type: jobType,
        total_items: totalItems,
        processed_items: processedItems,
        error_count: errorCount,
        bucket_name: bucketName,
        user_email: userEmail,
    };
}

/**
 * Create webhook payload for file move events
 */
export function createFileMovePayload(
    sourceBucket: string,
    sourceFile: string,
    destBucket: string,
    destPath: string,
    userEmail: string | null
): Record<string, unknown> {
    return {
        source_bucket: sourceBucket,
        source_file: sourceFile,
        destination_bucket: destBucket,
        destination_path: destPath,
        user_email: userEmail,
    };
}

/**
 * Create webhook payload for file copy events
 */
export function createFileCopyPayload(
    sourceBucket: string,
    sourceFile: string,
    destBucket: string,
    destPath: string,
    userEmail: string | null
): Record<string, unknown> {
    return {
        source_bucket: sourceBucket,
        source_file: sourceFile,
        destination_bucket: destBucket,
        destination_path: destPath,
        user_email: userEmail,
    };
}

/**
 * Create webhook payload for file rename events
 */
export function createFileRenamePayload(
    bucketName: string,
    oldFileName: string,
    newFileName: string,
    userEmail: string | null
): Record<string, unknown> {
    return {
        bucket_name: bucketName,
        old_file_name: oldFileName,
        new_file_name: newFileName,
        user_email: userEmail,
    };
}

/**
 * Create webhook payload for bucket rename events
 */
export function createBucketRenamePayload(
    oldBucketName: string,
    newBucketName: string,
    userEmail: string | null
): Record<string, unknown> {
    return {
        old_bucket_name: oldBucketName,
        new_bucket_name: newBucketName,
        user_email: userEmail,
    };
}

/**
 * Create webhook payload for folder creation events
 */
export function createFolderCreatePayload(
    bucketName: string,
    folderPath: string,
    userEmail: string | null
): Record<string, unknown> {
    return {
        bucket_name: bucketName,
        folder_path: folderPath,
        user_email: userEmail,
    };
}

/**
 * Create webhook payload for folder deletion events
 */
export function createFolderDeletePayload(
    bucketName: string,
    folderPath: string,
    filesDeleted: number,
    userEmail: string | null
): Record<string, unknown> {
    return {
        bucket_name: bucketName,
        folder_path: folderPath,
        files_deleted: filesDeleted,
        user_email: userEmail,
    };
}

/**
 * Create webhook payload for bulk download completion events
 */
export function createBulkDownloadCompletePayload(
    bucketName: string | null,
    filesDownloaded: number,
    totalSizeBytes: number,
    userEmail: string | null
): Record<string, unknown> {
    return {
        bucket_name: bucketName,
        files_downloaded: filesDownloaded,
        total_size_bytes: totalSizeBytes,
        user_email: userEmail,
    };
}

/**
 * Create webhook payload for S3 import completion events
 */
export function createS3ImportCompletePayload(
    jobId: string,
    sourceBucket: string,
    destBucket: string,
    objectsCopied: number,
    objectsFailed: number,
    bytesCopied: number,
    userEmail: string | null
): Record<string, unknown> {
    return {
        job_id: jobId,
        source_bucket: sourceBucket,
        destination_bucket: destBucket,
        objects_copied: objectsCopied,
        objects_failed: objectsFailed,
        bytes_copied: bytesCopied,
        user_email: userEmail,
    };
}

