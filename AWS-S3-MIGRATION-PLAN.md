# AWS S3 to Cloudflare R2 Migration Feature Plan

## Executive Summary

This document outlines the comprehensive plan to add AWS S3 migration capabilities to the R2 Bucket Manager. The feature will enable users to migrate data from AWS S3 buckets to Cloudflare R2 buckets directly through the web interface, supporting both one-time bulk migrations and incremental sync operations.

### Key Goals

1. **Seamless Migration** - Enable users to migrate S3 buckets to R2 without command-line tools
2. **Progress Tracking** - Real-time visibility into migration status and progress
3. **Error Handling** - Robust retry logic and detailed error reporting
4. **Security** - Secure handling of AWS credentials with no persistent storage
5. **Flexibility** - Support for filtering by prefix, size, and date ranges
6. **Cost Awareness** - Display estimated data transfer costs and bandwidth usage

---

## Table of Contents

1. [Background & Research](#background--research)
2. [Architecture Overview](#architecture-overview)
3. [Feature Specifications](#feature-specifications)
4. [Implementation Plan](#implementation-plan)
5. [Database Schema Changes](#database-schema-changes)
6. [API Endpoints](#api-endpoints)
7. [Frontend Components](#frontend-components)
8. [Security Considerations](#security-considerations)
9. [Testing Strategy](#testing-strategy)
10. [Deployment & Rollout](#deployment--rollout)
11. [Future Enhancements](#future-enhancements)

---

## Background & Research

### Cloudflare's Built-in Migration Tools

Cloudflare provides two native migration tools:

#### 1. Super Slurper (Dashboard-based)
- **Purpose:** One-time bulk migration from S3/GCS to R2
- **Access:** Cloudflare Dashboard only (not API-accessible)
- **Features:**
  - Copies objects from AWS S3, GCS, or other S3-compatible storage
  - Preserves metadata and custom headers
  - Supports prefix filtering for partial migrations
  - Concurrent job support (3 jobs maximum)
  - Objects >1TB are skipped
  - Archive storage classes (Glacier) are skipped
- **Limitations:**
  - No programmatic API access
  - Cannot be integrated into custom applications
  - No fine-grained control over transfer rates

#### 2. Sippy (Incremental/On-demand)
- **Purpose:** Incremental migration triggered by object access
- **Access:** Dashboard configuration + S3 API
- **Features:**
  - Copies objects on-demand when requested
  - Reduces upfront egress costs
  - Suitable for frequently-accessed data
  - Combines with Super Slurper for hybrid strategies
- **Limitations:**
  - Not suitable for bulk migrations
  - Requires objects to be requested to trigger copy
  - Best used during live traffic scenarios

### Why Build a Custom Migration Feature?

Since Cloudflare's native tools are dashboard-only, we need to implement our own migration system using:
1. **AWS S3 SDK** - To list and download objects from S3
2. **Cloudflare R2 REST API** - To upload objects to R2
3. **Cloudflare Workers** - To orchestrate the migration process
4. **D1 Database** - To track migration jobs and progress

This approach provides:
- **UI Integration** - Seamless experience within R2 Bucket Manager
- **Custom Logic** - Advanced filtering, scheduling, and error handling
- **Progress Tracking** - Real-time status updates and detailed logs
- **Flexibility** - Support for partial migrations and incremental syncs

### AWS S3 API Compatibility

#### Authentication Methods

**AWS S3 Credentials:**
- **Access Key ID** - Public identifier (e.g., `AKIAIOSFODNN7EXAMPLE`)
- **Secret Access Key** - Private key for signing requests
- **Region** - AWS region where bucket resides (e.g., `us-east-1`)

**Recommended IAM Policy (Read-Only):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetObject",
        "s3:GetObjectMetadata"
      ],
      "Resource": [
        "arn:aws:s3:::source-bucket-name",
        "arn:aws:s3:::source-bucket-name/*"
      ]
    }
  ]
}
```

#### Cloudflare R2 S3 API Compatibility

Cloudflare R2 implements the AWS S3 API with high compatibility:
- **Endpoint:** `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- **Region:** `auto` (or `us-east-1` for compatibility)
- **Supported Operations:**
  - ✅ ListObjectsV2
  - ✅ GetObject
  - ✅ PutObject
  - ✅ HeadObject
  - ✅ CopyObject
  - ✅ DeleteObject
  - ✅ MultipartUpload operations

---

## Architecture Overview

### High-Level Flow

```
┌─────────────────────┐
│  User Interface     │
│  (React Frontend)   │
└──────────┬──────────┘
           │
           │ 1. Configure Migration Job
           │    - AWS credentials
           │    - Source bucket/prefix
           │    - Destination R2 bucket
           │    - Filters & options
           │
           ▼
┌─────────────────────────────────────────┐
│  Cloudflare Worker                      │
│  (Migration Orchestrator)               │
│                                         │
│  ┌────────────────────────────────────┐│
│  │  Job Manager                       ││
│  │  - Validate credentials            ││
│  │  - Create migration job            ││
│  │  - Store job metadata in D1       ││
│  └────────────────────────────────────┘│
│                                         │
│  ┌────────────────────────────────────┐│
│  │  Migration Engine                  ││
│  │  - List S3 objects                 ││
│  │  - Download from S3                ││
│  │  - Upload to R2                    ││
│  │  - Update progress in D1           ││
│  └────────────────────────────────────┘│
│                                         │
│  ┌────────────────────────────────────┐│
│  │  Error Handler                     ││
│  │  - Retry failed transfers          ││
│  │  - Log errors to D1                ││
│  │  - Notify user of issues           ││
│  └────────────────────────────────────┘│
└─────────────────────────────────────────┘
           │
           │ 2. Execute Migration
           │
           ▼
┌───────────────────────────────────┐
│  AWS S3 Bucket                    │
│  - List objects                   │
│  - Download objects               │
│  - Preserve metadata              │
└───────────────────────────────────┘
           │
           │ 3. Transfer Data
           │
           ▼
┌───────────────────────────────────┐
│  Cloudflare R2 Bucket             │
│  - Upload objects                 │
│  - Maintain folder structure      │
│  - Copy metadata                  │
└───────────────────────────────────┘
           │
           │ 4. Track Progress
           │
           ▼
┌───────────────────────────────────┐
│  D1 Database                      │
│  - Migration jobs table           │
│  - Transfer logs table            │
│  - Error logs table               │
└───────────────────────────────────┘
```

### Component Breakdown

#### 1. Frontend (React)
- **Migration Configuration UI** - Form for AWS credentials and migration options
- **Job Status Dashboard** - Real-time progress display
- **Error Viewer** - Detailed error logs with retry actions
- **Cost Estimator** - Calculate estimated AWS egress costs

#### 2. Backend (Cloudflare Worker)
- **Job Manager** - Create, pause, resume, cancel migration jobs
- **S3 Client** - Interface with AWS S3 API using `@aws-sdk/client-s3`
- **R2 Client** - Upload objects via Cloudflare REST API
- **Progress Tracker** - Update D1 with real-time status
- **Error Handler** - Retry logic and error reporting

#### 3. Database (D1)
- **migration_jobs** - Job metadata and status
- **migration_objects** - Individual object transfer status
- **migration_errors** - Detailed error logs

---

## Feature Specifications

### Core Features

#### 1. Migration Job Configuration

**User Inputs:**
- AWS Access Key ID (encrypted in transit only, never stored)
- AWS Secret Access Key (encrypted in transit only, never stored)
- AWS Region (e.g., `us-east-1`)
- Source S3 Bucket Name
- Source Prefix (optional, for partial migration)
- Destination R2 Bucket
- Destination Prefix (optional, for folder mapping)

**Advanced Options:**
- **Filter by Extension** - Only migrate specific file types
- **Filter by Size** - Min/max file size thresholds
- **Filter by Date** - Only migrate files modified after/before specific dates
- **Overwrite Policy:**
  - Skip existing files
  - Overwrite all files
  - Overwrite if newer
  - Overwrite if size differs
- **Concurrency Level** - Number of parallel transfers (1-10)
- **Bandwidth Limit** - Throttle transfer rate (optional)

#### 2. Migration Execution

**Phases:**
1. **Validation** - Verify AWS and R2 credentials
2. **Discovery** - List all objects in source bucket matching filters
3. **Planning** - Calculate total objects, size, estimated time
4. **Transfer** - Copy objects from S3 to R2
5. **Verification** - Confirm successful transfers (optional)
6. **Cleanup** - Mark job as complete

**Transfer Process:**
- Stream objects directly (no disk storage)
- Preserve metadata (Content-Type, custom headers)
- Support multipart uploads for large files (>100MB)
- Implement exponential backoff retry logic

#### 3. Progress Tracking

**Real-time Metrics:**
- Objects transferred / total objects
- Bytes transferred / total bytes
- Current transfer rate (MB/s)
- Estimated time remaining
- Success rate (successful / failed transfers)

**Job States:**
- `pending` - Job created, not yet started
- `running` - Actively transferring objects
- `paused` - User-paused or rate-limited
- `completed` - All objects transferred successfully
- `failed` - Job encountered fatal error
- `cancelled` - User cancelled the job
- `partial` - Some objects transferred, some failed

#### 4. Error Handling

**Retry Logic:**
- Automatic retry with exponential backoff (3 attempts default)
- Retry delays: 1s, 2s, 4s, 8s, 16s
- Skip object after max retries, mark as failed
- User can manually retry failed objects

**Error Types:**
- AWS authentication errors
- Network timeouts
- Rate limiting (429 Too Many Requests)
- Object not found (404)
- Insufficient permissions (403)
- R2 upload failures

**Error Logging:**
- Timestamp
- Object key
- Error message
- HTTP status code
- Retry count

---

## Implementation Plan

### Phase 1: Database Schema & Backend Foundation (Week 1)

#### Tasks:
1. ✅ Design D1 database schema for migration tracking
2. ✅ Create database migration script
3. ✅ Implement AWS S3 SDK integration in Worker
4. ✅ Add API endpoints for job management
5. ✅ Implement basic transfer logic

#### Deliverables:
- Updated `schema.sql` with new tables
- Worker endpoints for CRUD operations on migration jobs
- S3 listing and download functionality
- R2 upload integration

### Phase 2: Migration Engine (Week 2)

#### Tasks:
1. ✅ Implement parallel transfer orchestration
2. ✅ Add retry logic with exponential backoff
3. ✅ Implement progress tracking in D1
4. ✅ Add metadata preservation
5. ✅ Implement filtering logic (prefix, size, date, extension)

#### Deliverables:
- Robust migration engine with error handling
- Real-time progress updates
- Filter support for selective migration

### Phase 3: Frontend UI (Week 3)

#### Tasks:
1. ✅ Create migration configuration form
2. ✅ Build job status dashboard
3. ✅ Implement progress visualizations (charts, progress bars)
4. ✅ Add error viewer and retry interface
5. ✅ Implement cost estimator

#### Deliverables:
- Complete UI for migration feature
- Real-time status updates via API polling
- User-friendly error handling

### Phase 4: Testing & Refinement (Week 4)

#### Tasks:
1. ✅ Unit tests for migration engine
2. ✅ Integration tests with test S3/R2 buckets
3. ✅ Load testing with large datasets
4. ✅ Security audit of credential handling
5. ✅ Documentation and user guides

#### Deliverables:
- Test suite with >80% coverage
- Performance benchmarks
- Security review report
- User documentation

### Phase 5: Deployment & Monitoring (Week 5)

#### Tasks:
1. ✅ Deploy to production
2. ✅ Monitor for errors and performance issues
3. ✅ Gather user feedback
4. ✅ Iterate based on feedback

#### Deliverables:
- Production-ready migration feature
- Monitoring dashboard
- User feedback incorporated

---

## Database Schema Changes

### New Tables

#### 1. `migration_jobs` Table

```sql
CREATE TABLE migration_jobs (
  job_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  job_name TEXT NOT NULL,
  
  -- Source configuration
  source_type TEXT NOT NULL DEFAULT 's3', -- 's3', 'gcs', 'azure' (future)
  source_bucket TEXT NOT NULL,
  source_prefix TEXT,
  source_region TEXT NOT NULL,
  
  -- Destination configuration
  dest_bucket TEXT NOT NULL,
  dest_prefix TEXT,
  
  -- Filter configuration (JSON)
  filters TEXT, -- JSON: {extensions: [], minSize: 0, maxSize: null, afterDate: null, beforeDate: null}
  
  -- Migration options (JSON)
  options TEXT, -- JSON: {overwritePolicy: 'skip', concurrency: 5, bandwidthLimit: null}
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, paused, completed, failed, cancelled
  total_objects INTEGER DEFAULT 0,
  total_bytes INTEGER DEFAULT 0,
  transferred_objects INTEGER DEFAULT 0,
  transferred_bytes INTEGER DEFAULT 0,
  failed_objects INTEGER DEFAULT 0,
  skipped_objects INTEGER DEFAULT 0,
  
  -- Timing
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  estimated_completion DATETIME,
  
  -- Error tracking
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_migration_jobs_user ON migration_jobs(user_id);
CREATE INDEX idx_migration_jobs_status ON migration_jobs(status);
CREATE INDEX idx_migration_jobs_created ON migration_jobs(created_at DESC);
```

#### 2. `migration_objects` Table

```sql
CREATE TABLE migration_objects (
  object_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  
  -- Object details
  source_key TEXT NOT NULL,
  dest_key TEXT NOT NULL,
  size INTEGER NOT NULL,
  content_type TEXT,
  last_modified DATETIME,
  etag TEXT,
  
  -- Transfer status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, failed, skipped
  transferred_at DATETIME,
  retry_count INTEGER DEFAULT 0,
  
  -- Error tracking
  error_message TEXT,
  error_code TEXT,
  
  FOREIGN KEY (job_id) REFERENCES migration_jobs(job_id) ON DELETE CASCADE
);

CREATE INDEX idx_migration_objects_job ON migration_objects(job_id);
CREATE INDEX idx_migration_objects_status ON migration_objects(status);
```

#### 3. `migration_errors` Table

```sql
CREATE TABLE migration_errors (
  error_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  object_key TEXT,
  
  error_type TEXT NOT NULL, -- auth, network, rate_limit, not_found, permission, upload_failed
  error_message TEXT NOT NULL,
  error_details TEXT, -- JSON with full error context
  http_status INTEGER,
  
  occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  
  FOREIGN KEY (job_id) REFERENCES migration_jobs(job_id) ON DELETE CASCADE
);

CREATE INDEX idx_migration_errors_job ON migration_errors(job_id);
CREATE INDEX idx_migration_errors_occurred ON migration_errors(occurred_at DESC);
```

### Schema Migration Script

```sql
-- Add migration tables to existing schema
-- Run with: wrangler d1 execute <database-name> --remote --file=worker/migrations/add_migration_tables.sql

-- Migration jobs table
CREATE TABLE IF NOT EXISTS migration_jobs (
  job_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  job_name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 's3',
  source_bucket TEXT NOT NULL,
  source_prefix TEXT,
  source_region TEXT NOT NULL,
  dest_bucket TEXT NOT NULL,
  dest_prefix TEXT,
  filters TEXT,
  options TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_objects INTEGER DEFAULT 0,
  total_bytes INTEGER DEFAULT 0,
  transferred_objects INTEGER DEFAULT 0,
  transferred_bytes INTEGER DEFAULT 0,
  failed_objects INTEGER DEFAULT 0,
  skipped_objects INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  estimated_completion DATETIME,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_migration_jobs_user ON migration_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_status ON migration_jobs(status);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_created ON migration_jobs(created_at DESC);

-- Migration objects table
CREATE TABLE IF NOT EXISTS migration_objects (
  object_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  source_key TEXT NOT NULL,
  dest_key TEXT NOT NULL,
  size INTEGER NOT NULL,
  content_type TEXT,
  last_modified DATETIME,
  etag TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  transferred_at DATETIME,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  error_code TEXT,
  FOREIGN KEY (job_id) REFERENCES migration_jobs(job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_migration_objects_job ON migration_objects(job_id);
CREATE INDEX IF NOT EXISTS idx_migration_objects_status ON migration_objects(status);

-- Migration errors table
CREATE TABLE IF NOT EXISTS migration_errors (
  error_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  object_key TEXT,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_details TEXT,
  http_status INTEGER,
  occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  FOREIGN KEY (job_id) REFERENCES migration_jobs(job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_migration_errors_job ON migration_errors(job_id);
CREATE INDEX IF NOT EXISTS idx_migration_errors_occurred ON migration_errors(occurred_at DESC);
```

---

## API Endpoints

### Migration Job Management

#### 1. Create Migration Job

**Endpoint:** `POST /api/migrate/jobs`

**Request Body:**
```json
{
  "jobName": "Production Images Migration",
  "source": {
    "type": "s3",
    "bucket": "my-s3-bucket",
    "prefix": "images/",
    "region": "us-east-1",
    "credentials": {
      "accessKeyId": "AKIAIOSFODNN7EXAMPLE",
      "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
    }
  },
  "destination": {
    "bucket": "my-r2-bucket",
    "prefix": "migrated/images/"
  },
  "filters": {
    "extensions": ["jpg", "png", "webp"],
    "minSize": 1024,
    "maxSize": 52428800,
    "afterDate": "2024-01-01T00:00:00Z"
  },
  "options": {
    "overwritePolicy": "skip",
    "concurrency": 5,
    "verifyTransfer": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "job": {
    "jobId": "mig_abc123xyz789",
    "status": "pending",
    "createdAt": "2025-10-23T10:30:00Z",
    "estimatedObjects": 1250,
    "estimatedBytes": 524288000
  }
}
```

#### 2. List Migration Jobs

**Endpoint:** `GET /api/migrate/jobs`

**Query Parameters:**
- `status` - Filter by job status (optional)
- `limit` - Max results (default: 20)
- `cursor` - Pagination cursor

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "jobId": "mig_abc123xyz789",
      "jobName": "Production Images Migration",
      "status": "running",
      "progress": {
        "totalObjects": 1250,
        "transferredObjects": 450,
        "totalBytes": 524288000,
        "transferredBytes": 189792000,
        "failedObjects": 2,
        "percentComplete": 36
      },
      "createdAt": "2025-10-23T10:30:00Z",
      "startedAt": "2025-10-23T10:31:00Z",
      "estimatedCompletion": "2025-10-23T11:15:00Z"
    }
  ],
  "pagination": {
    "cursor": "next_page_token",
    "hasMore": true
  }
}
```

#### 3. Get Job Details

**Endpoint:** `GET /api/migrate/jobs/:jobId`

**Response:**
```json
{
  "success": true,
  "job": {
    "jobId": "mig_abc123xyz789",
    "jobName": "Production Images Migration",
    "status": "running",
    "source": {
      "type": "s3",
      "bucket": "my-s3-bucket",
      "prefix": "images/",
      "region": "us-east-1"
    },
    "destination": {
      "bucket": "my-r2-bucket",
      "prefix": "migrated/images/"
    },
    "filters": {
      "extensions": ["jpg", "png", "webp"],
      "minSize": 1024,
      "maxSize": 52428800
    },
    "progress": {
      "totalObjects": 1250,
      "transferredObjects": 450,
      "failedObjects": 2,
      "skippedObjects": 10,
      "totalBytes": 524288000,
      "transferredBytes": 189792000,
      "percentComplete": 36,
      "transferRate": "2.5 MB/s"
    },
    "timing": {
      "createdAt": "2025-10-23T10:30:00Z",
      "startedAt": "2025-10-23T10:31:00Z",
      "estimatedCompletion": "2025-10-23T11:15:00Z"
    },
    "errors": {
      "count": 2,
      "lastError": "Rate limit exceeded on object image_123.jpg"
    }
  }
}
```

#### 4. Start/Resume Job

**Endpoint:** `POST /api/migrate/jobs/:jobId/start`

**Response:**
```json
{
  "success": true,
  "message": "Migration job started",
  "jobId": "mig_abc123xyz789",
  "status": "running"
}
```

#### 5. Pause Job

**Endpoint:** `POST /api/migrate/jobs/:jobId/pause`

**Response:**
```json
{
  "success": true,
  "message": "Migration job paused",
  "jobId": "mig_abc123xyz789",
  "status": "paused"
}
```

#### 6. Cancel Job

**Endpoint:** `POST /api/migrate/jobs/:jobId/cancel`

**Response:**
```json
{
  "success": true,
  "message": "Migration job cancelled",
  "jobId": "mig_abc123xyz789",
  "status": "cancelled"
}
```

#### 7. Delete Job

**Endpoint:** `DELETE /api/migrate/jobs/:jobId`

**Response:**
```json
{
  "success": true,
  "message": "Migration job deleted"
}
```

### Object-Level Operations

#### 8. List Job Objects

**Endpoint:** `GET /api/migrate/jobs/:jobId/objects`

**Query Parameters:**
- `status` - Filter by object status (optional)
- `limit` - Max results (default: 100)
- `cursor` - Pagination cursor

**Response:**
```json
{
  "success": true,
  "objects": [
    {
      "objectId": "obj_xyz789",
      "sourceKey": "images/photo_001.jpg",
      "destKey": "migrated/images/photo_001.jpg",
      "size": 2048576,
      "status": "completed",
      "transferredAt": "2025-10-23T10:35:00Z"
    },
    {
      "objectId": "obj_abc456",
      "sourceKey": "images/photo_002.jpg",
      "destKey": "migrated/images/photo_002.jpg",
      "size": 1536000,
      "status": "failed",
      "retryCount": 3,
      "errorMessage": "Rate limit exceeded"
    }
  ],
  "pagination": {
    "cursor": "next_page_token",
    "hasMore": true
  }
}
```

#### 9. Retry Failed Objects

**Endpoint:** `POST /api/migrate/jobs/:jobId/retry-failed`

**Response:**
```json
{
  "success": true,
  "message": "Retrying 12 failed objects",
  "retriedCount": 12
}
```

#### 10. Get Error Logs

**Endpoint:** `GET /api/migrate/jobs/:jobId/errors`

**Query Parameters:**
- `limit` - Max results (default: 50)
- `cursor` - Pagination cursor

**Response:**
```json
{
  "success": true,
  "errors": [
    {
      "errorId": "err_123",
      "objectKey": "images/photo_002.jpg",
      "errorType": "rate_limit",
      "errorMessage": "Rate limit exceeded",
      "httpStatus": 429,
      "occurredAt": "2025-10-23T10:40:00Z"
    }
  ],
  "pagination": {
    "cursor": "next_page_token",
    "hasMore": false
  }
}
```

#### 11. Validate AWS Credentials

**Endpoint:** `POST /api/migrate/validate-credentials`

**Request Body:**
```json
{
  "source": {
    "type": "s3",
    "bucket": "my-s3-bucket",
    "region": "us-east-1",
    "credentials": {
      "accessKeyId": "AKIAIOSFODNN7EXAMPLE",
      "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "bucketExists": true,
  "permissions": {
    "canList": true,
    "canRead": true
  },
  "objectCount": 1250,
  "totalSize": 524288000
}
```

---

## Frontend Components

### 1. Migration Dashboard (`MigrationDashboard.tsx`)

**Purpose:** Main entry point for migration feature

**Features:**
- Create new migration job button
- List of active/recent migration jobs
- Job status cards with progress bars
- Quick actions (pause, resume, cancel, delete)

**UI Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  Migration Dashboard                    [+ New Migration]│
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Active Jobs (2)                                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Production Images Migration              [⏸][✕]   │  │
│  │ Status: Running • 450/1250 objects (36%)           │  │
│  │ ████████████░░░░░░░░░░░░░░░░░░░░░░░ 189MB/524MB    │  │
│  │ Rate: 2.5 MB/s • ETA: 15 minutes                   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Completed Jobs (5)                        [View All]    │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Database Backups           ✓ Completed             │  │
│  │ 5,420 objects • 12.3 GB • Oct 22, 2025             │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 2. Migration Configuration Form (`MigrationForm.tsx`)

**Purpose:** Configure new migration job

**Form Sections:**

#### A. Source Configuration
- AWS Access Key ID (password field, auto-clear on blur)
- AWS Secret Access Key (password field, auto-clear on blur)
- AWS Region (dropdown)
- S3 Bucket Name (text input with validation)
- Prefix/Folder (optional text input)
- [Validate Credentials] button

#### B. Destination Configuration
- R2 Bucket (dropdown, populated from existing buckets)
- Prefix/Folder (optional text input)

#### C. Filters (Optional)
- File Extensions (multi-select: jpg, png, pdf, etc.)
- Size Range (min/max in MB)
- Date Range (date pickers)

#### D. Migration Options
- Overwrite Policy (radio buttons)
  - Skip existing files
  - Overwrite all
  - Overwrite if newer
- Concurrency Level (slider: 1-10)
- Verify Transfers (checkbox)

#### E. Summary
- Estimated objects to transfer
- Estimated total size
- Estimated transfer time
- Estimated AWS egress cost

**UI Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  Create Migration Job                                    │
├──────────────────────────────────────────────────────────┤
│  Job Name: [_________________________________]           │
│                                                          │
│  SOURCE (AWS S3)                                         │
│  Access Key ID:    [_________________________________]   │
│  Secret Access Key: [_________________________________]  │
│  Region:           [us-east-1          ▼]                │
│  Bucket:           [_________________________________]   │
│  Prefix (optional): [_________________________________]  │
│                    [Validate Credentials]                │
│                                                          │
│  DESTINATION (Cloudflare R2)                             │
│  Bucket:           [my-r2-bucket       ▼]                │
│  Prefix (optional): [_________________________________]  │
│                                                          │
│  FILTERS (Optional)                                      │
│  Extensions: [jpg] [png] [gif] [+ Add]                   │
│  Size Range: [___] MB to [___] MB                        │
│  Date Range: [mm/dd/yyyy] to [mm/dd/yyyy]                │
│                                                          │
│  OPTIONS                                                 │
│  Overwrite: (•) Skip existing  ( ) Overwrite all         │
│  Concurrency: [━━━━●━━━━━] 5 parallel transfers          │
│  [ ] Verify transfers after completion                   │
│                                                          │
│  SUMMARY                                                 │
│  Estimated: 1,250 objects • 500 MB                       │
│  Estimated Time: ~20 minutes                             │
│  AWS Egress Cost: ~$0.05 USD                             │
│                                                          │
│  [Cancel]                         [Start Migration]      │
└──────────────────────────────────────────────────────────┘
```

### 3. Job Detail View (`MigrationJobDetail.tsx`)

**Purpose:** Real-time status and control for active migration job

**Sections:**

#### A. Header
- Job name and ID
- Status badge
- Action buttons (pause, resume, cancel, delete)

#### B. Progress Overview
- Progress bar with percentage
- Objects transferred / total
- Bytes transferred / total
- Transfer rate (MB/s)
- Estimated time remaining

#### C. Statistics
- Success rate
- Failed objects
- Skipped objects
- Average object size
- Time elapsed

#### D. Object List
- Searchable/filterable table of objects
- Columns: File, Size, Status, Transferred At
- Filter by status (all, completed, failed, pending)

#### E. Error Log
- List of errors with details
- Retry button for failed objects
- Export errors as CSV

**UI Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  Production Images Migration                   [⏸][✕]   │
│  Job ID: mig_abc123xyz789 • Status: Running              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  PROGRESS                                                │
│  ████████████░░░░░░░░░░░░░░░░░░░░░░░ 36%                 │
│  450 / 1,250 objects • 189 MB / 524 MB                   │
│  Transfer Rate: 2.5 MB/s • ETA: 15 minutes               │
│                                                          │
│  STATISTICS                                              │
│  Success Rate: 98.6% • Failed: 2 • Skipped: 10           │
│  Avg Size: 419 KB • Elapsed: 5m 23s                      │
│                                                          │
│  OBJECTS                        [All ▼] [Search...]      │
│  ┌────────────────────────────────────────────────────┐  │
│  │ File                      Size    Status       Time│  │
│  ├────────────────────────────────────────────────────┤  │
│  │ photo_001.jpg             2MB     ✓ Completed  10:35│ │
│  │ photo_002.jpg             1.5MB   ✗ Failed     10:40│ │
│  │ photo_003.jpg             3MB     ⏳ Pending      - │ │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ERRORS (2)                            [Retry Failed]    │
│  ┌────────────────────────────────────────────────────┐  │
│  │ photo_002.jpg - Rate limit exceeded (10:40)        │  │
│  │ photo_125.jpg - Network timeout (10:38)            │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 4. Cost Estimator Component

**Purpose:** Calculate AWS egress costs before migration

**Inputs:**
- Total bytes to transfer
- AWS region (affects pricing)
- Data transfer tier (affects pricing)

**Pricing (as of 2025):**
- First 100 GB/month: $0.09/GB
- Next 10 TB/month: $0.085/GB
- Next 40 TB/month: $0.070/GB
- Next 100 TB/month: $0.050/GB

**Output:**
- Estimated AWS egress cost
- Cloudflare R2 storage cost (first 10 GB free, then $0.015/GB)
- Total estimated cost

---

## Security Considerations

### 1. Credential Handling

**AWS Credentials:**
- **Never store AWS credentials** in D1 or any persistent storage
- Credentials transmitted via HTTPS only
- Credentials used in-memory during job execution
- Credentials cleared from memory after validation

**Implementation:**
```typescript
// ❌ NEVER DO THIS
await env.DB.prepare('INSERT INTO jobs (aws_key, aws_secret) VALUES (?, ?)')
  .bind(accessKeyId, secretAccessKey).run();

// ✅ CORRECT: Pass credentials per-request, never persist
async function executeJob(jobId: string, awsCredentials: AWSCredentials) {
  // Use credentials in-memory only
  const s3Client = new S3Client({
    region: awsCredentials.region,
    credentials: {
      accessKeyId: awsCredentials.accessKeyId,
      secretAccessKey: awsCredentials.secretAccessKey
    }
  });
  
  // ... perform migration ...
  
  // Credentials automatically garbage collected
}
```

**Alternative: Temporary Credentials Only**
- Require users to generate AWS STS temporary credentials
- Short-lived credentials (15 minutes - 1 hour)
- Reduces risk of credential exposure

### 2. Rate Limiting

**Prevent abuse:**
- Limit concurrent migration jobs per user (default: 3)
- Limit API requests per minute per user (default: 60)
- Throttle Worker CPU time for migration operations

**Implementation:**
```typescript
const MIGRATION_LIMITS = {
  maxConcurrentJobs: 3,
  maxApiRequestsPerMinute: 60,
  maxTransferRateMBps: 50
};

async function createJob(userId: string) {
  const activeJobs = await env.DB
    .prepare('SELECT COUNT(*) as count FROM migration_jobs WHERE user_id = ? AND status IN (?, ?)')
    .bind(userId, 'running', 'pending')
    .first<{ count: number }>();
  
  if (activeJobs && activeJobs.count >= MIGRATION_LIMITS.maxConcurrentJobs) {
    throw new Error('Maximum concurrent migration jobs reached');
  }
  
  // ... create job ...
}
```

### 3. Input Validation

**Validate all user inputs:**
- AWS credentials format (access key pattern, secret key length)
- Bucket names (valid characters, length)
- Prefixes (prevent path traversal attacks)
- Filter values (reasonable ranges)

**Example:**
```typescript
function validateAWSCredentials(credentials: AWSCredentials) {
  // Access Key ID format: AKIA[A-Z0-9]{16}
  const accessKeyPattern = /^AKIA[A-Z0-9]{16}$/;
  if (!accessKeyPattern.test(credentials.accessKeyId)) {
    throw new Error('Invalid AWS Access Key ID format');
  }
  
  // Secret Access Key: 40 characters, alphanumeric + special chars
  if (credentials.secretAccessKey.length !== 40) {
    throw new Error('Invalid AWS Secret Access Key format');
  }
  
  // Region: valid AWS region
  const validRegions = ['us-east-1', 'us-west-2', 'eu-west-1', /* ... */];
  if (!validRegions.includes(credentials.region)) {
    throw new Error('Invalid AWS region');
  }
}
```

### 4. Error Sanitization

**Never expose sensitive information in error messages:**
- Sanitize AWS credentials from error logs
- Redact S3 URLs with embedded credentials
- Generic error messages to frontend

**Example:**
```typescript
function sanitizeError(error: Error): string {
  let message = error.message;
  
  // Remove access keys
  message = message.replace(/AKIA[A-Z0-9]{16}/g, 'AKIA***************');
  
  // Remove secret keys
  message = message.replace(/[A-Za-z0-9/+=]{40}/g, '***SECRET***');
  
  // Remove full URLs
  message = message.replace(/https?:\/\/[^\s]+/g, '[URL REDACTED]');
  
  return message;
}
```

### 5. CORS Configuration

**Restrict API access:**
- Allow only authenticated requests from R2 Manager frontend
- Validate Origin header
- Use CSRF tokens for sensitive operations

---

## Testing Strategy

### 1. Unit Tests

**Coverage:**
- AWS S3 SDK integration
- R2 upload logic
- Filter logic (prefix, size, date, extension)
- Retry logic with exponential backoff
- Progress calculation
- Error handling and sanitization

**Tools:**
- Vitest for unit tests
- Mock AWS S3 responses
- Mock Cloudflare R2 responses

### 2. Integration Tests

**Test Scenarios:**
- Create migration job with valid credentials
- List S3 objects with pagination
- Transfer small file (<10MB)
- Transfer large file with multipart upload (>100MB)
- Transfer with metadata preservation
- Handle rate limiting (429 responses)
- Retry failed transfers
- Pause and resume job
- Cancel job mid-transfer

**Tools:**
- Test S3 bucket with sample data
- Test R2 bucket for uploads
- Wrangler dev environment

### 3. Load Tests

**Scenarios:**
- Migrate 10,000+ objects
- Transfer 10GB+ total data
- Concurrent transfers (10 parallel)
- Multiple active jobs (3 concurrent)

**Metrics:**
- Transfer rate (MB/s)
- CPU usage
- Memory usage
- D1 query performance
- Error rate

**Tools:**
- Apache JMeter or k6
- CloudWatch metrics (AWS)
- Cloudflare Analytics

### 4. Security Tests

**Scenarios:**
- Attempt to access other users' jobs
- Inject malicious prefixes (path traversal)
- Exceed rate limits
- Invalid credentials handling
- Credential leakage in logs/errors

**Tools:**
- OWASP ZAP for vulnerability scanning
- Manual penetration testing
- Code review with security focus

---

## Future Enhancements

### Phase 2 Features (Post-Launch)

#### 1. Google Cloud Storage (GCS) Support
- Add GCS as source type
- Implement GCS SDK integration
- Similar workflow to S3 migration

#### 2. Azure Blob Storage Support
- Add Azure as source type
- Implement Azure SDK integration
- Support for different authentication methods

#### 3. Incremental Sync
- Schedule recurring migrations
- Only migrate new/changed files
- Use last modified timestamp for delta detection

#### 4. Migration Templates
- Save common migration configurations
- Reuse templates for recurring jobs
- Share templates between users (admin feature)

#### 5. Advanced Scheduling
- Cron-style schedules
- Off-peak hour scheduling
- Rate limiting based on time of day

#### 6. Notifications
- Email notifications on job completion/failure
- Webhook integration for external systems
- Slack/Discord integration

#### 7. Bandwidth Optimization
- Smart throttling based on network conditions
- Multi-region routing for faster transfers
- Compression during transfer (if supported)

#### 8. Advanced Reporting
- Transfer analytics dashboard
- Cost tracking and budgeting
- Performance trends over time

---

## Documentation Requirements

### User Documentation

1. **Getting Started Guide**
   - How to create AWS IAM user with minimal permissions
   - Step-by-step migration setup
   - Common troubleshooting tips

2. **Feature Reference**
   - Detailed explanation of all options
   - Filter examples and use cases
   - Best practices for large migrations

3. **FAQ**
   - Cost estimates
   - Performance expectations
   - Security and credential handling
   - Limitations and known issues

### Developer Documentation

1. **API Reference**
   - Complete endpoint documentation
   - Request/response schemas
   - Error codes and meanings

2. **Architecture Documentation**
   - System design overview
   - Database schema reference
   - Integration points

3. **Contributing Guide**
   - How to add new source types
   - Testing requirements
   - Code style guidelines

---

## Risks & Mitigation

### Risk 1: AWS Rate Limiting

**Impact:** High  
**Likelihood:** Medium  
**Mitigation:**
- Implement exponential backoff
- Respect AWS throttling headers
- Allow user to configure transfer rate
- Spread requests across time

### Risk 2: Large File Transfers

**Impact:** High  
**Likelihood:** Medium  
**Mitigation:**
- Use streaming uploads (no disk storage)
- Implement multipart uploads for files >100MB
- Set maximum file size limit (e.g., 5GB per object)
- Handle timeouts gracefully

### Risk 3: Credential Security

**Impact:** Critical  
**Likelihood:** Low  
**Mitigation:**
- Never persist credentials
- Use HTTPS for all communication
- Sanitize all error messages
- Regular security audits
- Encourage use of temporary credentials

### Risk 4: Worker CPU Time Limits

**Impact:** Medium  
**Likelihood:** Medium  
**Mitigation:**
- Break migrations into small batches
- Use Durable Objects for long-running jobs (future)
- Implement job queuing system
- Monitor CPU usage and optimize

### Risk 5: Cost Overruns (AWS Egress)

**Impact:** Medium  
**Likelihood:** Low  
**Mitigation:**
- Display cost estimates upfront
- Allow user to set budget limits
- Pause job if costs exceed threshold
- Provide detailed cost breakdown