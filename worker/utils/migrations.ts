/**
 * Database Migration System
 *
 * Provides automated schema migrations for the R2 Manager metadata database.
 * Tracks applied migrations in the schema_version table and applies pending
 * migrations when triggered by the user via the UI upgrade banner.
 */

import { logInfo, logError, logWarning } from "./error-logger";

// ============================================
// Types
// ============================================

export interface Migration {
  version: number;
  name: string;
  description: string;
  sql: string;
}

export interface MigrationStatus {
  currentVersion: number;
  latestVersion: number;
  pendingMigrations: Migration[];
  appliedMigrations: AppliedMigration[];
  isUpToDate: boolean;
}

export interface AppliedMigration {
  version: number;
  migration_name: string;
  applied_at: string;
}

export interface MigrationResult {
  success: boolean;
  migrationsApplied: number;
  currentVersion: number;
  errors: string[];
}

export interface LegacyInstallationInfo {
  isLegacy: boolean;
  existingTables: string[];
  suggestedVersion: number;
}

// ============================================
// Migration Registry
// ============================================

/**
 * All migrations in order. Each migration should be idempotent where possible
 * (using IF NOT EXISTS, etc.) to handle edge cases gracefully.
 *
 * IMPORTANT: Never modify existing migrations. Always add new ones.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    description:
      "Base schema with bulk_jobs, job_audit_events, audit_log tables",
    sql: `
      -- Jobs table to track bulk operations
      CREATE TABLE IF NOT EXISTS bulk_jobs (
        job_id TEXT PRIMARY KEY,
        bucket_name TEXT NOT NULL,
        operation_type TEXT NOT NULL CHECK (operation_type IN (
          'bulk_upload',
          'bulk_download', 
          'bulk_delete',
          'bucket_delete',
          'file_move',
          'file_copy',
          'folder_move',
          'folder_copy',
          'ai_search_sync'
        )),
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
          'queued',
          'running',
          'completed',
          'failed',
          'cancelled'
        )),
        total_items INTEGER,
        processed_items INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        percentage REAL DEFAULT 0,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        user_email TEXT NOT NULL,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_bulk_jobs_bucket ON bulk_jobs(bucket_name);
      CREATE INDEX IF NOT EXISTS idx_bulk_jobs_status ON bulk_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_bulk_jobs_operation ON bulk_jobs(operation_type);
      CREATE INDEX IF NOT EXISTS idx_bulk_jobs_started ON bulk_jobs(started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bulk_jobs_user ON bulk_jobs(user_email);

      -- Job audit events table for detailed operation timeline
      CREATE TABLE IF NOT EXISTS job_audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        user_email TEXT NOT NULL,
        timestamp TEXT DEFAULT (datetime('now')),
        details TEXT,
        FOREIGN KEY (job_id) REFERENCES bulk_jobs(job_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_job_events_job ON job_audit_events(job_id);
      CREATE INDEX IF NOT EXISTS idx_job_events_timestamp ON job_audit_events(timestamp DESC);

      -- Audit log table for tracking individual user actions
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_type TEXT NOT NULL CHECK (operation_type IN (
          'file_upload',
          'file_download',
          'file_delete',
          'file_rename',
          'file_move',
          'file_copy',
          'bucket_create',
          'bucket_delete',
          'bucket_rename',
          'folder_create',
          'folder_delete',
          'folder_rename',
          'folder_move',
          'folder_copy'
        )),
        bucket_name TEXT,
        object_key TEXT,
        user_email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'success' CHECK (status IN (
          'success',
          'failed'
        )),
        timestamp TEXT DEFAULT (datetime('now')),
        metadata TEXT,
        size_bytes INTEGER,
        destination_bucket TEXT,
        destination_key TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_audit_log_operation ON audit_log(operation_type);
      CREATE INDEX IF NOT EXISTS idx_audit_log_bucket ON audit_log(bucket_name);
      CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_email);
      CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_log_status ON audit_log(status);
    `,
  },
  {
    version: 2,
    name: "webhooks",
    description: "Add webhooks table for event notifications",
    sql: `
      CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        secret TEXT,
        events TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled);
    `,
  },
  {
    version: 3,
    name: "bucket_tags",
    description:
      "Add bucket_tags table for custom text-based bucket organization",
    sql: `
      CREATE TABLE IF NOT EXISTS bucket_tags (
        bucket_name TEXT NOT NULL,
        tag TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        created_by TEXT,
        PRIMARY KEY (bucket_name, tag)
      );

      CREATE INDEX IF NOT EXISTS idx_bucket_tags_bucket ON bucket_tags(bucket_name);
      CREATE INDEX IF NOT EXISTS idx_bucket_tags_tag ON bucket_tags(tag);
      CREATE INDEX IF NOT EXISTS idx_bucket_tags_created ON bucket_tags(created_at DESC);
    `,
  },
  {
    version: 4,
    name: "bucket_colors",
    description: "Add bucket_colors table for visual bucket organization",
    sql: `
      CREATE TABLE IF NOT EXISTS bucket_colors (
        bucket_name TEXT PRIMARY KEY,
        color TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now')),
        updated_by TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_bucket_colors_updated ON bucket_colors(updated_at DESC);
    `,
  },
];

// ============================================
// Migration Functions
// ============================================

/**
 * Ensures the schema_version table exists.
 * This is called before any migration checks.
 */
