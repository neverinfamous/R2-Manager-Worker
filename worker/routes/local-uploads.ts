import type { Env, CloudflareApiResponse } from "../types";
import { CF_API } from "../types";
import { type CorsHeaders } from "../utils/cors";
import { getCloudflareHeaders } from "../utils/helpers";
import { logError, logInfo, logWarning } from "../utils/error-logger";
import { createErrorResponse } from "../utils/error-response";

/**
 * Local uploads status result from Cloudflare API
 */
interface LocalUploadsStatus {
  enabled: boolean;
}

/**
 * Handle local uploads routes for R2 bucket local uploads management
 *
 * Endpoints:
 * - GET  /api/local-uploads/:bucketName - Get local uploads status for a bucket
 * - PUT  /api/local-uploads/:bucketName - Enable/disable local uploads for a bucket
 */
export async function handleLocalUploadsRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  _userEmail: string,
): Promise<Response> {
  logInfo("Handling local uploads operation", {
    module: "local-uploads",
    operation: "handle",
  });

  const cfHeaders = getCloudflareHeaders(env);

  try {
    // Extract bucket name from path: /api/local-uploads/:bucketName
    const pathRegex = /^\/api\/local-uploads\/([^/]+)$/;
    const pathMatch = pathRegex.exec(url.pathname);
    if (pathMatch === null) {
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    }

    const bucketNameMatch = pathMatch[1];
    if (bucketNameMatch === undefined) {
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    }
    const bucketName = decodeURIComponent(bucketNameMatch);
    logInfo(`Local uploads operation for bucket: ${bucketName}`, {
      module: "local-uploads",
      operation: request.method,
      bucketName,
    });

    // GET - Retrieve local uploads status
    if (request.method === "GET") {
      logInfo(`Getting local uploads status for bucket: ${bucketName}`, {
        module: "local-uploads",
        operation: "get",
        bucketName,
      });

      // Mock response for local development
      if (isLocalDev) {
        logInfo("Using mock data for local development", {
          module: "local-uploads",
          operation: "get",
          bucketName,
        });
        return new Response(
          JSON.stringify({
            success: true,
            result: { enabled: false },
          }),
          {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          },
        );
      }

      // Cloudflare REST API call
      const response = await fetch(
        `${CF_API}/accounts/${env.ACCOUNT_ID}/r2/buckets/${encodeURIComponent(bucketName)}/local-uploads`,
        {
          method: "GET",
          headers: cfHeaders,
        },
      );

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          errors?: { message: string }[];
        };
        const errorMessage =
          errorData.errors?.[0]?.message ??
          "Failed to get local uploads status";
        logWarning(`Failed to get local uploads status: ${errorMessage}`, {
          module: "local-uploads",
          operation: "get",
          bucketName,
          metadata: { status: response.status },
        });
        return createErrorResponse(errorMessage, corsHeaders, response.status);
      }

      const data =
        (await response.json()) as CloudflareApiResponse<LocalUploadsStatus>;
      logInfo(
        `Successfully retrieved local uploads status for bucket: ${bucketName}`,
        {
          module: "local-uploads",
          operation: "get",
          bucketName,
          metadata: { enabled: data.result?.enabled ?? false },
        },
      );

      return new Response(
        JSON.stringify({
          success: true,
          result: data.result,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    // PUT - Enable/disable local uploads
    if (request.method === "PUT") {
      const body = (await request.json()) as { enabled: boolean };

      if (typeof body.enabled !== "boolean") {
        return createErrorResponse(
          'Invalid request body: "enabled" boolean field required',
          corsHeaders,
          400,
        );
      }

      logInfo(
        `${body.enabled ? "Enabling" : "Disabling"} local uploads for bucket: ${bucketName}`,
        {
          module: "local-uploads",
          operation: "set",
          bucketName,
          metadata: { enabled: body.enabled },
        },
      );

      // Mock response for local development
      if (isLocalDev) {
        logInfo("Simulating local uploads update for local development", {
          module: "local-uploads",
          operation: "set",
          bucketName,
        });
        return new Response(
          JSON.stringify({
            success: true,
            result: {},
          }),
          {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          },
        );
      }

      // Cloudflare REST API call
      const response = await fetch(
        `${CF_API}/accounts/${env.ACCOUNT_ID}/r2/buckets/${encodeURIComponent(bucketName)}/local-uploads`,
        {
          method: "PUT",
          headers: {
            ...cfHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ enabled: body.enabled }),
        },
      );

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          errors?: { message: string }[];
        };
        const errorMessage =
          errorData.errors?.[0]?.message ??
          "Failed to update local uploads setting";
        void logError(
          env,
          new Error(errorMessage),
          {
            module: "local-uploads",
            operation: "set",
            bucketName,
            metadata: { status: response.status },
          },
          isLocalDev,
        );
        return createErrorResponse(errorMessage, corsHeaders, response.status);
      }

      logInfo(
        `Successfully ${body.enabled ? "enabled" : "disabled"} local uploads for bucket: ${bucketName}`,
        {
          module: "local-uploads",
          operation: "set",
          bucketName,
          metadata: { enabled: body.enabled },
        },
      );

      return new Response(
        JSON.stringify({
          success: true,
          result: { enabled: body.enabled },
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    // Method not allowed
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  } catch (err) {
    void logError(
      env,
      err instanceof Error ? err : new Error(String(err)),
      {
        module: "local-uploads",
        operation: "handle",
      },
      isLocalDev,
    );
    return createErrorResponse(
      "Local uploads operation failed",
      corsHeaders,
      500,
    );
  }
}
