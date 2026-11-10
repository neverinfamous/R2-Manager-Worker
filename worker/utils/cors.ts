export type CorsHeaders = Record<string, string>;
import type { Env } from "../types";
import { logInfo, logWarning } from "./error-logger";

/**
 * Parse a comma-separated list of allowed origins into a normalized Set of origins.
 */
export function parseAllowedOrigins(allowedOriginsEnv?: string): Set<string> {
  const allowed = new Set<string>();
  if (!allowedOriginsEnv) {
    return allowed;
  }

  for (const rawEntry of allowedOriginsEnv.split(",")) {
    const trimmed = rawEntry.trim();
    if (trimmed === "") {
      continue;
    }
    try {
      const parsed = new URL(trimmed);
      allowed.add(parsed.origin);
    } catch {
      // Ignore malformed origin entries
    }
  }

  return allowed;
}

/**
 * Validate whether an incoming request Origin header is trusted for credentialed CORS
 * and state-changing API requests.
 *
 * Trusted origins:
 * 1. Same-origin (`originUrl.origin === requestUrl.origin`)
 * 2. Explicitly configured origins in `ALLOWED_ORIGINS`
 * 3. Localhost origins (`http://localhost:*` or `http://127.0.0.1:*`) ONLY when `isLocalDev` is true
 */
export function isAllowedOrigin(
  origin: string,
  requestUrl: URL,
  isLocalDev: boolean,
  allowedOriginsEnv?: string,
): boolean {
  if (origin === "" || origin === "null") {
    return false;
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  // Only allow http/https origins
  if (originUrl.protocol !== "http:" && originUrl.protocol !== "https:") {
    return false;
  }

  // Ensure incoming origin string matches canonical origin (no path/query/userinfo)
  if (origin !== originUrl.origin) {
    return false;
  }

  // 1. Same-origin is always trusted
  if (originUrl.origin === requestUrl.origin) {
    return true;
  }

  // 2. Explicitly configured allowed origins
  const configuredOrigins = parseAllowedOrigins(allowedOriginsEnv);
  if (configuredOrigins.has(originUrl.origin)) {
    return true;
  }

  // 3. In local development only, allow localhost/127.0.0.1 origins (e.g. Vite on port 5173)
  if (
    isLocalDev &&
    (originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1")
  ) {
    return true;
  }

  return false;
}

export function getCorsHeaders(
  request: Request,
  isLocalDev = false,
  allowedOriginsEnv?: string,
): CorsHeaders {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") ?? "";

  // Only emit credentialed CORS headers for explicitly trusted origins
  if (
    origin !== "" &&
    isAllowedOrigin(origin, url, isLocalDev, allowedOriginsEnv)
  ) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS, PATCH",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-File-Name, X-Chunk-Index, X-Total-Chunks, cf-access-jwt-assertion",
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
    };
  }

  return {
    Vary: "Origin",
  };
}

export function handleCorsPreflightRequest(
  request: Request,
  corsHeaders: CorsHeaders,
): Response {
  logInfo("[CORS] Handling preflight request", {
    module: "cors",
    operation: "preflight",
  });

  const origin = request.headers.get("Origin") ?? "";
  if (origin !== "" && !("Access-Control-Allow-Origin" in corsHeaders)) {
    return new Response("Forbidden", {
      status: 403,
      headers: { Vary: "Origin" },
    });
  }

  return new Response(null, { headers: corsHeaders });
}

/**
 * Determine whether the request URL targets a local development hostname.
 * Never trust client-controlled headers (such as Origin) for this check.
 */
export function isLocalDevelopment(request: Request): boolean {
  const url = new URL(request.url);
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

/**
 * Determine whether the Worker is running in a local development environment
 * without production credentials or Cloudflare Access configuration.
 */
export function isLocalDevEnvironment(request: Request, env: Env): boolean {
  const isLocalhost = isLocalDevelopment(request);
  const hasProductionCredentials = Boolean(
    env.ACCOUNT_ID && env.CF_EMAIL && env.API_KEY,
  );
  const hasAccessConfig = Boolean(env.TEAM_DOMAIN && env.POLICY_AUD);
  return isLocalhost && !hasProductionCredentials && !hasAccessConfig;
}

/**
 * Validate state-changing API requests against untrusted cross-origin calls.
 * Returns a 403 Forbidden Response if the request must be blocked, or null if permitted.
 */
export function validateCrossOriginRequest(
  request: Request,
  url: URL,
  isLocalDev: boolean,
  allowedOriginsEnv?: string,
): Response | null {
  const isStateChangingMethod =
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.method !== "OPTIONS";

  if (!url.pathname.startsWith("/api/") || !isStateChangingMethod) {
    return null;
  }

  const origin = request.headers.get("Origin") ?? "";
  const secFetchSite = request.headers.get("Sec-Fetch-Site") ?? "";
  const hasUntrustedOrigin =
    origin !== "" &&
    !isAllowedOrigin(origin, url, isLocalDev, allowedOriginsEnv);
  const isCrossSiteWithoutTrustedOrigin =
    !isLocalDev &&
    secFetchSite === "cross-site" &&
    !isAllowedOrigin(origin, url, isLocalDev, allowedOriginsEnv);

  if (hasUntrustedOrigin || isCrossSiteWithoutTrustedOrigin) {
    logWarning("Blocked state-changing request from untrusted origin", {
      module: "cors",
      operation: "csrf_check",
      metadata: {
        origin,
        secFetchSite,
        method: request.method,
        pathname: url.pathname,
      },
    });
    return new Response(
      JSON.stringify({
        error: "Forbidden",
        message: "Cross-origin state-changing requests are not permitted.",
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          Vary: "Origin",
        },
      },
    );
  }

  return null;
}
