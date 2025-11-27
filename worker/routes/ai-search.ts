import type { Env, CloudflareApiResponse, R2ObjectInfo, AISearchCompatibility, AISearchFileInfo, AISearchInstance, AISearchInstancesListResult, AISearchQueryRequest, AISearchResponse, CreateAISearchBody, AISearchSyncResponse } from '../types';
import { CF_API } from '../types';
import { type CorsHeaders } from '../utils/cors';

// AI Search supported file extensions and size limits (per Cloudflare docs)
const AI_SEARCH_SUPPORTED_EXTENSIONS: Record<string, { maxSize: number; mimeType: string }> = {
  // Plain text files
  '.txt': { maxSize: 4 * 1024 * 1024, mimeType: 'text/plain' },
  '.rst': { maxSize: 4 * 1024 * 1024, mimeType: 'text/plain' },
  '.log': { maxSize: 4 * 1024 * 1024, mimeType: 'text/plain' },
  '.ini': { maxSize: 4 * 1024 * 1024, mimeType: 'text/plain' },
  '.conf': { maxSize: 4 * 1024 * 1024, mimeType: 'text/plain' },
  '.env': { maxSize: 4 * 1024 * 1024, mimeType: 'text/plain' },
  '.properties': { maxSize: 4 * 1024 * 1024, mimeType: 'text/plain' },
  '.gitignore': { maxSize: 4 * 1024 * 1024, mimeType: 'text/plain' },
  '.editorconfig': { maxSize: 4 * 1024 * 1024, mimeType: 'text/plain' },
  '.toml': { maxSize: 4 * 1024 * 1024, mimeType: 'text/toml' },
  // Markdown
  '.md': { maxSize: 4 * 1024 * 1024, mimeType: 'text/markdown' },
  '.mdx': { maxSize: 4 * 1024 * 1024, mimeType: 'text/markdown' },
  '.markdown': { maxSize: 4 * 1024 * 1024, mimeType: 'text/markdown' },
  // LaTeX
  '.tex': { maxSize: 4 * 1024 * 1024, mimeType: 'application/x-tex' },
  '.latex': { maxSize: 4 * 1024 * 1024, mimeType: 'application/x-latex' },
  // Scripts
  '.sh': { maxSize: 4 * 1024 * 1024, mimeType: 'application/x-sh' },
  '.bat': { maxSize: 4 * 1024 * 1024, mimeType: 'application/x-msdos-batch' },
  '.ps1': { maxSize: 4 * 1024 * 1024, mimeType: 'text/x-powershell' },
  // SGML
  '.sgml': { maxSize: 4 * 1024 * 1024, mimeType: 'text/sgml' },
  // Data formats
  '.json': { maxSize: 4 * 1024 * 1024, mimeType: 'application/json' },
  '.yaml': { maxSize: 4 * 1024 * 1024, mimeType: 'application/x-yaml' },
  '.yml': { maxSize: 4 * 1024 * 1024, mimeType: 'application/x-yaml' },
  // HTML
  '.html': { maxSize: 4 * 1024 * 1024, mimeType: 'text/html' },
  '.htm': { maxSize: 4 * 1024 * 1024, mimeType: 'text/html' },
  // Code files (commonly indexed)
  '.js': { maxSize: 4 * 1024 * 1024, mimeType: 'text/javascript' },
  '.ts': { maxSize: 4 * 1024 * 1024, mimeType: 'text/typescript' },
  '.jsx': { maxSize: 4 * 1024 * 1024, mimeType: 'text/javascript' },
  '.tsx': { maxSize: 4 * 1024 * 1024, mimeType: 'text/typescript' },
  '.py': { maxSize: 4 * 1024 * 1024, mimeType: 'text/x-python' },
  '.css': { maxSize: 4 * 1024 * 1024, mimeType: 'text/css' },
  '.xml': { maxSize: 4 * 1024 * 1024, mimeType: 'application/xml' },
};

function getFileExtension(key: string): string {
  const lastDotIndex = key.lastIndexOf('.');
  if (lastDotIndex === -1) return '';
  return key.slice(lastDotIndex).toLowerCase();
}

function isFileIndexable(key: string, size: number): { indexable: boolean; reason?: string } {
  const ext = getFileExtension(key);
  
  if (!ext) {
    return { indexable: false, reason: 'No file extension' };
  }
  
  const config = AI_SEARCH_SUPPORTED_EXTENSIONS[ext];
  if (!config) {
    return { indexable: false, reason: `Unsupported extension: ${ext}` };
  }
  
  if (size > config.maxSize) {
    return { indexable: false, reason: `File size ${(size / 1024 / 1024).toFixed(2)}MB exceeds limit of ${config.maxSize / 1024 / 1024}MB` };
  }
  
  return { indexable: true };
}

