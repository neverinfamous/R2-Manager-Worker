import type { Env } from '../types';

// JWT validation for Cloudflare Access
export async function validateAccessJWT(request: Request, env: Env): Promise<string | null> {
  const token = request.headers.get('cf-access-jwt-assertion');
  
  if (!token) {
    console.log('[Auth] No JWT token found in request headers');
    return null;
  }

  try {
    // Import jose dynamically for JWT verification
    const { jwtVerify, createRemoteJWKSet } = await import('jose');
    
    const JWKS = createRemoteJWKSet(new URL(`${env.TEAM_DOMAIN}/cdn-cgi/access/certs`));
    
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: env.TEAM_DOMAIN,
      audience: env.POLICY_AUD,
    });

    // Extract email from JWT payload
    const email = payload.email as string;
    if (!email) {
      console.log('[Auth] JWT payload missing email');
      return null;
    }
    
    console.log('[Auth] JWT validated for user:', email);
    return email;
  } catch (error) {
    console.error('[Auth] JWT validation failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

