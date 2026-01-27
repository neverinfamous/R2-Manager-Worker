/**
 * Webhook Routes
 *
 * CRUD API for managing webhook configurations.
 * Supports creating, updating, deleting, and testing webhooks.
 */

import type { Env, Webhook, WebhookInput, WebhookTestResult } from "../types";
import type { CorsHeaders } from "../utils/cors";
import { sendWebhook } from "../utils/webhooks";
import { logError } from "../utils/error-logger";

// Helper to create response headers with CORS
function jsonHeaders(corsHeaders: CorsHeaders): Headers {
  const headers = new Headers({ "Content-Type": "application/json" });
  Object.entries(corsHeaders).forEach(([key, value]) =>
    headers.set(key, value),
  );
  return headers;
}

// Generate a unique ID for webhooks
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `whk_${timestamp}${randomStr}`;
}

// Get current ISO timestamp
function nowISO(): string {
  return new Date().toISOString();
}

// JSON response helper
function jsonResponse(
  data: unknown,
  corsHeaders: CorsHeaders,
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders(corsHeaders),
  });
}

// Error response helper
function errorResponse(
  message: string,
  corsHeaders: CorsHeaders,
  status = 500,
): Response {
  return jsonResponse({ error: message }, corsHeaders, status);
}

// Parse JSON body safely
async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Mock webhooks for local development
 */
const MOCK_WEBHOOKS: Webhook[] = [
  {
    id: "webhook-1",
    name: "Slack Notifications",
    url: "https://hooks.slack.com/services/xxx/yyy/zzz",
    secret: "mock-secret-123",
    events: JSON.stringify(["file_upload", "bucket_create", "job_failed"]),
    enabled: 1,
    created_at: "2024-03-01T12:00:00Z",
    updated_at: "2024-03-01T12:00:00Z",
  },
  {
    id: "webhook-2",
    name: "Discord Alerts",
    url: "https://discord.com/api/webhooks/xxx/yyy",
    secret: null,
    events: JSON.stringify(["job_completed", "bucket_delete"]),
    enabled: 0,
    created_at: "2024-03-02T14:30:00Z",
    updated_at: "2024-03-02T14:30:00Z",
  },
];

// Handle webhook routes
export async function handleWebhookRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  _userEmail: string | null,
): Promise<Response | null> {
  const path = url.pathname;

  // List all webhooks
  if (path === "/api/webhooks" && request.method === "GET") {
    return listWebhooks(env, corsHeaders, isLocalDev);
  }

  // Create webhook
  if (path === "/api/webhooks" && request.method === "POST") {
    return createWebhook(request, env, corsHeaders, isLocalDev);
  }

  // Get single webhook
  const getMatch = /^\/api\/webhooks\/([^/]+)$/.exec(path);
  if (getMatch && request.method === "GET") {
    const id = getMatch[1];
    if (id) return getWebhook(id, env, corsHeaders, isLocalDev);
  }

  // Update webhook
  const updateMatch = /^\/api\/webhooks\/([^/]+)$/.exec(path);
  if (updateMatch && request.method === "PUT") {
    const id = updateMatch[1];
    if (id) return updateWebhook(id, request, env, corsHeaders, isLocalDev);
  }

  // Delete webhook
  const deleteMatch = /^\/api\/webhooks\/([^/]+)$/.exec(path);
  if (deleteMatch && request.method === "DELETE") {
    const id = deleteMatch[1];
    if (id) return deleteWebhook(id, env, corsHeaders, isLocalDev);
  }

  // Test webhook
  const testMatch = /^\/api\/webhooks\/([^/]+)\/test$/.exec(path);
  if (testMatch && request.method === "POST") {
    const id = testMatch[1];
    if (id) return testWebhook(id, env, corsHeaders, isLocalDev);
  }

  return null;
}

// List all webhooks
async function listWebhooks(
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
): Promise<Response> {
  if (isLocalDev) {
    return jsonResponse({ webhooks: MOCK_WEBHOOKS }, corsHeaders);
  }

  if (!env.METADATA) {
    return errorResponse("Database not configured", corsHeaders, 500);
  }

  try {
    const result = await env.METADATA.prepare(
      "SELECT * FROM webhooks ORDER BY created_at DESC",
    ).all<Webhook>();

    return jsonResponse({ webhooks: result.results }, corsHeaders);
  } catch (error) {
    await logError(
      env,
      error instanceof Error ? error : String(error),
      { module: "webhooks", operation: "list_webhooks" },
      isLocalDev,
    );
    return errorResponse(
      error instanceof Error ? error.message : "Failed to list webhooks",
      corsHeaders,
      500,
    );
  }
}

