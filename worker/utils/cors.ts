export type CorsHeaders = Record<string, string>;
import { logInfo } from "./error-logger";

export function getCorsHeaders(request: Request): CorsHeaders {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") ?? "";

  // Detect localhost for development
  const isLocalhost =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const isLocalhostOrigin =
    origin.includes("localhost") || origin.includes("127.0.0.1");

  // For production with Cloudflare Access, we need to:
  // 1. Use the specific origin (not wildcard) to support credentials
  // 2. Allow credentials so cookies (CF_Authorization) can be sent

  return {
    "Access-Control-Allow-Origin":
      isLocalhost || isLocalhostOrigin
        ? origin
        : origin !== ""
          ? origin
          : url.origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS, PATCH",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-File-Name, X-Chunk-Index, X-Total-Chunks, cf-access-jwt-assertion",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin", // Important for caching with different origins
  };
}

export function handleCorsPreflightRequest(corsHeaders: CorsHeaders): Response {
  logInfo("[CORS] Handling preflight request", {
    module: "cors",
    operation: "preflight",
  });
  return new Response(null, { headers: corsHeaders });
}

export function isLocalDevelopment(request: Request): boolean {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") ?? "";
  const isLocalhost =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const isLocalhostOrigin =
    origin.includes("localhost") || origin.includes("127.0.0.1");

  return isLocalhost || isLocalhostOrigin;
}
