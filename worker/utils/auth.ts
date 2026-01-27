import type { Env } from "../types";
import { logInfo, logError } from "./error-logger";

interface JWTPayload {
  email?: string;
  [key: string]: unknown;
}

// JWT validation for Cloudflare Access
export async function validateAccessJWT(
  request: Request,
  env: Env,
): Promise<string | null> {
  const token = request.headers.get("cf-access-jwt-assertion");

  if (token === null) {
    logInfo("No JWT token found in request headers", {
      module: "auth",
      operation: "validate",
    });
    return null;
  }

  try {
    // Import jose dynamically for JWT verification
    const { jwtVerify, createRemoteJWKSet } = await import("jose");

    const JWKS = createRemoteJWKSet(
      new URL(`${env.TEAM_DOMAIN}/cdn-cgi/access/certs`),
    );

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: env.TEAM_DOMAIN,
      audience: env.POLICY_AUD,
    });

    // Extract email from JWT payload
    const typedPayload = payload as JWTPayload;
    const email = typedPayload.email;
    if (email === undefined || typeof email !== "string") {
      logInfo("JWT payload missing email", {
        module: "auth",
        operation: "validate",
      });
      return null;
    }

    logInfo(`JWT validated for user: ${email}`, {
      module: "auth",
      operation: "validate",
      metadata: { email },
    });
    return email;
  } catch (error) {
    void logError(
      env,
      error instanceof Error ? error : new Error(String(error)),
      { module: "auth", operation: "validate" },
      false,
    );
    return null;
  }
}