// Get a single webhook by ID
async function getWebhook(
  webhookId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
): Promise<Response> {
  if (isLocalDev) {
    const webhook = MOCK_WEBHOOKS.find((w) => w.id === webhookId);
    if (!webhook) {
      return errorResponse("Webhook not found", corsHeaders, 404);
    }
    return jsonResponse({ webhook }, corsHeaders);
  }

  if (!env.METADATA) {
    return errorResponse("Database not configured", corsHeaders, 500);
  }

  try {
    const result = await env.METADATA.prepare(
      "SELECT * FROM webhooks WHERE id = ?",
    )
      .bind(webhookId)
      .first<Webhook>();

    if (!result) {
      return errorResponse("Webhook not found", corsHeaders, 404);
    }

    return jsonResponse({ webhook: result }, corsHeaders);
  } catch (error) {
    await logError(
      env,
      error instanceof Error ? error : String(error),
      { module: "webhooks", operation: "get_webhook", metadata: { webhookId } },
      isLocalDev,
    );
    return errorResponse(
      error instanceof Error ? error.message : "Failed to get webhook",
      corsHeaders,
      500,
    );
  }
}

// Create a new webhook
async function createWebhook(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
): Promise<Response> {
  const body = await parseJsonBody<Partial<WebhookInput>>(request);

  if (!body?.name || !body?.url || (body?.events?.length ?? 0) === 0) {
    return errorResponse(
      "Missing required fields: name, url, events",
      corsHeaders,
      400,
    );
  }

  if (isLocalDev) {
    const newWebhook: Webhook = {
      id: generateId(),
      name: body.name,
      url: body.url,
      secret: body.secret ?? null,
      events: JSON.stringify(body.events),
      enabled: body.enabled !== false ? 1 : 0,
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    return jsonResponse({ webhook: newWebhook }, corsHeaders, 201);
  }

  if (!env.METADATA) {
    return errorResponse("Database not configured", corsHeaders, 500);
  }

  try {
    const id = generateId();
    const eventsJson = JSON.stringify(body.events);
    const enabled = body.enabled !== false ? 1 : 0;

    await env.METADATA.prepare(
      `INSERT INTO webhooks (id, name, url, secret, events, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, body.name, body.url, body.secret ?? null, eventsJson, enabled)
      .run();

    const webhook = await env.METADATA.prepare(
      "SELECT * FROM webhooks WHERE id = ?",
    )
      .bind(id)
      .first<Webhook>();

    return jsonResponse({ webhook }, corsHeaders, 201);
  } catch (error) {
    await logError(
      env,
      error instanceof Error ? error : String(error),
      { module: "webhooks", operation: "create_webhook" },
      isLocalDev,
    );
    return errorResponse(
      error instanceof Error ? error.message : "Failed to create webhook",
      corsHeaders,
      500,
    );
  }
}

// Update an existing webhook
async function updateWebhook(
  webhookId: string,
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
): Promise<Response> {
  const body = await parseJsonBody<Partial<WebhookInput>>(request);

  if (!body) {
    return errorResponse("Invalid request body", corsHeaders, 400);
  }

  if (isLocalDev) {
    const webhook = MOCK_WEBHOOKS.find((w) => w.id === webhookId);
    if (!webhook) {
      return errorResponse("Webhook not found", corsHeaders, 404);
    }

    const updated: Webhook = {
      ...webhook,
      name: body.name ?? webhook.name,
      url: body.url ?? webhook.url,
      secret: body.secret !== undefined ? body.secret : webhook.secret,
      events: body.events ? JSON.stringify(body.events) : webhook.events,
      enabled:
        body.enabled !== undefined ? (body.enabled ? 1 : 0) : webhook.enabled,
      updated_at: nowISO(),
    };

    return jsonResponse({ webhook: updated }, corsHeaders);
  }

  if (!env.METADATA) {
    return errorResponse("Database not configured", corsHeaders, 500);
  }

  try {
    // Check if webhook exists
    const existing = await env.METADATA.prepare(
      "SELECT * FROM webhooks WHERE id = ?",
    )
      .bind(webhookId)
      .first<Webhook>();

    if (!existing) {
      return errorResponse("Webhook not found", corsHeaders, 404);
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.name !== undefined) {
      updates.push("name = ?");
      values.push(body.name);
    }
    if (body.url !== undefined) {
      updates.push("url = ?");
      values.push(body.url);
    }
    if (body.secret !== undefined) {
      updates.push("secret = ?");
      values.push(body.secret);
    }
    if (body.events !== undefined) {
      updates.push("events = ?");
      values.push(JSON.stringify(body.events));
    }
    if (body.enabled !== undefined) {
      updates.push("enabled = ?");
      values.push(body.enabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return errorResponse("No fields to update", corsHeaders, 400);
    }

    updates.push('updated_at = datetime("now")');
    values.push(webhookId);

    await env.METADATA.prepare(
      `UPDATE webhooks SET ${updates.join(", ")} WHERE id = ?`,
    )
      .bind(...values)
      .run();

    const webhook = await env.METADATA.prepare(
      "SELECT * FROM webhooks WHERE id = ?",
    )
      .bind(webhookId)
      .first<Webhook>();

    return jsonResponse({ webhook }, corsHeaders);
  } catch (error) {
    await logError(
      env,
      error instanceof Error ? error : String(error),
      {
        module: "webhooks",
        operation: "update_webhook",
        metadata: { webhookId },
      },
      isLocalDev,
    );
    return errorResponse(
      error instanceof Error ? error.message : "Failed to update webhook",
      corsHeaders,
      500,
    );
  }
}

// Delete a webhook
async function deleteWebhook(
  webhookId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
): Promise<Response> {
  if (isLocalDev) {
    const index = MOCK_WEBHOOKS.findIndex((w) => w.id === webhookId);
    if (index === -1) {
      return errorResponse("Webhook not found", corsHeaders, 404);
    }
    return jsonResponse({ success: true }, corsHeaders);
  }

  if (!env.METADATA) {
    return errorResponse("Database not configured", corsHeaders, 500);
  }

  try {
    const result = await env.METADATA.prepare(
      "DELETE FROM webhooks WHERE id = ?",
    )
      .bind(webhookId)
      .run();

    if (result.meta.changes === 0) {
      return errorResponse("Webhook not found", corsHeaders, 404);
    }

    return jsonResponse({ success: true }, corsHeaders);
  } catch (error) {
    await logError(
      env,
      error instanceof Error ? error : String(error),
      {
        module: "webhooks",
        operation: "delete_webhook",
        metadata: { webhookId },
      },
      isLocalDev,
    );
    return errorResponse(
      error instanceof Error ? error.message : "Failed to delete webhook",
      corsHeaders,
      500,
    );
  }
}

// Test a webhook by sending a test payload
async function testWebhook(
  webhookId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
): Promise<Response> {
  if (isLocalDev) {
    const webhook = MOCK_WEBHOOKS.find((w) => w.id === webhookId);
    if (!webhook) {
      return errorResponse("Webhook not found", corsHeaders, 404);
    }

    const result: WebhookTestResult = {
      success: true,
      message: "Test webhook sent successfully (mock mode)",
      statusCode: 200,
    };

    return jsonResponse(result, corsHeaders);
  }

  if (!env.METADATA) {
    return errorResponse("Database not configured", corsHeaders, 500);
  }

  try {
    const webhook = await env.METADATA.prepare(
      "SELECT * FROM webhooks WHERE id = ?",
    )
      .bind(webhookId)
      .first<Webhook>();

    if (!webhook) {
      return errorResponse("Webhook not found", corsHeaders, 404);
    }

    // Send test payload
    const testData = {
      test: true,
      message: "This is a test webhook from R2 Manager",
      timestamp: nowISO(),
    };

    const sendResult = await sendWebhook(webhook, "file_upload", testData);

    const result: WebhookTestResult = {
      success: sendResult.success,
      message: sendResult.success
        ? `Test webhook sent successfully (HTTP ${sendResult.statusCode ?? "unknown"})`
        : `Test webhook failed: ${sendResult.error ?? "Unknown error"}`,
      ...(sendResult.statusCode !== undefined && {
        statusCode: sendResult.statusCode,
      }),
      ...(sendResult.error !== undefined && { error: sendResult.error }),
    };

    return jsonResponse(result, corsHeaders);
  } catch (error) {
    await logError(
      env,
      error instanceof Error ? error : String(error),
      {
        module: "webhooks",
        operation: "test_webhook",
        metadata: { webhookId },
      },
      isLocalDev,
    );
    const result: WebhookTestResult = {
      success: false,
      message: "Failed to send test webhook",
      error: error instanceof Error ? error.message : "Unknown error",
    };
    return jsonResponse(result, corsHeaders, 500);
  }
}
