/**
 * Tag Routes
 *
 * CRUD API for managing bucket tags.
 * Supports listing, creating, updating, and deleting bucket tags.
 * Includes tag search functionality for finding buckets by tags.
 */

import type { Env } from "../types";
import type { CorsHeaders } from "../utils/cors";
import { logInfo, logError } from "../utils/error-logger";

// ============================================
// Types
// ============================================

interface BucketTag {
  bucket_name: string;
  tag: string;
  created_at: string;
  created_by: string | null;
}

interface TagSummary {
  tag: string;
  bucket_count: number;
}

interface TagSearchResult {
  bucket_name: string;
  tags: string[];
}

// ============================================
// Cache
// ============================================

// Cache with 5-minute TTL
const TAG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const allTagsCache: { data: TagSummary[] | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};
const bucketTagsCache = new Map<
  string,
  { data: string[]; timestamp: number }
>();

function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < TAG_CACHE_TTL;
}

function invalidateAllTagsCache(): void {
  allTagsCache.data = null;
  allTagsCache.timestamp = 0;
}

function invalidateBucketTagsCache(bucketName: string): void {
  bucketTagsCache.delete(bucketName);
}

// ============================================
// Helpers
// ============================================

function jsonHeaders(corsHeaders: CorsHeaders): Headers {
  const headers = new Headers({ "Content-Type": "application/json" });
  Object.entries(corsHeaders).forEach(([key, value]) =>
    headers.set(key, value),
  );
  return headers;
}

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

function errorResponse(
  message: string,
  code: string,
  corsHeaders: CorsHeaders,
  status = 500,
): Response {
  return jsonResponse({ error: message, code }, corsHeaders, status);
}

async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

