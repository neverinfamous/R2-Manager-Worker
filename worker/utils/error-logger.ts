/**
 * Centralized Error Logging System
 * 
 * Provides structured error logging with consistent format across all modules.
 * Integrates with webhooks to automatically notify external systems of critical errors.
 */

import type { Env, ErrorContext, ErrorSeverity, StructuredError } from '../types';
import { triggerWebhooks, createJobFailedPayload } from './webhooks';

/**
 * Generate current ISO timestamp
 */
function nowISO(): string {
    return new Date().toISOString();
}

/**
 * Error code prefixes by module
 */
const ERROR_CODE_PREFIXES: Record<string, string> = {
    buckets: 'BKT',
    files: 'FILE',
    folders: 'FLDR',
    jobs: 'JOB',
    ai_search: 'AI',
    s3_import: 'S3',
    metrics: 'MTR',
    webhooks: 'WHK',
    audit: 'AUD',
    search: 'SRCH',
    worker: 'WRK',
    auth: 'AUTH',
    assets: 'ASSET',
    helpers: 'HELP',
    ratelimit: 'RATE',
    signing: 'SIGN',
};

/**
 * Generate an error code from context with appropriate suffix based on severity
 */
function generateErrorCode(context: ErrorContext, level: ErrorSeverity): string {
    const prefix = ERROR_CODE_PREFIXES[context.module] ?? 'ERR';
    const operation = context.operation.toUpperCase().replace(/[^A-Z0-9]/g, '_');

    // Use appropriate suffix based on severity level
    switch (level) {
        case 'error':
            return `${prefix}_${operation}_FAILED`;
        case 'warning':
            return `${prefix}_${operation}_WARN`;
        case 'info':
            return `${prefix}_${operation}`;
    }
}

/**
 * Format error for console logging with structured output
 */
function formatForConsole(error: StructuredError): string {
    const parts = [
        `[${error.level.toUpperCase()}]`,
        `[${error.context.module}]`,
        `[${error.code}]`,
        error.message,
    ];

    if (error.context.entityId) {
        parts.push(`(id: ${error.context.entityId})`);
    }

    if (error.context.bucketName) {
        parts.push(`(bucket: ${error.context.bucketName})`);
    }

    if (error.context.fileName) {
        parts.push(`(file: ${error.context.fileName})`);
    }

    return parts.join(' ');
}

/**
 * Create a structured error object
 */
export function createStructuredError(
    error: Error | string,
    context: ErrorContext,
    level: ErrorSeverity = 'error'
): StructuredError {
    const message = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : undefined;

    return {
        timestamp: nowISO(),
        level,
        code: generateErrorCode(context, level),
        message,
        context,
        stack,
    };
}

/**
 * Log an error with structured format
 * Automatically triggers webhooks for error-level logs
 */
export async function logError(
    env: Env,
    error: Error | string,
    context: ErrorContext,
    isLocalDev: boolean,
    options: {
        triggerWebhook?: boolean;
        jobId?: string;
    } = {}
): Promise<StructuredError> {
    const structuredError = createStructuredError(error, context, 'error');

    // Log to console with structured format
    console.error(formatForConsole(structuredError));
    if (structuredError.stack) {
        console.error('[Stack]', structuredError.stack);
    }

    // Log metadata if present
    if (context.metadata && Object.keys(context.metadata).length > 0) {
        console.error('[Metadata]', JSON.stringify(context.metadata));
    }

    // Trigger webhook for job failures
    if (options.triggerWebhook !== false && options.jobId) {
        try {
            await triggerWebhooks(
                env,
                'job_failed',
                createJobFailedPayload(
                    options.jobId,
                    context.operation,
                    structuredError.message,
                    context.bucketName ?? null,
                    context.userId ?? null
                ),
                isLocalDev
            );
        } catch (webhookError) {
            console.error('[ErrorLogger] Failed to trigger webhook:', webhookError);
        }
    }

    return structuredError;
}

/**
 * Log a warning with structured format
 */
export function logWarning(
    message: string,
    context: ErrorContext
): StructuredError {
    const structuredError = createStructuredError(message, context, 'warning');

    console.warn(formatForConsole(structuredError));

    if (context.metadata && Object.keys(context.metadata).length > 0) {
        console.warn('[Metadata]', JSON.stringify(context.metadata));
    }

    return structuredError;
}

/**
 * Log an info message with structured format
 */
export function logInfo(
    message: string,
    context: ErrorContext
): StructuredError {
    const structuredError = createStructuredError(message, context, 'info');

    console.log(formatForConsole(structuredError));

    return structuredError;
}

/**
 * Format error for webhook payload
 */
export function formatErrorForWebhook(error: StructuredError): Record<string, unknown> {
    return {
        timestamp: error.timestamp,
        level: error.level,
        code: error.code,
        message: error.message,
        module: error.context.module,
        operation: error.context.operation,
        bucket_name: error.context.bucketName,
        file_name: error.context.fileName,
        user_id: error.context.userId,
        metadata: error.context.metadata,
    };
}

/**
 * Create error context helper
 */
export function createErrorContext(
    module: string,
    operation: string,
    options: {
        entityId?: string;
        bucketName?: string;
        fileName?: string;
        userId?: string;
        metadata?: Record<string, unknown>;
    } = {}
): ErrorContext {
    return {
        module,
        operation,
        ...options,
    };
}

/**
 * Wrap an async operation with error logging
 * Logs errors and optionally triggers webhooks on failure
 */
export async function withErrorLogging<T>(
    env: Env,
    context: ErrorContext,
    isLocalDev: boolean,
    operation: () => Promise<T>,
    options: {
        triggerWebhook?: boolean;
        jobId?: string;
        rethrow?: boolean;
    } = {}
): Promise<T | null> {
    try {
        return await operation();
    } catch (error) {
        const logOptions: { triggerWebhook?: boolean; jobId?: string } = {};
        if (options.triggerWebhook !== undefined) {
            logOptions.triggerWebhook = options.triggerWebhook;
        }
        if (options.jobId !== undefined) {
            logOptions.jobId = options.jobId;
        }

        await logError(
            env,
            error instanceof Error ? error : String(error),
            context,
            isLocalDev,
            logOptions
        );

        if (options.rethrow !== false) {
            throw error;
        }

        return null;
    }
}
