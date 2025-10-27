import type { Env } from '../types';

// URL signing functions using HMAC-SHA256
export async function generateSignature(path: string, env: Env): Promise<string> {
  const encoder = new TextEncoder();
  
  // Import the signing key for HMAC
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.URL_SIGNING_KEY),
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
    console.log('[Signature] No signature provided');
    return false;
  }

  // Decode the path before generating signature
  const decodedPath = decodeURIComponent(url.pathname);
  const searchParams = new URLSearchParams(url.search);
  searchParams.delete('sig');
  const queryString = searchParams.toString();
  const pathWithQuery = queryString ? decodedPath + '?' + queryString : decodedPath;
  
  const expectedSignature = await generateSignature(pathWithQuery, env);
  
  console.log('[Signature] Validation:', {
    path: url.pathname,
    decodedPath,
    pathWithQuery,
    providedSig: signature,
    expectedSig: expectedSignature,
    match: signature === expectedSignature
  });
  
  return signature === expectedSignature;
}

