/**
 * Webhook API Client
 * 
 * Provides functions for managing webhook configurations via the backend API.
 */

import type {
    Webhook,
    WebhookInput,
    WebhooksResponse,
    WebhookResponse,
    WebhookTestResult,
} from '../types/webhook';

const API_BASE = '/api';

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (options.headers) {
        const optHeaders = options.headers instanceof Headers
            ? options.headers
            : new Headers(options.headers as Record<string, string>);
        optHeaders.forEach((value, key) => headers.set(key, value));
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(errorData.error ?? `Request failed: ${String(response.status)}`);
    }

    return response.json() as Promise<T>;
}

/**
 * Webhook API functions
 */
export const webhookApi = {
    /**
     * List all webhooks
     */
    async list(): Promise<Webhook[]> {
        const data = await apiFetch<WebhooksResponse>('/webhooks');
        return data.webhooks;
    },

    /**
     * Get a single webhook by ID
     */
    async get(id: string): Promise<Webhook> {
        const data = await apiFetch<WebhookResponse>(`/webhooks/${id}`);
        return data.webhook;
    },

    /**
     * Create a new webhook
     */
    async create(input: WebhookInput): Promise<Webhook> {
        const data = await apiFetch<WebhookResponse>('/webhooks', {
            method: 'POST',
            body: JSON.stringify(input),
        });
        return data.webhook;
    },

    /**
     * Update an existing webhook
     */
    async update(id: string, input: Partial<WebhookInput>): Promise<Webhook> {
        const data = await apiFetch<WebhookResponse>(`/webhooks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(input),
        });
        return data.webhook;
    },

    /**
     * Delete a webhook
     */
    async delete(id: string): Promise<void> {
        await apiFetch(`/webhooks/${id}`, { method: 'DELETE' });
    },

    /**
     * Test a webhook by sending a test payload
     */
    async test(id: string): Promise<WebhookTestResult> {
        return apiFetch<WebhookTestResult>(`/webhooks/${id}/test`, {
            method: 'POST',
        });
    },
};
