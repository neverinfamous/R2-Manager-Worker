/**
 * Centralized Error Response Utility
 *
 * Provides consistent error responses with support email across all API endpoints.
 */

import type { CorsHeaders } from "./cors";

/** Support email address for error messages */
export const SUPPORT_EMAIL = "admin@adamic.tech";

/** Standard API error response body */
export interface ApiErrorBody {
  error: string;
  support?: string;
  code?: string;
  details?: string;
}

/**
 * Create a standardized JSON error response with support email.
 *
 * @param message - User-facing error message
 * @param corsHeaders - CORS headers to include in response (accepts CorsHeaders or HeadersInit)
 * @param status - HTTP status code (default: 500)
 * @param options - Additional options for error details
 * @returns Response object with JSON error body
 */
export function createErrorResponse(
  message: string,
  corsHeaders: CorsHeaders | HeadersInit,
  status = 500,
  options?: {
    code?: string;
    details?: string;
    includeSupport?: boolean;
  },
): Response {
  const body: ApiErrorBody = {
    error: message,
    ...(options?.code && { code: options.code }),
    ...(options?.details && { details: options.details }),
  };

  // Include support email for 4xx/5xx errors (configurable)
  if (options?.includeSupport !== false && status >= 400) {
    body.support = SUPPORT_EMAIL;
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}