// Tag validation: alphanumeric, hyphens, underscores, max 32 chars
function validateTag(tag: string): { valid: boolean; error?: string } {
  if (!tag || tag.trim().length === 0) {
    return { valid: false, error: "Tag cannot be empty" };
  }

  const normalized = tag.trim().toLowerCase();

  if (normalized.length > 32) {
    return { valid: false, error: "Tag must be 32 characters or less" };
  }

  if (!/^[a-z0-9][a-z0-9-_]*[a-z0-9]$|^[a-z0-9]$/.test(normalized)) {
    return {
      valid: false,
      error:
        "Tag must contain only letters, numbers, hyphens, and underscores, and cannot start or end with a hyphen or underscore",
    };
  }

  return { valid: true };
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

// ============================================
// Mock Data
// ============================================

const MOCK_TAGS: BucketTag[] = [
  {
    bucket_name: "dev-bucket",
    tag: "development",
    created_at: "2024-01-15T10:00:00Z",
    created_by: "dev@localhost",
  },
  {
    bucket_name: "dev-bucket",
    tag: "testing",
    created_at: "2024-01-16T10:00:00Z",
    created_by: "dev@localhost",
  },
  {
    bucket_name: "prod-bucket",
    tag: "production",
    created_at: "2024-01-10T10:00:00Z",
    created_by: "dev@localhost",
  },
  {
    bucket_name: "prod-bucket",
    tag: "critical",
    created_at: "2024-01-10T10:00:00Z",
    created_by: "dev@localhost",
  },
  {
    bucket_name: "backup-bucket",
    tag: "backup",
    created_at: "2024-02-01T10:00:00Z",
    created_by: "dev@localhost",
  },
  {
    bucket_name: "media-bucket",
    tag: "media",
    created_at: "2024-02-15T10:00:00Z",
    created_by: "dev@localhost",
  },
];

// ============================================
// Route Handler
// ============================================

export async function handleTagRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null,
): Promise<Response | null> {
  const path = url.pathname;
  const skipCache = url.searchParams.get("skipCache") === "true";

  logInfo(`[Tags] ${request.method} ${path}`, {
    module: "tags",
    operation: "route",
  });

  // GET /api/tags - List all unique tags with bucket counts
  if (path === "/api/tags" && request.method === "GET") {
    return getAllTags(env, corsHeaders, isLocalDev, skipCache);
  }

  // GET /api/tags/search - Search buckets by tags
  if (path === "/api/tags/search" && request.method === "GET") {
    return searchByTags(url, env, corsHeaders, isLocalDev);
  }

  // GET /api/tags/export - Export all tags
  if (path === "/api/tags/export" && request.method === "GET") {
    return exportTags(env, corsHeaders, isLocalDev);
  }

  // POST /api/tags/import - Import tags
  if (path === "/api/tags/import" && request.method === "POST") {
    return importTags(request, env, corsHeaders, isLocalDev, userEmail);
  }

  // GET /api/buckets/:bucketName/tags - Get tags for a bucket
  const getBucketTagsMatch = /^\/api\/buckets\/([^/]+)\/tags$/.exec(path);
  if (getBucketTagsMatch && request.method === "GET") {
    const bucketName = decodeURIComponent(getBucketTagsMatch[1] ?? "");
    if (bucketName)
      return getBucketTags(bucketName, env, corsHeaders, isLocalDev, skipCache);
  }

  // PUT /api/buckets/:bucketName/tags - Set all tags for a bucket (replaces existing)
  const setBucketTagsMatch = /^\/api\/buckets\/([^/]+)\/tags$/.exec(path);
  if (setBucketTagsMatch && request.method === "PUT") {
    const bucketName = decodeURIComponent(setBucketTagsMatch[1] ?? "");
    if (bucketName)
      return setBucketTags(
        bucketName,
        request,
        env,
        corsHeaders,
        isLocalDev,
        userEmail,
      );
  }

  // POST /api/buckets/:bucketName/tags - Add a tag to a bucket
  const addTagMatch = /^\/api\/buckets\/([^/]+)\/tags$/.exec(path);
  if (addTagMatch && request.method === "POST") {
    const bucketName = decodeURIComponent(addTagMatch[1] ?? "");
    if (bucketName)
      return addBucketTag(
        bucketName,
        request,
        env,
        corsHeaders,
        isLocalDev,
        userEmail,
      );
  }

  // DELETE /api/buckets/:bucketName/tags/:tag - Remove a tag from a bucket
  const deleteTagMatch = /^\/api\/buckets\/([^/]+)\/tags\/([^/]+)$/.exec(path);
  if (deleteTagMatch && request.method === "DELETE") {
    const bucketName = decodeURIComponent(deleteTagMatch[1] ?? "");
    const tag = decodeURIComponent(deleteTagMatch[2] ?? "");
    if (bucketName && tag)
      return removeBucketTag(bucketName, tag, env, corsHeaders, isLocalDev);
  }

  return null;
}

// ============================================
// Endpoint Handlers
// ============================================

// Get all unique tags with bucket counts
async function getAllTags(
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  skipCache: boolean,
): Promise<Response> {
  // Check cache first
  if (!skipCache && allTagsCache.data && isCacheValid(allTagsCache.timestamp)) {
    logInfo("Returning cached all tags", {
      module: "tags",
      operation: "get_all_tags",
    });
    return jsonResponse({ tags: allTagsCache.data }, corsHeaders);
  }

  if (isLocalDev) {
    const tagCounts = new Map<string, number>();
    for (const t of MOCK_TAGS) {
      tagCounts.set(t.tag, (tagCounts.get(t.tag) ?? 0) + 1);
    }
    const tags: TagSummary[] = Array.from(tagCounts.entries()).map(
      ([tag, count]) => ({
        tag,
        bucket_count: count,
      }),
    );
    return jsonResponse({ tags }, corsHeaders);
  }

  if (!env.METADATA) {
    return errorResponse(
      "Database not configured",
      "TAG_DB_NOT_CONFIGURED",
      corsHeaders,
      500,
    );
  }

  try {
    const result = await env.METADATA.prepare(
      `
      SELECT tag, COUNT(DISTINCT bucket_name) as bucket_count
      FROM bucket_tags
      GROUP BY tag
      ORDER BY bucket_count DESC, tag ASC
    `,
    ).all<{ tag: string; bucket_count: number }>();

    const tags: TagSummary[] = result.results;

    // Update cache
    allTagsCache.data = tags;
    allTagsCache.timestamp = Date.now();

    logInfo(`Retrieved ${tags.length} unique tags`, {
      module: "tags",
      operation: "get_all_tags",
    });
    return jsonResponse({ tags }, corsHeaders);
  } catch (error) {
    await logError(
      env,
      error instanceof Error ? error : String(error),
      { module: "tags", operation: "get_all_tags" },
      isLocalDev,
    );
    return errorResponse(
      "Failed to retrieve tags",
      "TAG_LIST_FAILED",
      corsHeaders,
      500,
    );
  }
}

