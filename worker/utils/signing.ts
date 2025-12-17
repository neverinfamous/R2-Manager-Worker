import type { Env } from '../types';
import { logInfo, logWarning } from './error-logger';

// Singleton for auto-generated local development key
let localSigningKey: string | null = null;

/**
 * Get the URL signing key with fallback for local development.
 * In production, URL_SIGNING_KEY must be set as a secret.
 * In local development, a random key is auto-generated.
 */
export function getSigningKey(env: Env): string {
  if (env.URL_SIGNING_KEY) {
    return env.URL_SIGNING_KEY;
  }

  // Auto-generate key for local development
  if (!localSigningKey) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    localSigningKey = Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    logWarning('[DEV] Auto-generated URL_SIGNING_KEY for local development', {
      module: 'signing',
      operation: 'generateLocalKey'
    });
  }
  return localSigningKey;
}

// URL signing functions using HMAC-SHA256
export async function generateSignature(path: string, env: Env): Promise<string> {
  const encoder = new TextEncoder();
  const keyString = getSigningKey(env);

  // Import the signing key for HMAC
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(keyString),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Generate HMAC-SHA256 signature
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(path)
  );

  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function validateSignature(request: Request, env: Env): Promise<boolean> {
  const url = new URL(request.url);
  const signature = url.searchParams.get('sig');
  if (!signature) {
    logWarning('[Signature] No signature provided', { module: 'signing', operation: 'validate' });
    return false;
  }

  // Decode the path before generating signature
  const decodedPath = decodeURIComponent(url.pathname);
  const searchParams = new URLSearchParams(url.search);
  searchParams.delete('sig');
  const queryString = searchParams.toString();
  const pathWithQuery = queryString ? decodedPath + '?' + queryString : decodedPath;

  const expectedSignature = await generateSignature(pathWithQuery, env);

  logInfo('[Signature] Validation', {
    module: 'signing',
    operation: 'validate',
    metadata: {
      path: url.pathname,
      decodedPath,
      pathWithQuery,
      providedSig: signature,
      expectedSig: expectedSignature,
      match: signature === expectedSignature
    }
  });

  return signature === expectedSignature;
}