export async function handleAISearchRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  console.log('[AI Search] Handling AI Search operation');

  const cfHeaders = {
    'X-Auth-Email': env.CF_EMAIL,
    'X-Auth-Key': env.API_KEY,
    'Content-Type': 'application/json'
  };

  try {
    // GET /api/ai-search/compatibility/:bucketName - Analyze bucket for AI Search compatibility
    const compatibilityRegex = /^\/api\/ai-search\/compatibility\/([^/]+)$/;
    const compatibilityMatch = compatibilityRegex.exec(url.pathname);
    if (request.method === 'GET' && compatibilityMatch?.[1] !== undefined) {
      const bucketName = decodeURIComponent(compatibilityMatch[1]);
      console.log('[AI Search] Checking compatibility for bucket:', bucketName);

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
              { key: 'readme.md', size: 1024, extension: '.md' },
              { key: 'config.json', size: 512, extension: '.json' },
            ],
            nonIndexable: [
              { key: 'image.png', size: 1024 * 1024, extension: '.png', reason: 'Unsupported extension: .png' },
            ],
          },
          supportedExtensions: Object.keys(AI_SEARCH_SUPPORTED_EXTENSIONS),
        };
        return new Response(JSON.stringify(mockResponse), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Fetch all files from the bucket
      const allFiles: R2ObjectInfo[] = [];
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const listUrl = new URL(`${CF_API}/accounts/${env.ACCOUNT_ID}/r2/buckets/${bucketName}/objects`);
        if (cursor) {
          listUrl.searchParams.set('cursor', cursor);
        }
        listUrl.searchParams.set('per_page', '100');

        const listResponse = await fetch(listUrl.toString(), { headers: cfHeaders });
        if (!listResponse.ok) {
          throw new Error(`Failed to list objects: ${listResponse.status}`);
        }

        const listData = await listResponse.json() as CloudflareApiResponse<R2ObjectInfo[]>;
        const objects: R2ObjectInfo[] = Array.isArray(listData.result) ? listData.result : [];
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
        if (file.key.endsWith('/')) continue;

        totalSize += file.size;
        const ext = getFileExtension(file.key);
        const { indexable, reason } = isFileIndexable(file.key, file.size);

        if (indexable) {
          indexableFiles.push({ key: file.key, size: file.size, extension: ext });
          indexableSize += file.size;
        } else {
          const fileInfo: AISearchFileInfo = { key: file.key, size: file.size, extension: ext };
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
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // GET /api/ai-search/instances - List all AI Search instances
    if (request.method === 'GET' && url.pathname === '/api/ai-search/instances') {
      console.log('[AI Search] Listing AI Search instances');

      if (isLocalDev) {
        const mockInstances: AISearchInstance[] = [
          {
            name: 'dev-rag',
            description: 'Development RAG instance',
            created_at: new Date().toISOString(),
            status: 'active',
            data_source: { type: 'r2', bucket_name: 'dev-bucket' },
          }
        ];
        return new Response(JSON.stringify({ instances: mockInstances }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Try to fetch AI Search instances from Cloudflare API
      try {
        const response = await fetch(
          `${CF_API}/accounts/${env.ACCOUNT_ID}/autorag/rags`,
          { headers: cfHeaders }
        );

        if (!response.ok) {
          // API might not be available or require different permissions
          console.warn('[AI Search] Failed to list instances:', response.status);
          return new Response(JSON.stringify({ 
            instances: [],
            error: 'AI Search management API not available. Create instances via Cloudflare Dashboard.',
            dashboardUrl: `https://dash.cloudflare.com/?to=/:account/ai/ai-search`
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const data = await response.json() as CloudflareApiResponse<AISearchInstancesListResult>;
        return new Response(JSON.stringify({ 
          instances: data.result?.rags ?? [] 
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        console.error('[AI Search] Error listing instances:', err);
        return new Response(JSON.stringify({ 
          instances: [],
          error: 'Failed to fetch AI Search instances'
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // POST /api/ai-search/instances - Create a new AI Search instance
    if (request.method === 'POST' && url.pathname === '/api/ai-search/instances') {
      const body = await request.json() as CreateAISearchBody;
      console.log('[AI Search] Creating AI Search instance:', body.name);

      if (isLocalDev) {
        return new Response(JSON.stringify({
          success: true,
          instance: {
            name: body.name,
            status: 'indexing',
            data_source: { type: 'r2', bucket_name: body.bucketName }
          }
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Try to create AI Search instance via API
      try {
        const response = await fetch(
          `${CF_API}/accounts/${env.ACCOUNT_ID}/autorag/rags`,
          {
            method: 'POST',
            headers: cfHeaders,
            body: JSON.stringify({
              name: body.name,
              description: body.description,
              source: {
                type: 'r2',
                r2_bucket: body.bucketName
              },
              embedding_model: body.embeddingModel ?? '@cf/baai/bge-base-en-v1.5',
              generation_model: body.generationModel ?? '@cf/meta/llama-3.1-8b-instruct'
            })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[AI Search] Failed to create instance:', response.status, errorText);
          return new Response(JSON.stringify({ 
            success: false,
            error: 'Failed to create AI Search instance. Use Cloudflare Dashboard instead.',
            dashboardUrl: `https://dash.cloudflare.com/?to=/:account/ai/ai-search`
          }), {
            status: response.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const data = await response.json() as CloudflareApiResponse<AISearchInstance>;
        return new Response(JSON.stringify({ 
          success: true,
          instance: data.result 
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        console.error('[AI Search] Error creating instance:', err);
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Failed to create AI Search instance'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // DELETE /api/ai-search/instances/:instanceName - Delete an AI Search instance
    const deleteRegex = /^\/api\/ai-search\/instances\/([^/]+)$/;
    const deleteMatch = deleteRegex.exec(url.pathname);
    if (request.method === 'DELETE' && deleteMatch?.[1] !== undefined) {
      const instanceName = decodeURIComponent(deleteMatch[1]);
      console.log('[AI Search] Deleting AI Search instance:', instanceName);

      if (isLocalDev) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      try {
        const response = await fetch(
          `${CF_API}/accounts/${env.ACCOUNT_ID}/autorag/rags/${instanceName}`,
          { method: 'DELETE', headers: cfHeaders }
        );

        if (!response.ok) {
          return new Response(JSON.stringify({ 
            success: false,
            error: 'Failed to delete AI Search instance'
          }), {
            status: response.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        console.error('[AI Search] Error deleting instance:', err);
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Failed to delete AI Search instance'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // POST /api/ai-search/instances/:instanceName/sync - Trigger sync for an instance
    const syncRegex = /^\/api\/ai-search\/instances\/([^/]+)\/sync$/;
    const syncMatch = syncRegex.exec(url.pathname);
    if (request.method === 'POST' && syncMatch?.[1] !== undefined) {
      const instanceName = decodeURIComponent(syncMatch[1]);
      console.log('[AI Search] Triggering sync for instance:', instanceName);

      if (isLocalDev) {
        return new Response(JSON.stringify({ 
          success: true,
          message: 'Sync triggered successfully',
          job_id: 'mock-job-id-123'
        } as AISearchSyncResponse), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      try {
        const response = await fetch(
          `${CF_API}/accounts/${env.ACCOUNT_ID}/autorag/rags/${instanceName}/sync`,
          { method: 'POST', headers: cfHeaders }
        );

        const data = await response.json() as CloudflareApiResponse<AISearchSyncResponse>;
        
        if (!response.ok) {
          return new Response(JSON.stringify({ 
            success: false,
            error: 'Failed to trigger sync'
          }), {
            status: response.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        return new Response(JSON.stringify({ 
          success: true,
          message: 'Sync triggered successfully',
          job_id: data.result?.job_id
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        console.error('[AI Search] Error triggering sync:', err);
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Failed to trigger sync'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // POST /api/ai-search/:instanceName/search - Semantic search
    const searchRegex = /^\/api\/ai-search\/([^/]+)\/search$/;
    const searchMatch = searchRegex.exec(url.pathname);
    if (request.method === 'POST' && searchMatch?.[1] !== undefined) {
      const instanceName = decodeURIComponent(searchMatch[1]);
      const body = await request.json() as AISearchQueryRequest;
      console.log('[AI Search] Search query for instance:', instanceName);

      if (isLocalDev) {
        const mockResponse: AISearchResponse = {
          data: [
            {
              file_id: 'mock-1',
              filename: 'example.md',
              score: 0.85,
              content: [{ id: '1', type: 'text', text: 'This is a mock search result.' }]
            }
          ],
          has_more: false,
          next_page: null
        };
        return new Response(JSON.stringify(mockResponse), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
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
            max_num_results: body.max_num_results ?? 10
          };
          
          if (body.score_threshold !== undefined) {
            searchParams.ranking_options = { score_threshold: body.score_threshold };
          }
          if (body.reranking !== undefined) {
            searchParams.reranking = body.reranking;
          }

          const result = await env.AI.autorag(instanceName).search(searchParams);

          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } catch (err) {
          console.error('[AI Search] Search error:', err);
          return new Response(JSON.stringify({ 
            error: 'Search failed',
            details: err instanceof Error ? err.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      } else {
        // Fall back to REST API
        try {
          const response = await fetch(
            `${CF_API}/accounts/${env.ACCOUNT_ID}/autorag/rags/${instanceName}/search`,
            {
              method: 'POST',
              headers: cfHeaders,
              body: JSON.stringify(body)
            }
          );

          const data = await response.json();
          return new Response(JSON.stringify(data), {
            status: response.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } catch (err) {
          console.error('[AI Search] REST API search error:', err);
          return new Response(JSON.stringify({ 
            error: 'Search failed'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }
    }

    // POST /api/ai-search/:instanceName/ai-search - AI-powered search with generated response
    const aiSearchRegex = /^\/api\/ai-search\/([^/]+)\/ai-search$/;
    const aiSearchMatch = aiSearchRegex.exec(url.pathname);
    if (request.method === 'POST' && aiSearchMatch?.[1] !== undefined) {
      const instanceName = decodeURIComponent(aiSearchMatch[1]);
      const body = await request.json() as AISearchQueryRequest;
      console.log('[AI Search] AI Search query for instance:', instanceName);

      if (isLocalDev) {
        const mockResponse: AISearchResponse = {
          response: 'This is a mock AI-generated response based on your query.',
          data: [
            {
              file_id: 'mock-1',
              filename: 'example.md',
              score: 0.85,
              content: [{ id: '1', type: 'text', text: 'This is a mock search result.' }]
            }
          ],
          has_more: false,
          next_page: null
        };
        return new Response(JSON.stringify(mockResponse), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
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
              stream: true
            };
            
            if (body.score_threshold !== undefined) {
              streamParams.ranking_options = { score_threshold: body.score_threshold };
            }
            if (body.reranking !== undefined) {
              streamParams.reranking = body.reranking;
            }

            const streamResult = await env.AI.autorag(instanceName).aiSearch(streamParams);
            
            // The streaming response returns a Response object
            return new Response(streamResult.body, {
              headers: { 
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                ...corsHeaders 
              }
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
              max_num_results: body.max_num_results ?? 10
            };
            
            if (body.score_threshold !== undefined) {
              searchParams.ranking_options = { score_threshold: body.score_threshold };
            }
            if (body.reranking !== undefined) {
              searchParams.reranking = body.reranking;
            }

            const result = await env.AI.autorag(instanceName).aiSearch(searchParams);

            return new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
        } catch (err) {
          console.error('[AI Search] AI Search error:', err);
          return new Response(JSON.stringify({ 
            error: 'AI Search failed',
            details: err instanceof Error ? err.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      } else {
        // Fall back to REST API
        try {
          const response = await fetch(
            `${CF_API}/accounts/${env.ACCOUNT_ID}/autorag/rags/${instanceName}/ai-search`,
            {
              method: 'POST',
              headers: cfHeaders,
              body: JSON.stringify(body)
            }
          );

          const data = await response.json();
          return new Response(JSON.stringify(data), {
            status: response.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } catch (err) {
          console.error('[AI Search] REST API AI Search error:', err);
          return new Response(JSON.stringify({ 
            error: 'AI Search failed'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }
    }

    // GET /api/ai-search/dashboard-url - Get the Cloudflare dashboard URL for AI Search
    if (request.method === 'GET' && url.pathname === '/api/ai-search/dashboard-url') {
      return new Response(JSON.stringify({
        url: `https://dash.cloudflare.com/?to=/:account/ai/ai-search`,
        accountId: isLocalDev ? 'local-dev' : env.ACCOUNT_ID
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

  } catch (err) {
    console.error('[AI Search] Operation error:', err);
    return new Response(JSON.stringify({ error: 'AI Search operation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  return new Response('Not Found', { status: 404, headers: corsHeaders });
}