// Get tags for a specific bucket
async function getBucketTags(
  bucketName: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  skipCache: boolean,
): Promise<Response> {
  // Check cache first
  const cached = bucketTagsCache.get(bucketName);
  if (!skipCache && cached && isCacheValid(cached.timestamp)) {
    logInfo(`Returning cached tags for ${bucketName}`, {
      module: "tags",
      operation: "get_bucket_tags",
    });
    return jsonResponse(
      { bucket_name: bucketName, tags: cached.data },
      corsHeaders,
    );
  }

  if (isLocalDev) {
    const tags = MOCK_TAGS.filter((t) => t.bucket_name === bucketName).map(
      (t) => t.tag,
    );
    return jsonResponse({ bucket_name: bucketName, tags }, corsHeaders);
  }

  if (!env.METADATA) {
    return errorResponse(
      "Database not configured",
      "TAG_DB_NOT_CONFIGURED",
      corsHeaders,
      500,
    );
  }

  try {
    const result = await env.METADATA.prepare(
      `
      SELECT tag FROM bucket_tags
      WHERE bucket_name = ?
      ORDER BY tag ASC
    `,
    )
      .bind(bucketName)
      .all<{ tag: string }>();

    const tags = result.results.map((r) => r.tag);

    // Update cache
    bucketTagsCache.set(bucketName, { data: tags, timestamp: Date.now() });

    logInfo(`Retrieved ${tags.length} tags for bucket ${bucketName}`, {
      module: "tags",
      operation: "get_bucket_tags",
      bucketName,
    });
    return jsonResponse({ bucket_name: bucketName, tags }, corsHeaders);
  } catch (error) {
    await logError(
      env,
      error instanceof Error ? error : String(error),
      { module: "tags", operation: "get_bucket_tags", bucketName },
      isLocalDev,
    );
    return errorResponse(
      "Failed to retrieve bucket tags",
      "TAG_GET_FAILED",
      corsHeaders,
      500,
    );
  }
}

