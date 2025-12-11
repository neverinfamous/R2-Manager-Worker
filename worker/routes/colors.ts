/**
 * Color Routes
 * 
 * API endpoints for managing bucket color tags for visual organization.
 * Colors are stored in the bucket_colors table in the D1 metadata database.
 */

import type { Env } from '../types';
import type { CorsHeaders } from '../utils/cors';
import { logInfo, logWarning } from '../utils/error-logger';

/**
 * Valid color options for bucket organization
 */
export type BucketColorValue =
    | 'red' | 'red-light' | 'red-dark'
    | 'orange' | 'orange-light' | 'amber'
    | 'yellow' | 'yellow-light' | 'lime'
    | 'green' | 'green-light' | 'emerald'
    | 'teal' | 'cyan' | 'sky'
    | 'blue' | 'blue-light' | 'indigo'
    | 'purple' | 'violet' | 'fuchsia'
    | 'pink' | 'rose' | 'pink-light'
    | 'gray' | 'slate' | 'zinc'
    | null;

const VALID_COLORS = [
    // Reds & Pinks
    'red', 'red-light', 'red-dark', 'rose', 'pink-light', 'pink',
    // Oranges & Yellows
    'orange', 'orange-light', 'amber', 'yellow', 'yellow-light', 'lime',
    // Greens & Teals
    'green', 'green-light', 'emerald', 'teal', 'cyan', 'sky',
    // Blues & Purples
    'blue', 'blue-light', 'indigo', 'violet', 'purple', 'fuchsia',
    // Neutrals
    'slate', 'gray', 'zinc'
];

// Helper to create response headers with CORS
function jsonHeaders(corsHeaders: CorsHeaders): Headers {
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', 'application/json');
    return headers;
}

// Body type for color updates
interface ColorBody {
    color: string | null;
}

/**
 * Bucket color record from the database
 */
interface BucketColorRecord {
    bucket_name: string;
    color: string;
    updated_at: string;
    updated_by: string | null;
}

/**
 * Handle color-related API routes
 * 
 * Routes:
 * - GET /api/buckets/colors - Get all bucket colors
 * - PUT /api/buckets/:name/color - Update a bucket's color
 */
export async function handleColorRoutes(
    request: Request,
    env: Env,
    url: URL,
    corsHeaders: CorsHeaders,
    isLocalDev: boolean,
    userEmail: string | null
): Promise<Response | null> {
    const db = env.METADATA;

    // GET /api/buckets/colors - Get all bucket colors
    if (request.method === 'GET' && url.pathname === '/api/buckets/colors') {
        logInfo('Getting all bucket colors', { module: 'colors', operation: 'list' });

        if (isLocalDev) {
            // Mock response for local development
            return new Response(JSON.stringify({
                result: {
                    'mock-bucket-1': 'blue',
                    'mock-bucket-2': 'green'
                },
                success: true
            }), {
                headers: jsonHeaders(corsHeaders)
            });
        }

        if (!db) {
            return new Response(JSON.stringify({
                error: 'Database not configured',
                success: false
            }), {
                status: 500,
                headers: jsonHeaders(corsHeaders)
            });
        }

        try {
            const result = await db.prepare(
                'SELECT bucket_name, color FROM bucket_colors'
            ).all<BucketColorRecord>();

            // Convert to object map
            const colorMap: Record<string, string> = {};
            for (const row of result.results) {
                colorMap[row.bucket_name] = row.color;
            }

            return new Response(JSON.stringify({
                result: colorMap,
                success: true
            }), {
                headers: jsonHeaders(corsHeaders)
            });
        } catch (err) {
            logWarning(`[BUCKET_COLOR_LIST_FAILED] Failed to get bucket colors: ${err instanceof Error ? err.message : String(err)}`, { module: 'colors', operation: 'list' });
            // Return empty on error (table may not exist yet)
            return new Response(JSON.stringify({
                result: {},
                success: true
            }), {
                headers: jsonHeaders(corsHeaders)
            });
        }
    }

    // PUT /api/buckets/:name/color - Update bucket color
    if (request.method === 'PUT' && /^\/api\/buckets\/[^/]+\/color$/.exec(url.pathname)) {
        const bucketName = decodeURIComponent(url.pathname.split('/')[3] ?? '');
        logInfo(`Updating color for bucket: ${bucketName}`, { module: 'colors', operation: 'update', metadata: { bucketName } });

        let body: ColorBody;
        try {
            body = await request.json() as ColorBody;
        } catch {
            return new Response(JSON.stringify({
                error: 'Invalid request body',
                message: 'Request body must be valid JSON with a color property',
                success: false
            }), {
                status: 400,
                headers: jsonHeaders(corsHeaders)
            });
        }

        const color = body.color;

        // Validate color
        if (color !== null && !VALID_COLORS.includes(color)) {
            return new Response(JSON.stringify({
                error: 'Invalid color',
                message: `Color must be one of: ${VALID_COLORS.join(', ')}, or null`,
                success: false
            }), {
                status: 400,
                headers: jsonHeaders(corsHeaders)
            });
        }

        if (isLocalDev) {
            // Mock response for local development
            return new Response(JSON.stringify({
                result: { bucket_name: bucketName, color },
                success: true
            }), {
                headers: jsonHeaders(corsHeaders)
            });
        }

        if (!db) {
            return new Response(JSON.stringify({
                error: 'Database not configured',
                success: false
            }), {
                status: 500,
                headers: jsonHeaders(corsHeaders)
            });
        }

        try {
            if (color === null) {
                // Remove color
                await db.prepare(
                    'DELETE FROM bucket_colors WHERE bucket_name = ?'
                ).bind(bucketName).run();
            } else {
                // Upsert color
                await db.prepare(
                    `INSERT INTO bucket_colors (bucket_name, color, updated_at, updated_by)
                     VALUES (?, ?, datetime('now'), ?)
                     ON CONFLICT(bucket_name) DO UPDATE SET
                       color = excluded.color,
                       updated_at = excluded.updated_at,
                       updated_by = excluded.updated_by`
                ).bind(bucketName, color, userEmail ?? 'unknown').run();
            }

            return new Response(JSON.stringify({
                result: { bucket_name: bucketName, color },
                success: true
            }), {
                headers: jsonHeaders(corsHeaders)
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            logWarning(`[BUCKET_COLOR_UPDATE_FAILED] Failed to update color: ${errorMessage}`, { module: 'colors', operation: 'update', metadata: { bucketName } });

            // Check if error is due to missing table (user needs to run migration)
            if (errorMessage.includes('no such table: bucket_colors')) {
                return new Response(JSON.stringify({
                    error: 'Database upgrade required',
                    message: 'The bucket colors feature requires a schema update. Please use the upgrade banner to apply pending migrations.',
                    requiresUpgrade: true,
                    success: false
                }), {
                    status: 503,
                    headers: jsonHeaders(corsHeaders)
                });
            }

            return new Response(JSON.stringify({
                error: 'Failed to update color',
                message: 'An error occurred while updating the bucket color',
                success: false
            }), {
                status: 500,
                headers: jsonHeaders(corsHeaders)
            });
        }
    }

    // Route not handled
    return null;
}
