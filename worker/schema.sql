-- R2 Manager Job History Schema
-- Run this to create the necessary tables in your D1 database:
-- wrangler d1 execute r2-manager-metadata --remote --file=worker/schema.sql

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
    metadata TEXT -- JSON string for operation-specific data
);

-- Indexes for common queries
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
    details TEXT, -- JSON string for event-specific data
    FOREIGN KEY (job_id) REFERENCES bulk_jobs(job_id) ON DELETE CASCADE
);

-- Indexes for job events
CREATE INDEX IF NOT EXISTS idx_job_events_job ON job_audit_events(job_id);
CREATE INDEX IF NOT EXISTS idx_job_events_timestamp ON job_audit_events(timestamp DESC);

-- Audit log table for tracking individual user actions
-- This complements bulk_jobs by tracking instant single-item operations
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
    metadata TEXT, -- JSON string for operation-specific data
    size_bytes INTEGER,
    destination_bucket TEXT,
    destination_key TEXT
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_log_operation ON audit_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_bucket ON audit_log(bucket_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_status ON audit_log(status);
