import type { Env, CloudflareApiResponse, LifecycleRule, LifecycleConfiguration } from '../types';
import { CF_API } from '../types';
import { type CorsHeaders } from '../utils/cors';
import { getCloudflareHeaders } from '../utils/helpers';
import { logError, logInfo, logWarning } from '../utils/error-logger';
import { createErrorResponse } from '../utils/error-response';

/**
 * Handle lifecycle routes for R2 bucket lifecycle management
 * 
 * Endpoints:
 * - GET  /api/lifecycle/:bucketName - Get lifecycle rules for a bucket
 * - PUT  /api/lifecycle/:bucketName - Set lifecycle rules for a bucket
 */
export async function handleLifecycleRoutes(
    request: Request,
    env: Env,
    url: URL,
    corsHeaders: CorsHeaders,
    isLocalDev: boolean,
    _userEmail: string
): Promise<Response> {
    logInfo('Handling lifecycle operation', { module: 'lifecycle', operation: 'handle' });

    const cfHeaders = getCloudflareHeaders(env);

    try {
        // Extract bucket name from path: /api/lifecycle/:bucketName
        const pathRegex = /^\/api\/lifecycle\/([^/]+)$/;
        const pathMatch = pathRegex.exec(url.pathname);
        if (pathMatch === null) {
            return new Response('Not Found', { status: 404, headers: corsHeaders });
        }

        const bucketNameMatch = pathMatch[1];
        if (bucketNameMatch === undefined) {
            return new Response('Not Found', { status: 404, headers: corsHeaders });
        }
        const bucketName = decodeURIComponent(bucketNameMatch);
        logInfo(`Lifecycle operation for bucket: ${bucketName}`, {
            module: 'lifecycle',
            operation: request.method,
            bucketName
        });

        // GET - Retrieve lifecycle rules
        if (request.method === 'GET') {
            logInfo(`Getting lifecycle rules for bucket: ${bucketName}`, {
                module: 'lifecycle',
                operation: 'get',
                bucketName
            });

            // Mock response for local development
            if (isLocalDev) {
                logInfo('Using mock data for local development', {
                    module: 'lifecycle',
                    operation: 'get',
                    bucketName
                });
                return new Response(JSON.stringify({
                    success: true,
                    result: {
                        rules: [
                            {
                                id: 'mock-expiration-rule',
                                enabled: true,
                                conditions: {
                                    prefix: 'temp/',
                                    maxAgeSeconds: 7776000 // 90 days
                                },
                                actions: [{ type: 'Delete' }]
                            },
                            {
                                id: 'mock-transition-rule',
                                enabled: true,
                                conditions: {
                                    prefix: 'archive/',
                                    maxAgeSeconds: 2592000 // 30 days
                                },
                                actions: [{ type: 'SetStorageClass', storageClass: 'InfrequentAccess' }]
                            }
                        ]
                    }
                }), {
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }

            // Cloudflare REST API call
            const response = await fetch(
                `${CF_API}/accounts/${env.ACCOUNT_ID}/r2/buckets/${encodeURIComponent(bucketName)}/lifecycle`,
                {
                    method: 'GET',
                    headers: cfHeaders
                }
            );

            if (!response.ok) {
                // 404 means no lifecycle rules configured - return empty array
                if (response.status === 404) {
                    logInfo(`No lifecycle rules found for bucket: ${bucketName}`, {
                        module: 'lifecycle',
                        operation: 'get',
                        bucketName
                    });
                    return new Response(JSON.stringify({
                        success: true,
                        result: { rules: [] }
                    }), {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders
                        }
                    });
                }

                const errorData = await response.json().catch(() => ({})) as { errors?: { message: string }[] };
                const errorMessage = errorData.errors?.[0]?.message ?? 'Failed to get lifecycle rules';
                logWarning(`Failed to get lifecycle rules: ${errorMessage}`, {
                    module: 'lifecycle',
                    operation: 'get',
                    bucketName,
                    metadata: { status: response.status }
                });
                return createErrorResponse(errorMessage, corsHeaders, response.status);
            }

            const data = await response.json() as CloudflareApiResponse<LifecycleConfiguration>;
            logInfo(`Successfully retrieved lifecycle rules for bucket: ${bucketName}`, {
                module: 'lifecycle',
                operation: 'get',
                bucketName,
                metadata: { ruleCount: data.result?.rules?.length ?? 0 }
            });

            return new Response(JSON.stringify({
                success: true,
                result: data.result
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        // PUT - Set lifecycle rules
        if (request.method === 'PUT') {
            const body = await request.json() as { rules: LifecycleRule[] };

            if (body.rules === undefined || body.rules === null || !Array.isArray(body.rules)) {
                return createErrorResponse('Invalid request body: rules array required', corsHeaders, 400);
            }

            logInfo(`Setting lifecycle rules for bucket: ${bucketName}`, {
                module: 'lifecycle',
                operation: 'set',
                bucketName,
                metadata: { ruleCount: body.rules.length }
            });

            // Mock response for local development
            if (isLocalDev) {
                logInfo('Simulating lifecycle rules update for local development', {
                    module: 'lifecycle',
                    operation: 'set',
                    bucketName
                });
                return new Response(JSON.stringify({
                    success: true,
                    result: { rules: body.rules }
                }), {
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }

            // Cloudflare REST API call
            const response = await fetch(
                `${CF_API}/accounts/${env.ACCOUNT_ID}/r2/buckets/${encodeURIComponent(bucketName)}/lifecycle`,
                {
                    method: 'PUT',
                    headers: {
                        ...cfHeaders,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ rules: body.rules })
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as { errors?: { message: string }[] };
                const errorMessage = errorData.errors?.[0]?.message ?? 'Failed to set lifecycle rules';
                void logError(env, new Error(errorMessage), {
                    module: 'lifecycle',
                    operation: 'set',
                    bucketName,
                    metadata: { status: response.status }
                }, isLocalDev);
                return createErrorResponse(errorMessage, corsHeaders, response.status);
            }

            const data = await response.json() as CloudflareApiResponse<LifecycleConfiguration>;
            logInfo(`Successfully updated lifecycle rules for bucket: ${bucketName}`, {
                module: 'lifecycle',
                operation: 'set',
                bucketName,
                metadata: { ruleCount: body.rules.length }
            });

            return new Response(JSON.stringify({
                success: true,
                result: data.result ?? { rules: body.rules }
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        // Method not allowed
        return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

    } catch (err) {
        void logError(env, err instanceof Error ? err : new Error(String(err)), {
            module: 'lifecycle',
            operation: 'handle'
        }, isLocalDev);
        return createErrorResponse('Lifecycle operation failed', corsHeaders, 500);
    }
}
