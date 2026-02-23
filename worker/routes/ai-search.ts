import type {
  Env,
  CloudflareApiResponse,
  R2ObjectInfo,
  AISearchCompatibility,
  AISearchFileInfo,
  AISearchInstance,
  AISearchInstancesListResult,
  AISearchQueryRequest,
  AISearchResponse,
  CreateAISearchBody,
  AISearchSyncResponse,
  SupportedFileType,
  SupportedFileTypesResponse,
  AISearchIndexingJob,
  AISearchInstanceStatus,
} from "../types";
import { CF_API } from "../types";
import { type CorsHeaders } from "../utils/cors";
import { getCloudflareHeaders } from "../utils/helpers";
import { logInfo, logError, logWarning } from "../utils/error-logger";

// Cache for supported file types (5-minute TTL per Cloudflare Manager Rules)
interface SupportedTypesCache {
  types: SupportedFileType[];
  timestamp: number;
}
const supportedTypesCache: SupportedTypesCache = { types: [], timestamp: 0 };
const SUPPORTED_TYPES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// AI Search supported file extensions and size limits (per Cloudflare docs)
const AI_SEARCH_SUPPORTED_EXTENSIONS: Record<
  string,
  { maxSize: number; mimeType: string }
> = {
  // Plain text files
  ".txt": { maxSize: 4 * 1024 * 1024, mimeType: "text/plain" },
  ".rst": { maxSize: 4 * 1024 * 1024, mimeType: "text/plain" },
  ".log": { maxSize: 4 * 1024 * 1024, mimeType: "text/plain" },
  ".ini": { maxSize: 4 * 1024 * 1024, mimeType: "text/plain" },
  ".conf": { maxSize: 4 * 1024 * 1024, mimeType: "text/plain" },
  ".env": { maxSize: 4 * 1024 * 1024, mimeType: "text/plain" },
  ".properties": { maxSize: 4 * 1024 * 1024, mimeType: "text/plain" },
  ".gitignore": { maxSize: 4 * 1024 * 1024, mimeType: "text/plain" },
  ".editorconfig": { maxSize: 4 * 1024 * 1024, mimeType: "text/plain" },
  ".toml": { maxSize: 4 * 1024 * 1024, mimeType: "text/toml" },
  // Markdown
  ".md": { maxSize: 4 * 1024 * 1024, mimeType: "text/markdown" },
  ".mdx": { maxSize: 4 * 1024 * 1024, mimeType: "text/markdown" },
  ".markdown": { maxSize: 4 * 1024 * 1024, mimeType: "text/markdown" },
  // LaTeX
  ".tex": { maxSize: 4 * 1024 * 1024, mimeType: "application/x-tex" },
  ".latex": { maxSize: 4 * 1024 * 1024, mimeType: "application/x-latex" },
  // Scripts
  ".sh": { maxSize: 4 * 1024 * 1024, mimeType: "application/x-sh" },
  ".bat": { maxSize: 4 * 1024 * 1024, mimeType: "application/x-msdos-batch" },
  ".ps1": { maxSize: 4 * 1024 * 1024, mimeType: "text/x-powershell" },
  // SGML
  ".sgml": { maxSize: 4 * 1024 * 1024, mimeType: "text/sgml" },
  // Data formats
  ".json": { maxSize: 4 * 1024 * 1024, mimeType: "application/json" },
  ".yaml": { maxSize: 4 * 1024 * 1024, mimeType: "application/x-yaml" },
  ".yml": { maxSize: 4 * 1024 * 1024, mimeType: "application/x-yaml" },
  // HTML
  ".html": { maxSize: 4 * 1024 * 1024, mimeType: "text/html" },
  ".htm": { maxSize: 4 * 1024 * 1024, mimeType: "text/html" },
  // Code files (commonly indexed)
  ".js": { maxSize: 4 * 1024 * 1024, mimeType: "text/javascript" },
  ".ts": { maxSize: 4 * 1024 * 1024, mimeType: "text/typescript" },
  ".jsx": { maxSize: 4 * 1024 * 1024, mimeType: "text/javascript" },
  ".tsx": { maxSize: 4 * 1024 * 1024, mimeType: "text/typescript" },
  ".py": { maxSize: 4 * 1024 * 1024, mimeType: "text/x-python" },
  ".css": { maxSize: 4 * 1024 * 1024, mimeType: "text/css" },
  ".xml": { maxSize: 4 * 1024 * 1024, mimeType: "application/xml" },
  // Document formats (added per Cloudflare October 2025 update)
  ".pdf": { maxSize: 4 * 1024 * 1024, mimeType: "application/pdf" },
  ".docx": {
    maxSize: 4 * 1024 * 1024,
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  ".odt": {
    maxSize: 4 * 1024 * 1024,
    mimeType: "application/vnd.oasis.opendocument.text",
  },
  // Image formats (added per Cloudflare October 2025 update)
  ".jpeg": { maxSize: 4 * 1024 * 1024, mimeType: "image/jpeg" },
  ".jpg": { maxSize: 4 * 1024 * 1024, mimeType: "image/jpeg" },
  ".png": { maxSize: 4 * 1024 * 1024, mimeType: "image/png" },
  ".webp": { maxSize: 4 * 1024 * 1024, mimeType: "image/webp" },
};

function getFileExtension(key: string): string {
  const lastDotIndex = key.lastIndexOf(".");
  if (lastDotIndex === -1) return "";
  return key.slice(lastDotIndex).toLowerCase();
}

function isFileIndexable(
  key: string,
  size: number,
): { indexable: boolean; reason?: string } {
  const ext = getFileExtension(key);

  if (!ext) {
    return { indexable: false, reason: "No file extension" };
  }

  const config = AI_SEARCH_SUPPORTED_EXTENSIONS[ext];
  if (!config) {
    return { indexable: false, reason: `Unsupported extension: ${ext}` };
  }

  if (size > config.maxSize) {
    return {
      indexable: false,
      reason: `File size ${(size / 1024 / 1024).toFixed(2)}MB exceeds limit of ${config.maxSize / 1024 / 1024}MB`,
    };
  }

  return { indexable: true };
}

export async function handleAISearchRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
): Promise<Response> {
  logInfo("Handling AI Search operation", {
    module: "ai_search",
    operation: "handle_request",
  });

  const cfHeaders = getCloudflareHeaders(env);

  try {
    // GET /api/ai-search/compatibility/:bucketName - Analyze bucket for AI Search compatibility
    const compatibilityRegex = /^\/api\/ai-search\/compatibility\/([^/]+)$/;
    const compatibilityMatch = compatibilityRegex.exec(url.pathname);
    if (request.method === "GET" && compatibilityMatch?.[1] !== undefined) {
      const bucketName = decodeURIComponent(compatibilityMatch[1]);
      logInfo("Checking compatibility for bucket", {
        module: "ai_search",
        operation: "check_compatibility",
        bucketName,
      });

      if (isLocalDev) {
        // Return mock data for local development
        const mockResponse: AISearchCompatibility = {
          bucketName,
          totalFiles: 10,
          indexableFiles: 7,
          nonIndexableFiles: 3,
          totalSize: 5 * 1024 * 1024,
          indexableSize: 3 * 1024 * 1024,
          files: {
            indexable: [
              { key: "readme.md", size: 1024, extension: ".md" },
              { key: "config.json", size: 512, extension: ".json" },
            ],
            nonIndexable: [
              {
                key: "image.png",
                size: 1024 * 1024,
                extension: ".png",
                reason: "Unsupported extension: .png",
              },
            ],
          },
          supportedExtensions: Object.keys(AI_SEARCH_SUPPORTED_EXTENSIONS),
        };
        return new Response(JSON.stringify(mockResponse), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Fetch all files from the bucket
      const allFiles: R2ObjectInfo[] = [];
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const listUrl = new URL(
          `${CF_API}/accounts/${env.ACCOUNT_ID}/r2/buckets/${bucketName}/objects`,
        );
        if (cursor) {
          listUrl.searchParams.set("cursor", cursor);
        }
        listUrl.searchParams.set("per_page", "100");

        const listResponse = await fetch(listUrl.toString(), {
          headers: cfHeaders,
        });
        if (!listResponse.ok) {
          throw new Error(`Failed to list objects: ${listResponse.status}`);
        }

        const listData = (await listResponse.json()) as CloudflareApiResponse<
          R2ObjectInfo[]
        >;
        const objects: R2ObjectInfo[] = Array.isArray(listData.result)
          ? listData.result
          : [];
        allFiles.push(...objects);

        cursor = listData.result_info?.cursor;
        hasMore = Boolean(cursor) && objects.length > 0;
      }

      // Analyze files for AI Search compatibility
      const indexableFiles: AISearchFileInfo[] = [];
      const nonIndexableFiles: AISearchFileInfo[] = [];
      let indexableSize = 0;
      let totalSize = 0;

      for (const file of allFiles) {
        // Skip folders (keys ending with /)
        if (file.key.endsWith("/")) continue;

        totalSize += file.size;
        const ext = getFileExtension(file.key);
        const { indexable, reason } = isFileIndexable(file.key, file.size);

        if (indexable) {
          indexableFiles.push({
            key: file.key,
            size: file.size,
            extension: ext,
          });
          indexableSize += file.size;
        } else {
          const fileInfo: AISearchFileInfo = {
            key: file.key,
            size: file.size,
            extension: ext,
          };
          if (reason !== undefined) {
            fileInfo.reason = reason;
          }
          nonIndexableFiles.push(fileInfo);
        }
      }

      const response: AISearchCompatibility = {
        bucketName,
        totalFiles: indexableFiles.length + nonIndexableFiles.length,
        indexableFiles: indexableFiles.length,
        nonIndexableFiles: nonIndexableFiles.length,
        totalSize,
        indexableSize,
        files: {
          indexable: indexableFiles.slice(0, 100), // Limit to first 100 for response size
          nonIndexable: nonIndexableFiles.slice(0, 100),
        },
        supportedExtensions: Object.keys(AI_SEARCH_SUPPORTED_EXTENSIONS),
      };

      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // GET /api/ai-search/instances - List all AI Search instances
    if (
      request.method === "GET" &&
      url.pathname === "/api/ai-search/instances"
    ) {
      logInfo("Listing AI Search instances", {
        module: "ai_search",
        operation: "list_instances",
      });

      if (isLocalDev) {
        const mockInstances: AISearchInstance[] = [
          {
            name: "dev-rag",
            description: "Development RAG instance",
            created_at: new Date().toISOString(),
            status: "active",
            data_source: { type: "r2", bucket_name: "dev-bucket" },
          },
        ];
        return new Response(JSON.stringify({ instances: mockInstances }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Try to fetch AI Search instances from Cloudflare API
      try {
        const apiUrl = `${CF_API}/accounts/${env.ACCOUNT_ID}/autorag/rags`;
        logInfo("Fetching AI Search instances", {
          module: "ai_search",
          operation: "list_instances",
          metadata: { apiUrl },
        });

        const response = await fetch(apiUrl, { headers: cfHeaders });

        const responseText = await response.text();
        logInfo("AI Search API response", {
          module: "ai_search",
          operation: "list_instances",
          metadata: {
            status: response.status,
            body: responseText.substring(0, 500),
          },
        });

        if (!response.ok) {
          // API might not be available or require different permissions
          logWarning("Failed to list instances", {
            module: "ai_search",
            operation: "list_instances",
            metadata: { status: response.status, body: responseText },
          });
          return new Response(
            JSON.stringify({
              instances: [],
              error: `AI Search API returned ${response.status}. Ensure API key has 'AI Search - Read' permission.`,
              dashboardUrl: `https://dash.cloudflare.com/?to=/:account/ai/ai-search`,
            }),
            {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }

        const data = JSON.parse(responseText) as CloudflareApiResponse<
          AISearchInstance[] | AISearchInstancesListResult
        >;

        // Handle both response formats: array directly or { rags: [...] }
        let instances: AISearchInstance[];
        if (Array.isArray(data.result)) {
          instances = data.result;
        } else {
          instances = data.result?.rags ?? [];
        }

        logInfo("Found AI Search instances", {
          module: "ai_search",
          operation: "list_instances",
          metadata: {
            count: instances.length,
            names: instances.map((i) => i.name ?? i.id),
          },
        });

        return new Response(
          JSON.stringify({
            instances,
          }),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      } catch (err) {
        await logError(
          env,
          err instanceof Error ? err : String(err),
          { module: "ai_search", operation: "list_instances" },
          isLocalDev,
        );
        return new Response(
          JSON.stringify({
            instances: [],
            error: "Failed to fetch AI Search instances",
          }),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
    }

    // POST /api/ai-search/instances - Create a new AI Search instance
    if (
      request.method === "POST" &&
      url.pathname === "/api/ai-search/instances"
    ) {
      const body = (await request.json()) as CreateAISearchBody;
      logInfo("Creating AI Search instance", {
        module: "ai_search",
        operation: "create_instance",
        metadata: { instanceName: body.name },
      });

      if (isLocalDev) {
        return new Response(
          JSON.stringify({
            success: true,
            instance: {
              name: body.name,
              status: "indexing",
              data_source: { type: "r2", bucket_name: body.bucketName },
            },
          }),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      // Try to create AI Search instance via API
      try {
        const response = await fetch(
          `${CF_API}/accounts/${env.ACCOUNT_ID}/autorag/rags`,
          {
            method: "POST",
            headers: cfHeaders,
            body: JSON.stringify({
              name: body.name,
              description: body.description,
              source: {
                type: "r2",
                r2_bucket: body.bucketName,
              },
              embedding_model:
                body.embeddingModel ?? "@cf/baai/bge-base-en-v1.5",
              generation_model:
                body.generationModel ?? "@cf/meta/llama-3.1-8b-instruct",
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          await logError(
            env,
            new Error(errorText),
            {
              module: "ai_search",
              operation: "create_instance",
              metadata: { status: response.status },
            },
            isLocalDev,
          );
          return new Response(
            JSON.stringify({
              success: false,
              error:
                "Failed to create AI Search instance. Use Cloudflare Dashboard instead.",
              dashboardUrl: `https://dash.cloudflare.com/?to=/:account/ai/ai-search`,
            }),
            {
              status: response.status,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }

        const data =
          (await response.json()) as CloudflareApiResponse<AISearchInstance>;
        return new Response(
          JSON.stringify({
            success: true,
            instance: data.result,
          }),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      } catch (err) {
        await logError(
          env,
          err instanceof Error ? err : String(err),
          { module: "ai_search", operation: "create_instance" },
          isLocalDev,
        );
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to create AI Search instance",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
    }

    // DELETE /api/ai-search/instances/:instanceName - Delete an AI Search instance
    const deleteRegex = /^\/api\/ai-search\/instances\/([^/]+)$/;
    const deleteMatch = deleteRegex.exec(url.pathname);
    if (request.method === "DELETE" && deleteMatch?.[1] !== undefined) {
      const instanceName = decodeURIComponent(deleteMatch[1]);
      logInfo("Deleting AI Search instance", {
        module: "ai_search",
        operation: "delete_instance",
        metadata: { instanceName },
      });

      if (isLocalDev) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      try {
        const response = await fetch(
          `${CF_API}/accounts/${env.ACCOUNT_ID}/autorag/rags/${instanceName}`,
          { method: "DELETE", headers: cfHeaders },
        );

        if (!response.ok) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Failed to delete AI Search instance",
            }),
            {
              status: response.status,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (err) {
        await logError(
          env,
          err instanceof Error ? err : String(err),
          { module: "ai_search", operation: "delete_instance" },
          isLocalDev,
        );
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to delete AI Search instance",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
    }

    // POST /api/ai-search/instances/:instanceName/sync - Trigger sync for an instance
    const syncRegex = /^\/api\/ai-search\/instances\/([^/]+)\/sync$/;
    const syncMatch = syncRegex.exec(url.pathname);
    if (request.method === "POST" && syncMatch?.[1] !== undefined) {
      const instanceName = decodeURIComponent(syncMatch[1]);
      logInfo("Triggering sync for instance", {
        module: "ai_search",
        operation: "trigger_sync",
        metadata: { instanceName },
      });

      if (isLocalDev) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Sync triggered successfully",
            job_id: "mock-job-id-123",
          } as AISearchSyncResponse),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      try {
        const syncUrl = `${CF_API}/accounts/${env.ACCOUNT_ID}/autorag/rags/${instanceName}/sync`;

        const response = await fetch(syncUrl, {
          method: "PATCH",
          headers: cfHeaders,
        });

        const responseText = await response.text();

        if (!response.ok) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Sync failed: ${response.status} - ${responseText}`,
            }),
            {
              status: response.status,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }

        const data = JSON.parse(
          responseText,
        ) as CloudflareApiResponse<AISearchSyncResponse>;

        return new Response(
          JSON.stringify({
            success: true,
            message: "Sync triggered successfully",
            job_id: data.result?.job_id,
          }),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      } catch (err) {
        await logError(
          env,
          err instanceof Error ? err : String(err),
          { module: "ai_search", operation: "trigger_sync" },
          isLocalDev,
        );
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to trigger sync",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
    }

    // POST /api/ai-search/:instanceName/search - Semantic search
    const searchRegex = /^\/api\/ai-search\/([^/]+)\/search$/;
    const searchMatch = searchRegex.exec(url.pathname);
    if (request.method === "POST" && searchMatch?.[1] !== undefined) {
      const instanceName = decodeURIComponent(searchMatch[1]);
      const body = (await request.json()) as AISearchQueryRequest;
      logInfo("Search query for instance", {
        module: "ai_search",
        operation: "search",
        metadata: { instanceName },
      });

      if (isLocalDev) {
        const mockResponse: AISearchResponse = {
          data: [
            {
              file_id: "mock-1",
              filename: "example.md",
              score: 0.85,
              content: [
                {
                  id: "1",
                  type: "text",
                  text: "This is a mock search result.",
                },
              ],
            },
          ],
          has_more: false,
          next_page: null,
        };
        return new Response(JSON.stringify(mockResponse), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Use AI binding if available, otherwise fall back to REST API
      if (env.AI) {
        try {
          // Build search params, only including optional fields if defined
          const searchParams: {
            query: string;
            rewrite_query: boolean;
            max_num_results: number;
            ranking_options?: { score_threshold: number };
            reranking?: { enabled: boolean; model?: string };
          } = {
            query: body.query,
            rewrite_query: body.rewrite_query ?? false,
            max_num_results: body.max_num_results ?? 10,
          };

          if (body.score_threshold !== undefined) {
            searchParams.ranking_options = {
              score_threshold: body.score_threshold,
            };
          }
          if (body.reranking !== undefined) {
            searchParams.reranking = body.reranking;
          }

          // TODO: Migrate autorag → env.AI.aiSearch (Cloudflare API rename)
          const result =
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            await env.AI.autorag(instanceName).search(searchParams);

          return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        } catch (err) {
          await logError(
            env,
            err instanceof Error ? err : String(err),
            { module: "ai_search", operation: "search" },
            isLocalDev,
          );
          return new Response(
            JSON.stringify({
              error: "Search failed",
              details: err instanceof Error ? err.message : "Unknown error",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }
      } else {
        // Fall back to REST API (no AI binding available)
        try {
          const searchUrl = `${CF_API}/accounts/${env.ACCOUNT_ID}/autorag/rags/${instanceName}/search`;
          const response = await fetch(searchUrl, {
            method: "POST",
            headers: { ...cfHeaders, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          const responseText = await response.text();

          const cfResponse = JSON.parse(responseText) as {
            success: boolean;
            result?: AISearchResponse;
            errors?: unknown[];
          };

          // Transform Cloudflare response format to match frontend expectations
          // Cloudflare returns: { success: true, result: { data, ... } }
          // Frontend expects: { data, ... }
          const data = cfResponse.result ?? {
            error: "Empty response from Search",
          };

          return new Response(JSON.stringify(data), {
            status: response.status,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        } catch (err) {
          await logError(
            env,
            err instanceof Error ? err : String(err),
            { module: "ai_search", operation: "search" },
            isLocalDev,
          );
          return new Response(
            JSON.stringify({
              error: "Search failed",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }
      }
    }

    // POST /api/ai-search/:instanceName/ai-search - AI-powered search with generated response
    const aiSearchRegex = /^\/api\/ai-search\/([^/]+)\/ai-search$/;
    const aiSearchMatch = aiSearchRegex.exec(url.pathname);
    if (request.method === "POST" && aiSearchMatch?.[1] !== undefined) {
      const instanceName = decodeURIComponent(aiSearchMatch[1]);
      const body = (await request.json()) as AISearchQueryRequest;
      logInfo("AI Search query for instance", {
        module: "ai_search",
        operation: "ai_search",
        metadata: { instanceName },
      });

      if (isLocalDev) {
        const mockResponse: AISearchResponse = {
          response: "This is a mock AI-generated response based on your query.",
          data: [
            {
              file_id: "mock-1",
              filename: "example.md",
              score: 0.85,
              content: [
                {
                  id: "1",
                  type: "text",
                  text: "This is a mock search result.",
                },
              ],
            },
          ],
          has_more: false,
          next_page: null,
        };
        return new Response(JSON.stringify(mockResponse), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Use AI binding if available
      if (env.AI) {
        try {
          // Handle streaming vs non-streaming separately due to TypeScript requirements
          if (body.stream === true) {
            // Streaming request - returns a Response directly
            const streamParams: {
              query: string;
              rewrite_query: boolean;
              max_num_results: number;
              stream: true;
              ranking_options?: { score_threshold: number };
              reranking?: { enabled: boolean; model?: string };
            } = {
              query: body.query,
              rewrite_query: body.rewrite_query ?? false,
              max_num_results: body.max_num_results ?? 10,
              stream: true,
            };

            if (body.score_threshold !== undefined) {
              streamParams.ranking_options = {
                score_threshold: body.score_threshold,
              };
            }
            if (body.reranking !== undefined) {
              streamParams.reranking = body.reranking;
            }

            // TODO: Migrate autorag → env.AI.aiSearch (Cloudflare API rename)
            const streamResult =
              // eslint-disable-next-line @typescript-eslint/no-deprecated
              await env.AI.autorag(instanceName).aiSearch(streamParams);

            // The streaming response returns a Response object
            return new Response(streamResult.body, {
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                ...corsHeaders,
              },
            });
          } else {
            // Non-streaming request
            const searchParams: {
              query: string;
              rewrite_query: boolean;
              max_num_results: number;
              ranking_options?: { score_threshold: number };
              reranking?: { enabled: boolean; model?: string };
            } = {
              query: body.query,
              rewrite_query: body.rewrite_query ?? false,
              max_num_results: body.max_num_results ?? 10,
            };

            if (body.score_threshold !== undefined) {
              searchParams.ranking_options = {
                score_threshold: body.score_threshold,
              };
            }
            if (body.reranking !== undefined) {
              searchParams.reranking = body.reranking;
            }

            // TODO: Migrate autorag → env.AI.aiSearch (Cloudflare API rename)
            const result =
              // eslint-disable-next-line @typescript-eslint/no-deprecated
              await env.AI.autorag(instanceName).aiSearch(searchParams);

            return new Response(JSON.stringify(result), {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }
        } catch (err) {
          await logError(
            env,
            err instanceof Error ? err : String(err),
            { module: "ai_search", operation: "ai_search" },
            isLocalDev,
          );
          return new Response(
            JSON.stringify({
              error: "AI Search failed",
              details: err instanceof Error ? err.message : "Unknown error",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }
      } else {
        // Fall back to REST API (no AI binding available)
        try {
          const aiSearchUrl = `${CF_API}/accounts/${env.ACCOUNT_ID}/autorag/rags/${instanceName}/ai-search`;
          const response = await fetch(aiSearchUrl, {
            method: "POST",
            headers: { ...cfHeaders, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          const responseText = await response.text();

          const cfResponse = JSON.parse(responseText) as {
            success: boolean;
            result?: AISearchResponse;
            errors?: unknown[];
          };

          // Transform Cloudflare response format to match frontend expectations
          // Cloudflare returns: { success: true, result: { response, data, ... } }
          // Frontend expects: { response, data, ... }
          const data = cfResponse.result ?? {
            error: "Empty response from AI Search",
          };

          return new Response(JSON.stringify(data), {
            status: response.status,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        } catch (err) {
          await logError(
            env,
            err instanceof Error ? err : String(err),
            { module: "ai_search", operation: "ai_search" },
            isLocalDev,
          );
          return new Response(
            JSON.stringify({
              error: "AI Search failed",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }
      }
    }

    // GET /api/ai-search/supported-types - Get supported file types from Cloudflare toMarkdown API
    if (
      request.method === "GET" &&
      url.pathname === "/api/ai-search/supported-types"
    ) {
      logInfo("Fetching supported file types", {
        module: "ai_search",
        operation: "get_supported_types",
      });
      const skipCache = url.searchParams.get("skipCache") === "true";

      // Check cache first (5-min TTL)
      const now = Date.now();
      if (
        !skipCache &&
        supportedTypesCache.types.length > 0 &&
        now - supportedTypesCache.timestamp < SUPPORTED_TYPES_CACHE_TTL
      ) {
        const response: SupportedFileTypesResponse = {
          types: supportedTypesCache.types,
          cached: true,
          fetchedAt: new Date(supportedTypesCache.timestamp).toISOString(),
        };
        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (isLocalDev) {
        // Return mock data for local development
        const mockTypes: SupportedFileType[] = [
          { extension: ".pdf", mimeType: "application/pdf" },
          {
            extension: ".docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
          {
            extension: ".odt",
            mimeType: "application/vnd.oasis.opendocument.text",
          },
          { extension: ".txt", mimeType: "text/plain" },
          { extension: ".md", mimeType: "text/markdown" },
          { extension: ".json", mimeType: "application/json" },
          { extension: ".html", mimeType: "text/html" },
          { extension: ".xml", mimeType: "application/xml" },
          { extension: ".yaml", mimeType: "application/x-yaml" },
          { extension: ".yml", mimeType: "application/x-yaml" },
          { extension: ".js", mimeType: "text/javascript" },
          { extension: ".ts", mimeType: "text/typescript" },
          { extension: ".py", mimeType: "text/x-python" },
          { extension: ".css", mimeType: "text/css" },
          { extension: ".jpeg", mimeType: "image/jpeg" },
          { extension: ".jpg", mimeType: "image/jpeg" },
          { extension: ".png", mimeType: "image/png" },
          { extension: ".webp", mimeType: "image/webp" },
        ];
        const response: SupportedFileTypesResponse = {
          types: mockTypes,
          cached: false,
          fetchedAt: new Date().toISOString(),
        };
        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Try AI binding first (toMarkdown().supported())
      if (env.AI) {
        try {
          const aiBinding = env.AI as unknown as {
            toMarkdown: () => { supported: () => Promise<SupportedFileType[]> };
          };
          if (typeof aiBinding.toMarkdown === "function") {
            const supportedTypes = await aiBinding.toMarkdown().supported();
            // Update cache
            supportedTypesCache.types = supportedTypes;
            supportedTypesCache.timestamp = now;

            const response: SupportedFileTypesResponse = {
              types: supportedTypes,
              cached: false,
              fetchedAt: new Date().toISOString(),
            };
            return new Response(JSON.stringify(response), {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }
        } catch (err) {
          logWarning(
            "toMarkdown binding not available, falling back to REST API",
            {
              module: "ai_search",
              operation: "get_supported_types",
              metadata: {
                error: err instanceof Error ? err.message : String(err),
              },
            },
          );
        }
      }

      // Fallback to REST API
      try {
        const response = await fetch(
          `${CF_API}/accounts/${env.ACCOUNT_ID}/ai/tomarkdown/supported`,
          { headers: cfHeaders },
        );

        if (response.ok) {
          const data = (await response.json()) as CloudflareApiResponse<
            SupportedFileType[]
          >;
          const types = data.result ?? [];
          // Update cache
          supportedTypesCache.types = types;
          supportedTypesCache.timestamp = now;

          const apiResponse: SupportedFileTypesResponse = {
            types,
            cached: false,
            fetchedAt: new Date().toISOString(),
          };
          return new Response(JSON.stringify(apiResponse), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        // If API fails, return fallback hardcoded list
        logWarning("toMarkdown API unavailable, using fallback list", {
          module: "ai_search",
          operation: "get_supported_types",
          metadata: { status: response.status },
        });

        const fallbackTypes: SupportedFileType[] = Object.entries(
          AI_SEARCH_SUPPORTED_EXTENSIONS,
        ).map(([ext, config]) => ({
          extension: ext,
          mimeType: config.mimeType,
        }));

        const fallbackResponse: SupportedFileTypesResponse = {
          types: fallbackTypes,
          cached: false,
          fetchedAt: new Date().toISOString(),
        };
        return new Response(JSON.stringify(fallbackResponse), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (err) {
        await logError(
          env,
          err instanceof Error ? err : String(err),
          { module: "ai_search", operation: "get_supported_types" },
          isLocalDev,
        );
        // Return fallback on error
        const fallbackTypes: SupportedFileType[] = Object.entries(
          AI_SEARCH_SUPPORTED_EXTENSIONS,
        ).map(([ext, config]) => ({
          extension: ext,
          mimeType: config.mimeType,
        }));
        const fallbackResponse: SupportedFileTypesResponse = {
          types: fallbackTypes,
          cached: false,
          fetchedAt: new Date().toISOString(),
        };
        return new Response(JSON.stringify(fallbackResponse), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // GET /api/ai-search/instances/:instanceName/status - Get detailed instance status with jobs
    const statusRegex = /^\/api\/ai-search\/instances\/([^/]+)\/status$/;
    const statusMatch = statusRegex.exec(url.pathname);
    if (request.method === "GET" && statusMatch?.[1] !== undefined) {
      const instanceName = decodeURIComponent(statusMatch[1]);
      logInfo("Getting instance status", {
        module: "ai_search",
        operation: "get_instance_status",
        metadata: { instanceName },
      });

      if (isLocalDev) {
        const mockStatus: AISearchInstanceStatus = {
          name: instanceName,
          status: "active",
          last_sync: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          files_indexed: 142,
          recentJobs: [
            {
              id: "mock-job-1",
              source: "user",
              started_at: new Date(Date.now() - 3600000).toISOString(),
              ended_at: new Date(Date.now() - 3500000).toISOString(),
            },
            {
              id: "mock-job-2",
              source: "schedule",
              started_at: new Date(Date.now() - 86400000).toISOString(),
              ended_at: new Date(Date.now() - 86300000).toISOString(),
            },
          ],
        };
        return new Response(JSON.stringify(mockStatus), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      try {
        // Fetch instance details and jobs in parallel
        const [instanceResponse, jobsResponse] = await Promise.all([
          fetch(
            `${CF_API}/accounts/${env.ACCOUNT_ID}/autorag/rags/${instanceName}`,
            { headers: cfHeaders },
          ),
          fetch(
            `${CF_API}/accounts/${env.ACCOUNT_ID}/autorag/rags/${instanceName}/jobs`,
            { headers: cfHeaders },
          ),
        ]);

        let instanceData: AISearchInstance | null = null;
        let jobs: AISearchIndexingJob[] = [];

        if (instanceResponse.ok) {
          const data =
            (await instanceResponse.json()) as CloudflareApiResponse<AISearchInstance>;
          instanceData = data.result ?? null;
        }

        if (jobsResponse.ok) {
          const jobsText = await jobsResponse.text();
          const data = JSON.parse(jobsText) as CloudflareApiResponse<{
            jobs: AISearchIndexingJob[];
          }>;
          // Handle both array format and { jobs: [...] } format
          if (Array.isArray(data.result)) {
            jobs = data.result as unknown as AISearchIndexingJob[];
          } else {
            jobs = data.result?.jobs ?? [];
          }
        }

        if (!instanceData) {
          return new Response(JSON.stringify({ error: "Instance not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        // Sort jobs by started_at descending and take last 10
        const sortedJobs = jobs
          .sort(
            (a, b) =>
              new Date(b.started_at).getTime() -
              new Date(a.started_at).getTime(),
          )
          .slice(0, 10);

        // Find last completed job (has ended_at but no end_reason indicating error)
        const lastCompletedJob = sortedJobs.find(
          (j) =>
            j.ended_at !== undefined &&
            (j.end_reason === null || j.end_reason === undefined),
        );

        const status: AISearchInstanceStatus = {
          name: instanceData.id ?? instanceData.name ?? instanceName,
          status: instanceData.status ?? "unknown",
          // Use ended_at as last_sync (Cloudflare API uses ended_at, not completed_at)
          ...(lastCompletedJob?.ended_at && {
            last_sync: lastCompletedJob.ended_at,
          }),
          // files_indexed not available in jobs API response
          ...(instanceData.vectorize_index && {
            vectorize_index_status: instanceData.vectorize_index,
          }),
          recentJobs: sortedJobs,
        };

        return new Response(JSON.stringify(status), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (err) {
        await logError(
          env,
          err instanceof Error ? err : String(err),
          { module: "ai_search", operation: "get_instance_status" },
          isLocalDev,
        );
        return new Response(
          JSON.stringify({ error: "Failed to fetch instance status" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
    }

    // GET /api/ai-search/dashboard-url - Get the Cloudflare dashboard URL for AI Search
    if (
      request.method === "GET" &&
      url.pathname === "/api/ai-search/dashboard-url"
    ) {
      return new Response(
        JSON.stringify({
          url: `https://dash.cloudflare.com/?to=/:account/ai/ai-search`,
          accountId: isLocalDev ? "local-dev" : env.ACCOUNT_ID,
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }
  } catch (err) {
    await logError(
      env,
      err instanceof Error ? err : String(err),
      { module: "ai_search", operation: "handle_request" },
      isLocalDev,
    );
    return new Response(
      JSON.stringify({ error: "AI Search operation failed" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  return new Response("Not Found", { status: 404, headers: corsHeaders });
}