// Set all tags for a bucket (replaces existing)
async function setBucketTags(
  bucketName: string,
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null,
): Promise<Response> {
  const body = await parseJsonBody<{ tags: string[] }>(request);

  if (!body || !Array.isArray(body.tags)) {
    return errorResponse(
      "Invalid request body: expected { tags: string[] }",
      "TAG_INVALID_BODY",
      corsHeaders,
      400,
    );
  }

  // Validate all tags
  const normalizedTags: string[] = [];
  for (const tag of body.tags) {
    const validation = validateTag(tag);
    if (!validation.valid) {
      return errorResponse(
        `Invalid tag "${tag}": ${validation.error}`,
        "TAG_VALIDATION_FAILED",
        corsHeaders,
        400,
      );
    }
    normalizedTags.push(normalizeTag(tag));
  }

  // Remove duplicates
  const uniqueTags = [...new Set(normalizedTags)];

  if (isLocalDev) {
    return jsonResponse(
      { bucket_name: bucketName, tags: uniqueTags },
      corsHeaders,
    );
  }

  if (!env.METADATA) {
    return errorResponse(
      "Database not configured",
      "TAG_DB_NOT_CONFIGURED",
      corsHeaders,
      500,
    );
  }

  try {
    // Delete all existing tags for bucket
    await env.METADATA.prepare("DELETE FROM bucket_tags WHERE bucket_name = ?")
      .bind(bucketName)
      .run();

    // Insert new tags
    if (uniqueTags.length > 0) {
      const insertStmt = env.METADATA.prepare(
        "INSERT INTO bucket_tags (bucket_name, tag, created_by) VALUES (?, ?, ?)",
      );

      // Batch insert (max 10 at a time for performance)
      const batchSize = 10;
      for (let i = 0; i < uniqueTags.length; i += batchSize) {
        const batch = uniqueTags.slice(i, i + batchSize);
        await Promise.all(
          batch.map((tag) => insertStmt.bind(bucketName, tag, userEmail).run()),
        );
      }
    }

    // Invalidate caches
    invalidateAllTagsCache();
    invalidateBucketTagsCache(bucketName);

    logInfo(`Set ${uniqueTags.length} tags for bucket ${bucketName}`, {
      module: "tags",
      operation: "set_bucket_tags",
      bucketName,
    });
    return jsonResponse(
      { bucket_name: bucketName, tags: uniqueTags },
      corsHeaders,
    );
  } catch (error) {
    await logError(
      env,
      error instanceof Error ? error : String(error),
      { module: "tags", operation: "set_bucket_tags", bucketName },
      isLocalDev,
    );
    return errorResponse(
      "Failed to set bucket tags",
      "TAG_SET_FAILED",
      corsHeaders,
      500,
    );
  }
}

// Add a single tag to a bucket
async function addBucketTag(
  bucketName: string,
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null,
): Promise<Response> {
  const body = await parseJsonBody<{ tag: string }>(request);

  if (!body?.tag) {
    return errorResponse(
      "Invalid request body: expected { tag: string }",
      "TAG_INVALID_BODY",
      corsHeaders,
      400,
    );
  }

  const validation = validateTag(body.tag);
  if (!validation.valid) {
    return errorResponse(
      `Invalid tag: ${validation.error}`,
      "TAG_VALIDATION_FAILED",
      corsHeaders,
      400,
    );
  }

  const normalizedTag = normalizeTag(body.tag);

  if (isLocalDev) {
    return jsonResponse(
      { bucket_name: bucketName, tag: normalizedTag, success: true },
      corsHeaders,
      201,
    );
  }

  if (!env.METADATA) {
    return errorResponse(
      "Database not configured",
      "TAG_DB_NOT_CONFIGURED",
      corsHeaders,
      500,
    );
  }

  try {
    await env.METADATA.prepare(
      "INSERT OR IGNORE INTO bucket_tags (bucket_name, tag, created_by) VALUES (?, ?, ?)",
    )
      .bind(bucketName, normalizedTag, userEmail)
      .run();

    // Invalidate caches
    invalidateAllTagsCache();
    invalidateBucketTagsCache(bucketName);

    logInfo(`Added tag "${normalizedTag}" to bucket ${bucketName}`, {
      module: "tags",
      operation: "add_bucket_tag",
      bucketName,
    });
    return jsonResponse(
      { bucket_name: bucketName, tag: normalizedTag, success: true },
      corsHeaders,
      201,
    );
  } catch (error) {
    await logError(
      env,
      error instanceof Error ? error : String(error),
      { module: "tags", operation: "add_bucket_tag", bucketName },
      isLocalDev,
    );
    return errorResponse(
      "Failed to add tag",
      "TAG_ADD_FAILED",
      corsHeaders,
      500,
    );
  }
}