export async function ensureSchemaVersionTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      migration_name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `,
    )
    .run();
}

/**
 * Gets the current schema version from the database.
 * Returns 0 if no migrations have been applied yet.
 */
export async function getCurrentVersion(db: D1Database): Promise<number> {
  try {
    const result = await db
      .prepare("SELECT MAX(version) as version FROM schema_version")
      .first<{ version: number | null }>();

    return result?.version ?? 0;
  } catch {
    // Table might not exist yet
    return 0;
  }
}

/**
 * Gets all applied migrations from the database.
 */
export async function getAppliedMigrations(
  db: D1Database,
): Promise<AppliedMigration[]> {
  try {
    const result = await db
      .prepare(
        "SELECT version, migration_name, applied_at FROM schema_version ORDER BY version ASC",
      )
      .all<AppliedMigration>();

    return result.results;
  } catch {
    return [];
  }
}

/**
 * Gets the migration status including current version and pending migrations.
 */
export async function getMigrationStatus(
  db: D1Database,
): Promise<MigrationStatus> {
  await ensureSchemaVersionTable(db);

  const currentVersion = await getCurrentVersion(db);
  const appliedMigrations = await getAppliedMigrations(db);
  const lastMigration = MIGRATIONS[MIGRATIONS.length - 1];
  const latestVersion = lastMigration?.version ?? 0;

  const pendingMigrations = MIGRATIONS.filter(
    (m) => m.version > currentVersion,
  );

  return {
    currentVersion,
    latestVersion,
    pendingMigrations,
    appliedMigrations,
    isUpToDate: currentVersion >= latestVersion,
  };
}

/**
 * Applies all pending migrations in order.
 * Returns the result of the migration process.
 */
export async function applyMigrations(
  db: D1Database,
  isLocalDev = false,
): Promise<MigrationResult> {
  const errors: string[] = [];
  let migrationsApplied = 0;

  try {
    await ensureSchemaVersionTable(db);
    const currentVersion = await getCurrentVersion(db);
    const pendingMigrations = MIGRATIONS.filter(
      (m) => m.version > currentVersion,
    );

    if (pendingMigrations.length === 0) {
      logInfo("No pending migrations", {
        module: "migrations",
        operation: "apply",
      });
      return {
        success: true,
        migrationsApplied: 0,
        currentVersion,
        errors: [],
      };
    }

    logInfo(`Applying ${pendingMigrations.length} migration(s)`, {
      module: "migrations",
      operation: "apply",
      metadata: {
        currentVersion,
        pendingCount: pendingMigrations.length,
        migrations: pendingMigrations.map((m) => m.name),
      },
    });

    for (const migration of pendingMigrations) {
      try {
        logInfo(`Applying migration ${migration.version}: ${migration.name}`, {
          module: "migrations",
          operation: "apply_single",
          metadata: { version: migration.version, name: migration.name },
        });

        // Split SQL into individual statements and execute each
        const statements = migration.sql
          .split(";")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const statement of statements) {
          await db.prepare(statement).run();
        }

        // Record the migration as applied
        await db
          .prepare(
            "INSERT INTO schema_version (version, migration_name) VALUES (?, ?)",
          )
          .bind(migration.version, migration.name)
          .run();

        migrationsApplied++;

        logInfo(`Migration ${migration.version} applied successfully`, {
          module: "migrations",
          operation: "apply_single",
          metadata: { version: migration.version, name: migration.name },
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push(
          `Migration ${migration.version} (${migration.name}): ${errorMessage}`,
        );

        void logError(
          { METADATA: db } as Parameters<typeof logError>[0],
          `Failed to apply migration ${migration.version}: ${errorMessage}`,
          {
            module: "migrations",
            operation: "apply_single",
            metadata: {
              version: migration.version,
              name: migration.name,
              error: errorMessage,
            },
          },
          isLocalDev,
        );

        // Stop on first error - don't apply further migrations
        break;
      }
    }

    const newVersion = await getCurrentVersion(db);

    return {
      success: errors.length === 0,
      migrationsApplied,
      currentVersion: newVersion,
      errors,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    errors.push(`Migration system error: ${errorMessage}`);

    logWarning(`Migration system error: ${errorMessage}`, {
      module: "migrations",
      operation: "apply",
      metadata: { error: errorMessage },
    });

    const currentVersion = await getCurrentVersion(db).catch(() => 0);

    return {
      success: false,
      migrationsApplied,
      currentVersion,
      errors,
    };
  }
}

/**
 * Detects if the database has existing tables but no schema_version tracking.
 * This helps identify installations that predate the migration system.
 */
export async function detectLegacyInstallation(
  db: D1Database,
): Promise<LegacyInstallationInfo> {
  try {
    // Check for existing tables
    const result = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_version'",
      )
      .all<{ name: string }>();

    const existingTables = result.results.map((r) => r.name);

    // Check if schema_version exists and has entries
    const versionCheck = await getCurrentVersion(db);

    if (versionCheck > 0) {
      // Already tracking versions
      return {
        isLegacy: false,
        existingTables,
        suggestedVersion: versionCheck,
      };
    }

    // Detect which migrations have effectively been applied based on existing tables
    let suggestedVersion = 0;

    if (
      existingTables.includes("bulk_jobs") &&
      existingTables.includes("audit_log")
    ) {
      suggestedVersion = 1;
    }
    if (existingTables.includes("webhooks")) {
      suggestedVersion = 2;
    }
    if (existingTables.includes("bucket_tags")) {
      suggestedVersion = 3;
    }
    if (existingTables.includes("bucket_colors")) {
      suggestedVersion = 4;
    }

    return {
      isLegacy: suggestedVersion > 0,
      existingTables,
      suggestedVersion,
    };
  } catch {
    return { isLegacy: false, existingTables: [], suggestedVersion: 0 };
  }
}

/**
 * Marks migrations as applied without running them.
 * Used for legacy installations that already have the tables.
 */
export async function markMigrationsAsApplied(
  db: D1Database,
  upToVersion: number,
): Promise<void> {
  await ensureSchemaVersionTable(db);

  const migrationsToMark = MIGRATIONS.filter((m) => m.version <= upToVersion);

  for (const migration of migrationsToMark) {
    // Check if already marked
    const existing = await db
      .prepare("SELECT version FROM schema_version WHERE version = ?")
      .bind(migration.version)
      .first();

    if (!existing) {
      await db
        .prepare(
          "INSERT INTO schema_version (version, migration_name) VALUES (?, ?)",
        )
        .bind(migration.version, migration.name)
        .run();

      logInfo(`Marked migration ${migration.version} as applied (legacy)`, {
        module: "migrations",
        operation: "mark_applied",
        metadata: { version: migration.version, name: migration.name },
      });
    }
  }
}
