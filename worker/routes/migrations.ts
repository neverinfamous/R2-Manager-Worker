/**
 * Migration Routes
 * 
 * API endpoints for managing database schema migrations.
 * Provides status checking and migration application functionality.
 */

import type { Env } from '../types';
import type { CorsHeaders } from '../utils/cors';
import {
    getMigrationStatus,
    applyMigrations,
    detectLegacyInstallation,
    markMigrationsAsApplied,
    type MigrationStatus,
    type MigrationResult,
    type LegacyInstallationInfo
} from '../utils/migrations';
import { logInfo, logWarning, logError } from '../utils/error-logger';

interface ErrorContext {
    module: string;
    operation: string;
    userId?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Helper to create JSON response headers
 */
function jsonHeaders(corsHeaders: CorsHeaders): Headers {
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', 'application/json');
    return headers;
}

/**
 * Helper to create error context with optional userId
 */
function createContext(
    module: string,
    operation: string,
    userEmail: string | null,
    metadata?: Record<string, unknown>
): ErrorContext {
    const ctx: ErrorContext = { module, operation };
    if (userEmail) {
        ctx.userId = userEmail;
    }
    if (metadata) {
        ctx.metadata = metadata;
    }
    return ctx;
}

/**
 * Handle migration-related API routes
 * 
 * Routes:
 * - GET /api/migrations/status - Get current migration status
 * - POST /api/migrations/apply - Apply all pending migrations
 * - POST /api/migrations/mark-legacy - Mark migrations as applied for legacy installations
 */
export async function handleMigrationRoutes(
    request: Request,
    env: Env,
    url: URL,
    corsHeaders: CorsHeaders,
    isLocalDev: boolean,
    userEmail: string | null
): Promise<Response | null> {
    // GET /api/migrations/status - Get migration status
    if (request.method === 'GET' && url.pathname === '/api/migrations/status') {
        logInfo('Checking migration status', createContext('migrations', 'status', userEmail));

        if (isLocalDev) {
            // In local dev, return mock status showing up-to-date
            const mockStatus: MigrationStatus = {
                currentVersion: 4,
                latestVersion: 4,
                pendingMigrations: [],
                appliedMigrations: [
                    { version: 1, migration_name: 'initial_schema', applied_at: new Date().toISOString() },
                    { version: 2, migration_name: 'webhooks', applied_at: new Date().toISOString() },
                    { version: 3, migration_name: 'bucket_tags', applied_at: new Date().toISOString() },
                    { version: 4, migration_name: 'bucket_colors', applied_at: new Date().toISOString() }
                ],
                isUpToDate: true
            };

            return new Response(JSON.stringify({
                result: mockStatus,
                success: true
            }), {
                headers: jsonHeaders(corsHeaders)
            });
        }

        const db = env.METADATA;
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
            const status = await getMigrationStatus(db);

            // Also check for legacy installation
            const legacyInfo = await detectLegacyInstallation(db);

            return new Response(JSON.stringify({
                result: {
                    ...status,
                    legacy: legacyInfo
                },
                success: true
            }), {
                headers: jsonHeaders(corsHeaders)
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logWarning(`Failed to get migration status: ${errorMessage}`, createContext('migrations', 'status', userEmail));

            return new Response(JSON.stringify({
                error: 'Failed to get migration status',
                success: false
            }), {
                status: 500,
                headers: jsonHeaders(corsHeaders)
            });
        }
    }

    // POST /api/migrations/apply - Apply pending migrations
    if (request.method === 'POST' && url.pathname === '/api/migrations/apply') {
        logInfo('Applying migrations', createContext('migrations', 'apply', userEmail));

        if (isLocalDev) {
            // In local dev, return mock success
            const mockResult: MigrationResult = {
                success: true,
                migrationsApplied: 0,
                currentVersion: 4,
                errors: []
            };

            return new Response(JSON.stringify({
                result: mockResult,
                success: true
            }), {
                headers: jsonHeaders(corsHeaders)
            });
        }

        const db = env.METADATA;
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
            const result = await applyMigrations(db, isLocalDev);

            if (result.success) {
                logInfo(
                    `Successfully applied ${result.migrationsApplied} migration(s)`,
                    createContext('migrations', 'apply', userEmail, {
                        migrationsApplied: result.migrationsApplied,
                        currentVersion: result.currentVersion
                    })
                );
            } else {
                void logError(
                    env,
                    `Migration failed: ${result.errors.join(', ')}`,
                    createContext('migrations', 'apply', userEmail, { errors: result.errors }),
                    isLocalDev
                );
            }

            return new Response(JSON.stringify({
                result,
                success: result.success
            }), {
                status: result.success ? 200 : 500,
                headers: jsonHeaders(corsHeaders)
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            void logError(
                env,
                `Failed to apply migrations: ${errorMessage}`,
                createContext('migrations', 'apply', userEmail),
                isLocalDev
            );

            return new Response(JSON.stringify({
                error: 'Failed to apply migrations',
                success: false
            }), {
                status: 500,
                headers: jsonHeaders(corsHeaders)
            });
        }
    }

    // POST /api/migrations/mark-legacy - Mark migrations as applied for legacy installations
    if (request.method === 'POST' && url.pathname === '/api/migrations/mark-legacy') {
        logInfo('Marking legacy migrations', createContext('migrations', 'mark_legacy', userEmail));

        if (isLocalDev) {
            return new Response(JSON.stringify({
                result: { markedUpTo: 3 },
                success: true
            }), {
                headers: jsonHeaders(corsHeaders)
            });
        }

        try {
            // Parse request body for version to mark up to
            const body = await request.json() as { version?: number };
            const targetVersion = body.version;

            if (typeof targetVersion !== 'number' || targetVersion < 1) {
                return new Response(JSON.stringify({
                    error: 'Invalid version',
                    message: 'Please provide a valid version number to mark as applied',
                    success: false
                }), {
                    status: 400,
                    headers: jsonHeaders(corsHeaders)
                });
            }

            const db = env.METADATA;
            if (!db) {
                return new Response(JSON.stringify({
                    error: 'Database not configured',
                    success: false
                }), {
                    status: 500,
                    headers: jsonHeaders(corsHeaders)
                });
            }

            // First verify this looks like a legacy installation
            const legacyInfo: LegacyInstallationInfo = await detectLegacyInstallation(db);

            if (!legacyInfo.isLegacy && legacyInfo.suggestedVersion === 0) {
                return new Response(JSON.stringify({
                    error: 'Not a legacy installation',
                    message: 'This installation does not appear to have pre-existing tables. Use the regular apply endpoint instead.',
                    success: false
                }), {
                    status: 400,
                    headers: jsonHeaders(corsHeaders)
                });
            }

            await markMigrationsAsApplied(db, targetVersion);

            logInfo(
                `Marked migrations up to version ${targetVersion} as applied`,
                createContext('migrations', 'mark_legacy', userEmail, { version: targetVersion })
            );

            return new Response(JSON.stringify({
                result: { markedUpTo: targetVersion },
                success: true
            }), {
                headers: jsonHeaders(corsHeaders)
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logWarning(`Failed to mark legacy migrations: ${errorMessage}`, createContext('migrations', 'mark_legacy', userEmail));

            return new Response(JSON.stringify({
                error: 'Failed to mark migrations',
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