// Remove a tag from a bucket
async function removeBucketTag(
  bucketName: string,
  tag: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
): Promise<Response> {
  const normalizedTag = normalizeTag(tag);

  if (isLocalDev) {
    return jsonResponse({ success: true }, corsHeaders);
  }

  if (!env.METADATA) {
    return errorResponse(
      "Database not configured",
      "TAG_DB_NOT_CONFIGURED",
      corsHeaders,
      500,
    );
  }

  try {
    const result = await env.METADATA.prepare(
      "DELETE FROM bucket_tags WHERE bucket_name = ? AND tag = ?",
    )
      .bind(bucketName, normalizedTag)
      .run();

    if (result.meta.changes === 0) {
      return errorResponse("Tag not found", "TAG_NOT_FOUND", corsHeaders, 404);
    }

    // Invalidate caches
    invalidateAllTagsCache();
    invalidateBucketTagsCache(bucketName);

    logInfo(`Removed tag "${normalizedTag}" from bucket ${bucketName}`, {
      module: "tags",
      operation: "remove_bucket_tag",
      bucketName,
    });
    return jsonResponse({ success: true }, corsHeaders);
  } catch (error) {
    await logError(
      env,
      error instanceof Error ? error : String(error),
      { module: "tags", operation: "remove_bucket_tag", bucketName },
      isLocalDev,
    );
    return errorResponse(
      "Failed to remove tag",
      "TAG_DELETE_FAILED",
      corsHeaders,
      500,
    );
  }
}

// Search buckets by tags
async function searchByTags(
  url: URL,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
): Promise<Response> {
  const tagsParam = url.searchParams.get("tags");
  const matchAll = url.searchParams.get("matchAll") === "true";

  if (!tagsParam) {
    return errorResponse(
      "Missing required parameter: tags",
      "TAG_MISSING_PARAM",
      corsHeaders,
      400,
    );
  }

  const tags = tagsParam
    .split(",")
    .map((t) => normalizeTag(t))
    .filter((t) => t.length > 0);

  if (tags.length === 0) {
    return errorResponse(
      "At least one tag is required",
      "TAG_EMPTY_SEARCH",
      corsHeaders,
      400,
    );
  }

  if (isLocalDev) {
    const bucketTags = new Map<string, string[]>();
    for (const t of MOCK_TAGS) {
      const existing = bucketTags.get(t.bucket_name) ?? [];
      existing.push(t.tag);
      bucketTags.set(t.bucket_name, existing);
    }

    const results: TagSearchResult[] = [];
    for (const [bucket, bTags] of bucketTags) {
      const matches = matchAll
        ? tags.every((t) => bTags.includes(t))
        : tags.some((t) => bTags.includes(t));
      if (matches) {
        results.push({ bucket_name: bucket, tags: bTags });
      }
    }

    return jsonResponse({ results, matchAll, searchTags: tags }, corsHeaders);
  }

  if (!env.METADATA) {
    return errorResponse(
      "Database not configured",
      "TAG_DB_NOT_CONFIGURED",
      corsHeaders,
      500,
    );
  }

  try {
    // Build query based on match mode
    let query: string;
    const placeholders = tags.map(() => "?").join(", ");

    if (matchAll) {
      // Find buckets that have ALL specified tags
      query = `
        SELECT bucket_name, GROUP_CONCAT(tag) as tags
        FROM bucket_tags
        WHERE bucket_name IN (
          SELECT bucket_name
          FROM bucket_tags
          WHERE tag IN (${placeholders})
          GROUP BY bucket_name
          HAVING COUNT(DISTINCT tag) = ?
        )
        GROUP BY bucket_name
        ORDER BY bucket_name
      `;
    } else {
      // Find buckets that have ANY of the specified tags
      query = `
        SELECT bucket_name, GROUP_CONCAT(tag) as tags
        FROM bucket_tags
        WHERE bucket_name IN (
          SELECT DISTINCT bucket_name
          FROM bucket_tags
          WHERE tag IN (${placeholders})
        )
        GROUP BY bucket_name
        ORDER BY bucket_name
      `;
    }

    const stmt = env.METADATA.prepare(query);
    const boundStmt = matchAll
      ? stmt.bind(...tags, tags.length)
      : stmt.bind(...tags);

    const result = await boundStmt.all<{ bucket_name: string; tags: string }>();

    const results: TagSearchResult[] = result.results.map((r) => ({
      bucket_name: r.bucket_name,
      tags: r.tags.split(","),
    }));

    logInfo(`Tag search found ${results.length} buckets`, {
      module: "tags",
      operation: "search_by_tags",
      metadata: { tags, matchAll },
    });
    return jsonResponse({ results, matchAll, searchTags: tags }, corsHeaders);
  } catch (error) {
    await logError(
      env,
      error instanceof Error ? error : String(error),
      { module: "tags", operation: "search_by_tags" },
      isLocalDev,
    );
    return errorResponse(
      "Failed to search by tags",
      "TAG_SEARCH_FAILED",
      corsHeaders,
      500,
    );
  }
}

