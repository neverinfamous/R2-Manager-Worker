import type { Env } from "../types";
import { logWarning } from "./error-logger";

/**
 * Rate limit tier types for different operation categories
 */
export type RateLimitTier = "READ" | "WRITE" | "DELETE";

/**
 * Result from rate limit check
 */
export interface RateLimitCheckResult {
  success: boolean;
  tier: RateLimitTier;
  limit: number;
  period: number;
}

/**
 * Determines which rate limit tier to apply based on the HTTP method and pathname
 *
 * Classification:
 * - READ (600 req/60s): GET operations for buckets, files, search, signed URLs
 * - WRITE (200 req/60s): POST/PATCH operations for uploads, renames, copies, moves, folder creation
 * - DELETE (60 req/60s): DELETE operations for buckets, files, folders
 *
 * @param method HTTP request method
 * @param pathname URL pathname
 * @returns The appropriate rate limit tier
 */
function getRateLimitTier(method: string, pathname: string): RateLimitTier {
  // DELETE operations are most restrictive
  if (method === "DELETE") {
    return "DELETE";
  }

  // GET operations (reads) - signed-url generation is also a read
  if (method === "GET" || pathname.includes("/signed-url/")) {
    return "READ";
  }

  // POST and PATCH operations (writes)
  // This includes: uploads, renames, copies, moves, folder creation
  if (method === "POST" || method === "PATCH") {
    return "WRITE";
  }

  // Default to READ for any other methods
  return "READ";
}

/**
 * Get the rate limiter binding and limit info for a specific tier
 *
 * @param env Worker environment bindings
 * @param tier Rate limit tier
 * @returns Object with limiter binding and limit configuration
 */
function getRateLimiter(
  env: Env,
  tier: RateLimitTier,
): { limiter: RateLimit; limit: number; period: number } {
  switch (tier) {
    case "READ":
      return { limiter: env.RATE_LIMITER_READ, limit: 600, period: 60 };
    case "WRITE":
      return { limiter: env.RATE_LIMITER_WRITE, limit: 200, period: 60 };
    case "DELETE":
      return { limiter: env.RATE_LIMITER_DELETE, limit: 60, period: 60 };
  }
}

/**
 * Check rate limit for an API request
 *
 * Rate limits are enforced per-user (identified by email from JWT) per Cloudflare location.
 * The limits are eventually consistent across the network.
 *
 * @param env Worker environment bindings
 * @param method HTTP request method
 * @param pathname URL pathname
 * @param userEmail User email from validated JWT (used as rate limit key)
 * @returns Rate limit check result
 */
export async function checkRateLimit(
  env: Env,
  method: string,
  pathname: string,
  userEmail: string,
): Promise<RateLimitCheckResult> {
  // Determine appropriate tier for this request
  const tier = getRateLimitTier(method, pathname);

  // Get the corresponding rate limiter
  const { limiter, limit, period } = getRateLimiter(env, tier);

  // Check rate limit using user email as the key
  // This ensures each user has their own rate limit counter
  const { success } = await limiter.limit({ key: userEmail });

  // Log violation for monitoring
  if (!success) {
    logWarning("[Rate Limit] Limit exceeded", {
      module: "ratelimit",
      operation: "check",
      metadata: {
        timestamp: new Date().toISOString(),
        userEmail,
        method,
        pathname,
        tier,
        limit: `${limit} requests per ${period} seconds`,
      },
    });
  }

  return {
    success,
    tier,
    limit,
    period,
  };
}

/**
 * Create a 429 Too Many Requests response with detailed error information
 *
 * @param checkResult Rate limit check result
 * @param corsHeaders CORS headers to include in response
 * @returns Response object with 429 status
 */
export function createRateLimitResponse(
  checkResult: RateLimitCheckResult,
  corsHeaders: HeadersInit,
): Response {
  const { tier, limit, period } = checkResult;

  // Calculate Retry-After header (in seconds)
  // Using the period as a safe retry time
  const retryAfter = period;

  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      message: `You have exceeded the ${tier.toLowerCase()} operation rate limit of ${limit} requests per ${period} seconds. Please wait before retrying.`,
      tier,
      limit,
      period,
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": retryAfter.toString(),
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Period": period.toString(),
        "X-RateLimit-Tier": tier,
        ...corsHeaders,
      },
    },
  );
}