// Export all tags
async function exportTags(
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
): Promise<Response> {
  if (isLocalDev) {
    return jsonResponse({ tags: MOCK_TAGS }, corsHeaders);
  }

  if (!env.METADATA) {
    return errorResponse(
      "Database not configured",
      "TAG_DB_NOT_CONFIGURED",
      corsHeaders,
      500,
    );
  }

  try {
    const result = await env.METADATA.prepare(
      `
      SELECT bucket_name, tag, created_at, created_by
      FROM bucket_tags
      ORDER BY bucket_name, tag
    `,
    ).all<BucketTag>();

    logInfo(`Exported ${result.results.length} tags`, {
      module: "tags",
      operation: "export_tags",
    });
    return jsonResponse({ tags: result.results }, corsHeaders);
  } catch (error) {
    await logError(
      env,
      error instanceof Error ? error : String(error),
      { module: "tags", operation: "export_tags" },
      isLocalDev,
    );
    return errorResponse(
      "Failed to export tags",
      "TAG_EXPORT_FAILED",
      corsHeaders,
      500,
    );
  }
}

// Import tags
async function importTags(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null,
): Promise<Response> {
  const body = await parseJsonBody<{
    tags: { bucket_name: string; tag: string }[];
  }>(request);

  if (!body?.tags || !Array.isArray(body.tags)) {
    return errorResponse(
      "Invalid request body: expected { tags: [{ bucket_name, tag }] }",
      "TAG_INVALID_BODY",
      corsHeaders,
      400,
    );
  }

  if (isLocalDev) {
    return jsonResponse(
      { success: true, imported: body.tags.length },
      corsHeaders,
    );
  }

  if (!env.METADATA) {
    return errorResponse(
      "Database not configured",
      "TAG_DB_NOT_CONFIGURED",
      corsHeaders,
      500,
    );
  }

  try {
    let imported = 0;
    let skipped = 0;

    const insertStmt = env.METADATA.prepare(
      "INSERT OR IGNORE INTO bucket_tags (bucket_name, tag, created_by) VALUES (?, ?, ?)",
    );

    // Batch insert (max 10 at a time)
    const batchSize = 10;
    for (let i = 0; i < body.tags.length; i += batchSize) {
      const batch = body.tags.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async ({ bucket_name, tag }) => {
          const validation = validateTag(tag);
          if (!validation.valid) {
            return { success: false };
          }
          const normalizedTag = normalizeTag(tag);
          const result = await insertStmt
            .bind(bucket_name, normalizedTag, userEmail)
            .run();
          return { success: Boolean(result.meta.changes) };
        }),
      );

      for (const r of results) {
        if (r.success) imported++;
        else skipped++;
      }
    }

    // Invalidate all caches
    invalidateAllTagsCache();
    bucketTagsCache.clear();

    logInfo(`Imported ${imported} tags (${skipped} skipped)`, {
      module: "tags",
      operation: "import_tags",
    });
    return jsonResponse({ success: true, imported, skipped }, corsHeaders);
  } catch (error) {
    await logError(
      env,
      error instanceof Error ? error : String(error),
      { module: "tags", operation: "import_tags" },
      isLocalDev,
    );
    return errorResponse(
      "Failed to import tags",
      "TAG_IMPORT_FAILED",
      corsHeaders,
      500,
    );
  }
}
