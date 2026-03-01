# Changelog

**Last Updated:** March 1, 2026

All notable changes to R2 Bucket Manager are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed

- **Local Uploads Accessibility** - Fixed "No label associated with a form field" violation
  - Changed `<label>` to `<span>` in `LocalUploadsToggle` component since the toggle button already carries a descriptive `aria-label`
  - Resolves 5 accessibility violations (one per rendered bucket)

- **ESLint 10 Code Quality Fixes** - Resolved 9 new violations surfaced by ESLint 10
  - Fixed 5 `no-useless-assignment` violations in `JobHistoryDialog.tsx`, `api.ts`, `worker/index.ts`, and `worker/routes/files.ts`
  - Fixed 4 `preserve-caught-error` violations in `api.ts` by attaching `{ cause: error }` to re-thrown errors
  - Suppressed 6 `no-deprecated` violations for `autorag` → `aiSearch` API migration (tracked as TODO)

### Changed

- **Relaxed API Rate Limits** - Doubled all rate limit tiers to reduce 429 errors during normal usage
  - READ operations: 300 → 600 requests per 60 seconds
  - WRITE operations: 100 → 200 requests per 60 seconds
  - DELETE operations: 30 → 60 requests per 60 seconds

- **ESLint 10 Migration** - Upgraded linting toolchain to ESLint 10 with strict checking
  - `eslint`: 9.39.2 → 10.0.1
  - `@eslint/js`: 9.39.2 → 10.0.1
  - `tsconfig.app.json` target and lib: ES2020 → ES2022 (enables `Error` `cause` option)
  - Removed `brace-expansion` override (incompatible with ESLint 10's `minimatch` 10.x)
  - Added `eslint-plugin-react-hooks` peer dependency override for ESLint 10
  - Added `@typescript-eslint/typescript-estree` → `minimatch` override (`^10.2.1`)

- **Dependency Updates** - Updated npm dependencies to latest versions
  - `@cloudflare/workers-types`: 4.20260212.0 → 4.20260305.0
  - `@types/node`: 25.2.3 → 25.3.3
  - `eslint`: 10.0.1 → 10.0.2
  - `eslint-plugin-react-refresh`: 0.5.0 → 0.5.2
  - `globals`: 17.3.0 → 17.4.0
  - `lucide-react`: 0.563.0 → 0.575.0
  - `typescript-eslint`: 8.55.0 → 8.56.1
  - `wrangler`: 4.65.0 → 4.69.0
  - `react-dropzone`: 14.4.1 → 15.0.0 (major version; only breaking change is `isDragReject` behavior, which this project does not use)

### CI/CD

- **Removed Dependabot Auto-Merge Workflow**: Deleted `dependabot-auto-merge.yml` to prevent automatic merging of dependency PRs
  - Dependabot will still open PRs for visibility into available updates
  - Dependencies are now updated manually in batched local sessions to avoid unnecessary Docker deployments

### Security

- **tar CVE Fix** - Updated tar override from 7.5.7 → 7.5.8 to address CVE-2026-26960
- **minimatch ReDoS** - Updated override from `^10.2.1` → `^10.2.4` and promoted to top-level override to fix GHSA-7r86-cg39-jmmj and GHSA-23c5-xmqv-rm74
- **CodeQL Workflow** - Removed deprecated `fail-on: error` and `wait-for-processing` inputs from `codeql.yml`

---

## [3.4.0] - 2026-02-11

### Added

- **Local Uploads Toggle (BETA)** - Enable/disable R2 Local Uploads per bucket for faster upload performance
  - Up to 75% reduction in upload latency by writing to storage near the client
  - Inline toggle in both list and grid bucket views
  - Optimistic UI updates with loading and error states
  - New backend route: `GET/PUT /api/local-uploads/:bucketName`
  - New types: `LocalUploadsStatus`, `LocalUploadsResponse`
  - New API methods: `getLocalUploadsStatus()`, `setLocalUploadsStatus()`
  - Mock data support for local development

### Changed

- **Node.js 24 LTS Baseline** - Upgraded from Node 20 to Node 24 LTS across all configurations
  - Dockerfile already using `node:24-alpine` for both builder and runtime stages
  - GitHub Actions workflows updated to use Node 24.x as primary version
  - `package.json` now includes `engines` field requiring Node.js >=24.0.0
  - README prerequisites updated to specify Node.js 24+ (LTS)
  - DOCKER_README updated to reflect Node 24-alpine base image

- **Dependency Updates** - Updated npm dependencies to latest versions
  - `@babel/core`: 7.28.6 → 7.29.0
  - `@cloudflare/workers-types`: 4.20260127.0 → 4.20260210.0
  - `@types/node`: 25.0.10 → 25.2.3
  - `@types/react`: 19.2.10 → 19.2.14
  - `@vitejs/plugin-react`: 5.1.2 → 5.1.4
  - `esbuild`: 0.27.2 → 0.27.3
  - `eslint-plugin-react-refresh`: 0.4.26 → 0.5.0 (major version)
  - `globals`: 17.1.0 → 17.3.0
  - `react-dropzone`: 14.3.8 → 14.4.1
  - `typescript-eslint`: 8.54.0 → 8.55.0
  - `wrangler`: 4.61.0 → 4.64.0

### Security

- **tar Package Security** - Updated tar override to 7.5.4 to fix HIGH severity CVEs
  - CVE-2026-23745 (HIGH 8.2) - Path Traversal via hardlink/symlink escape
  - CVE-2026-23950 (HIGH 8.8) - Unicode handling race condition on macOS APFS

- **Docker Security** - Documented 3 curl CVEs as accepted upstream risks
  - CVE-2025-14819 (MEDIUM 5.3) - Fix 8.18.0-r0 not yet in Alpine repos
  - CVE-2025-14524 (MEDIUM 5.3) - Fix 8.18.0-r0 not yet in Alpine repos
  - CVE-2025-14017 (N/A) - Fix 8.18.0-r0 not yet in Alpine repos
  - Will upgrade when Alpine publishes patched packages

### Fixed

- **React 19 Compatibility** - Resolved deprecated `FormEvent` usage
  - Replaced deprecated `React.FormEvent` with inline type `{ preventDefault(): void }` in form handlers
  - Fixed in `app.tsx`, `AISearchQuery.tsx`, `CreateLifecycleRuleModal.tsx`, `S3CredentialsForm.tsx`
  - Removed unused eslint-disable directives in `filegrid.tsx`
  - Added missing `sortedFilesRef` to useCallback dependency arrays

- **Lifecycle Rules Display** - Fixed lifecycle rules showing incorrect day values (e.g., 86,400 days instead of 1 day)
  - `CreateLifecycleRuleModal.tsx` incorrectly converted days to seconds (`days * 86400`) before setting `maxAge`
  - Cloudflare R2 lifecycle API `maxAge` is already in days, not seconds
  - Affects both Expiration (Delete) and Transition to Infrequent Access rule types

- **ESLint Disable Remediation** - Properly fixed all eslint-disable suppressions across the codebase
  - `JobHistory.tsx`: Refactored to use separate `fetchJobs` callback with proper dependency management
  - `JobHistoryDialog.tsx`: Wrapped `loadEvents` in useCallback with proper dependencies
  - `ThemeContext.tsx`: Split context into `theme-context-value.ts` to satisfy `react-refresh/only-export-components`
  - `useFileFilters.ts`: Replaced useEffect + setState with useMemo for `availableExtensions`
  - `api.ts`: Extracted file validation regex to documented top-level constant `INVALID_FILENAME_CHARS`
  - `logger.ts`: Consolidated 8 individual eslint-disable-next-line comments into single scoped block disable
  - `filegrid.tsx`: Captured ref values at effect start for cleanup function pattern

---

## [3.3.0] - 2026-01-14

### Added

- **Object Lifecycle Management** - Manage R2 bucket lifecycle rules via Cloudflare REST API
  - View configured lifecycle rules for any bucket
  - Create expiration rules to automatically delete objects after specified days
  - Create transition rules to move objects to Infrequent Access storage (33% cost savings)
  - Filter rules by prefix for targeted object lifecycle policies
  - New backend route: `GET/PUT /api/lifecycle/:bucketName`
  - New types: `LifecycleRule`, `LifecycleRulesResponse`
  - New API methods: `getLifecycleRules()`, `setLifecycleRules()`, `deleteLifecycleRule()`

### Changed

- **Dependency Updates** - Updated npm dependencies to latest versions
  - `@babel/core`: 7.28.5 → 7.28.6
  - `@cloudflare/workers-types`: 4.20260109.0 → 4.20260114.0
  - `@types/node`: 25.0.3 → 25.0.8
  - `@types/react`: 19.2.7 → 19.2.8
  - `baseline-browser-mapping`: 2.9.11 → 2.9.14
  - `caniuse-lite`: 1.0.30001762 → 1.0.30001764
  - `rollup`: 4.54.0 → 4.55.1
  - `typescript-eslint`: 8.51.0 → 8.53.0
  - `vite`: 7.3.0 → 7.3.1
  - `wrangler`: 4.56.0 → 4.59.1

- **CI/CD Improvements** - Modernized GitHub Actions workflows to match d1/do/kv-manager fleet pattern
  - `docker-publish.yml`: Migrated from single-job to 5-job architecture (lint, codeql, build-platform, security-scan, merge-and-push)
  - Native ARM builds via `ubuntu-24.04-arm` runner (replaces slow QEMU emulation)
  - Lint and CodeQL gates block Docker builds on failure
  - Uses `docker/scout-action@v1` for CVE scanning with SARIF upload to GitHub Security
  - `codeql.yml`: Added `fail-on: error` to block builds on security vulnerabilities
  - Removed standalone `deploy.yml` (consolidated into Docker workflow)

### Fixed

- **CodeQL Alerts** - Resolved 4 code scanning issues
  - Removed redundant null check on narrowed variable in `files.ts`
  - Removed unused variable `url` in `src/worker.js`
  - Removed useless `hasMore = false` assignments before `break` in `folders.ts`
  - Removed always-true conditional `userEmail ?? undefined` in `index.ts`

---

## [3.2.0] - 2026-01-09

### Added

- **Metrics Dashboard Storage Tab** - Dedicated storage trend visualization
  - New "Storage" tab with storage and object count over time charts
  - Storage distribution chart by bucket
  - Storage details table with per-bucket breakdown and percentage

- **Metrics Bucket Filtering** - Filter metrics by specific bucket
  - Dropdown selector in metrics header
  - API support for `bucketName` query parameter
  - Filtered views show bucket-specific metrics

- **AI Search Instance Status** - Real-time visibility into indexing jobs
  - Instance cards now display last sync time and files indexed count
  - Status data fetched in parallel with instance list for fast loading
  - New backend endpoint: `GET /api/ai-search/instances/:name/status`
  - Returns job history with up to 10 recent indexing jobs

- **Dynamic File Type Detection** - Always up-to-date supported file types
  - New backend endpoint: `GET /api/ai-search/supported-types`
  - Dynamically fetches supported types from Cloudflare `toMarkdown()` API
  - 5-minute cache with fallback to hardcoded list if API unavailable
  - Includes `.pdf`, `.docx`, `.odt`, `.jpeg` and other newly-supported formats

- **Health Dashboard** - New tab providing at-a-glance operational status
  - System health score (0-100) based on job failures, webhook config, and organization
  - Summary cards for buckets, operations, webhooks, and recent jobs
  - Failed jobs alert with expandable details
  - Low activity bucket detection (7+ days without activity)
  - Organization status displays (color/tag coverage)
  - 2-minute caching for performance
  - New backend route: `GET /api/health`

- **Expanded Webhook Events** - 6 new granular event types for R2 operations
  - `file_move`, `file_copy`, `file_rename` - Track file transfer and rename operations
  - `folder_create`, `folder_delete` - Monitor folder lifecycle events
  - `bucket_rename` - Capture bucket rename operations
  - Helper payloads for future job-level events: `bulk_download_complete`, `s3_import_complete`
  - Total webhook events increased from 7 to 15

- **Auto-Detect Dev/Prod API Endpoint** - Simplified local development workflow
  - Added `.env.development` file for automatic API URL switching
  - Vite auto-loads development config during `npm run dev`
  - No manual commenting/uncommenting of `VITE_WORKER_API` required

### Documentation

- **Added** [Upgrade Guide](Upgrade-Guide) to wiki - Comprehensive documentation for the automated in-app upgrade system covering all 4 schema migrations

### Fixed

- **Local Development Environment** - Fixed issues preventing local dev from working ([#149](https://github.com/neverinfamous/R2-Manager-Worker/issues/149))
  - **URL Signing Key Fallback:** Auto-generates random signing key when `URL_SIGNING_KEY` is not configured
  - **Metrics API:** Updated to use `VITE_WORKER_API` environment variable for cross-port requests
  - **Webhooks API:** Updated to use `VITE_WORKER_API` environment variable for cross-port requests
  - **Vite Compatibility:** Replaced `process.env.NODE_ENV` with `import.meta.env.DEV` for browser environment
  - Thanks to [@denzyve](https://github.com/denzyve) for identifying these issues in [PR #150](https://github.com/neverinfamous/R2-Manager-Worker/pull/150)

- **AI Search Instance Listing** - Fixed instances not appearing in the Instances tab
  - Corrected API response parsing to handle Cloudflare's array format (was expecting `data.result.rags`, now handles direct array in `data.result`)
  - Updated `AISearchInstance` type to use `id` and `source` fields from actual API response

- **AI Search Sync** - Fixed "Route not found" error when syncing instances
  - Changed HTTP method from `POST` to `PATCH` as required by Cloudflare's API

- **AI Search Query Results** - Fixed empty results when querying instances
  - Added response transformation to unwrap `result` from Cloudflare's API response wrapper
  - Frontend now correctly receives `{ response, data }` instead of `{ success, result: { response, data } }`

- **AI Search Instance Status** - Fixed "Last sync" time not displaying on instance cards
  - Updated `AISearchIndexingJob` type to match actual Cloudflare Jobs API response
  - Changed from `completed_at` to `ended_at` field for sync timestamps
  - Changed from `status === 'completed'` to `!end_reason` for detecting successful jobs

- **Docker Scout Security Scan** - Fixed vulnerability check incorrectly blocking builds
  - Grep pattern now correctly parses CRITICAL/HIGH counts from Docker Scout output
  - MEDIUM/LOW vulnerabilities no longer falsely trigger build failures

### Changed

- **Increased API Rate Limits** - Prevents 429 errors during rapid UI navigation
  - READ operations: 100 → 300 requests per 60 seconds
  - WRITE operations: 30 → 100 requests per 60 seconds
  - DELETE operations: 10 → 30 requests per 60 seconds

- **Support Email in Error Messages** - All API error responses now include support contact
  - New centralized `createErrorResponse` utility in `worker/utils/error-response.ts`
  - Support email (`admin@adamic.tech`) automatically included for all 4xx/5xx errors
  - Updated 70+ error response locations across 8 route files
  - Consistent error format: `{ error: string, support?: string, code?: string, details?: string }`

- **Dependency Updates** - Updated all outdated packages to latest versions
  - `@cloudflare/workers-types` 4.20251213.0 → 4.20260109.0
  - `@types/node` 25.0.2 → 25.0.3
  - `esbuild` 0.27.1 → 0.27.2
  - `eslint-plugin-react-refresh` 0.4.25 → 0.4.26
  - `globals` 16.5.0 → 17.0.0 (major version bump)
  - `lucide-react` 0.561.0 → 0.562.0
  - `typescript-eslint` 8.49.0 → 8.52.0
  - `vite` 7.3.0 → 7.3.1
  - `wrangler` 4.55.0 → 4.58.0

---

## [3.1.0] - 2025-12-11

### Added

- **Bucket Tagging** - Organize and search buckets with custom text tags
  - Add/remove multiple tags per bucket
  - Tag picker integrated in bucket list (compact) and grid views
  - New "Search" navigation tab with sub-tabs:
    - "Files" sub-tab: Cross-bucket file search (moved from expandable dialog)
    - "Tags" sub-tab: Search buckets by tag with match-all/match-any modes
  - Tag management: add, remove, import/export tags
  - New backend routes: `/api/tags`, `/api/buckets/:name/tags`
  - New `bucket_tags` table in D1 database with indexes
  - 5-minute backend caching for tag queries
  - Keyboard accessible tag picker component
  - WCAG-compliant UI with ARIA labels

- **Automated Database Migrations** - One-click schema upgrades
  - Upgrade banner appears when database schema is outdated
  - Automatically detects legacy installations without version tracking
  - Click "Upgrade Now" to apply pending migrations
  - Schema version tracking via `schema_version` table
  - New backend routes: `/api/migrations/status`, `/api/migrations/apply`

- **Bucket Color Tags** - Visual organization with 27-color palette
  - Click palette icon to assign colors to buckets
  - Color picker with 6-column grid layout and fixed positioning
  - Available in both Grid and List views
  - "Remove color" option to clear assignments
  - Colors persist in D1 database (`bucket_colors` table)
  - New backend routes: `GET /api/buckets/colors`, `PUT /api/buckets/:name/color`
  - 5-minute client-side caching with invalidation on mutations
  - WCAG-compliant UI with ARIA labels

### Changed

- **Build Optimization**: Reduced bundle size and improved initial page load
  - Configured Vite manual chunks to split vendor libraries:
    - `vendor-react`: React core (11 KB gzip)
    - `vendor-icons`: lucide-react (1.6 KB gzip)
    - `vendor-utils`: jszip, jose, spark-md5, react-dropzone (20 KB gzip)
  - Implemented lazy loading for tab-based feature components with React.lazy and Suspense:
    - MetricsDashboard, S3ImportPanel, JobHistory, WebhookManager now load on-demand
    - Added loading spinner fallback during chunk loading
  - Main bundle reduced from 473KB → 332KB (-30%)
  - ~60KB of feature code now loads only when respective tabs are accessed

- **S3 Import Performance** - Optimized S3 Import tab to prevent 429 rate limit errors
  - **Frontend Caching**: 2-minute TTL cache for job list (`Map<key, {data, timestamp}>`)
  - **Automatic Retry**: Exponential backoff (2s → 4s → 8s) for 429/503/504 errors
  - Tab switches use cached data; manual refresh bypasses cache
  - Cache invalidation on job create/abort mutations
  - **Backend Retry Logic**: Same exponential backoff pattern for Cloudflare API calls
  - **Structured Error Codes**: Module-prefixed codes (`S3_LIST_JOBS_FAILED`, `S3_CREATE_JOB_FAILED`, etc.)
  - Respects `Retry-After` header from rate limit responses

## [3.0.0] - 2025-12-08

### 🎉 Major Release Highlights

Version 3.0.0 brings **Metrics Dashboard**, **Webhooks**, **S3 Import**, **automated database migrations**, **audit logging for individual actions**, and **centralized logging**. This major release adds powerful monitoring, integration, and migration capabilities.

### Added

- **Bucket Item Count** - Display the number of files/objects in each bucket
  - Grid view: Shows item count below total size on bucket cards
  - List view: New "Items" column in the bucket table
  - Zero additional API overhead - counts objects during existing size calculation
  - Values formatted with locale-aware number separators for large counts

- **Client-Side API Caching** - Optimized performance with intelligent caching
  - Bucket list cache with 5-minute TTL (300 seconds)
  - File list cache (first page only) with 5-minute TTL
  - Cache is used on initial load, bypassed on user-triggered refreshes
  - Automatic cache invalidation on mutations (create/delete/rename operations)
  - Exponential backoff retry logic for rate limits (429) and service errors (503/504)
  - Retry pattern: 2s → 4s → 8s with max 3 attempts
  - Significantly faster page loads on repeat visits (~50-80% improvement)
  - Reduced API calls and improved resilience to transient errors

- **Metrics Dashboard** - R2 analytics and usage statistics
  - New "Metrics" tab in main navigation
  - Summary cards: Total Requests, Success Rate, Total Storage, Object Count
  - Time range selector: 24 Hours, 7 Days, 30 Days
  - Requests trend line chart with per-bucket breakdown
  - Storage usage bar chart by bucket
  - Sortable per-bucket metrics table
  - 2-minute client-side cache for performance
  - New backend route: `GET /api/metrics?range=24h|7d|30d`
  - Uses Cloudflare GraphQL Analytics API (`r2OperationsAdaptiveGroups`, `r2StorageAdaptiveGroups`)
  - Mock data support for local development

- **Persistent View Preference** - The List/Grid view preference is now saved and persists between sessions.
  - Applied to both **Buckets** list and **Files** grid views.
  - Defaults to **List** view for new sessions.
  - Uses local storage to remember user choice.

- **Webhooks Tab** - Configure HTTP notifications for bucket and file events
  - New "Webhooks" tab in the main navigation
  - Create, edit, delete, and test webhook configurations
  - HMAC-SHA256 signature support for secure payload verification
  - Event types: file_upload, file_download, file_delete, bucket_create, bucket_delete, job_failed, job_completed
  - New backend routes: `/api/webhooks/*` for CRUD operations
  - New `webhooks` table in D1 database

- **Automated Database Upgrades** - One-click schema migrations
  - Upgrade banner appears when database schema is outdated
  - Automatically detects legacy installations without version tracking
  - Click "Upgrade Now" to apply pending migrations
  - Schema version tracking via `schema_version` table
  - New backend routes: `/api/migrations/status`, `/api/migrations/apply`

- **Bucket Filter Bar** - Client-side filtering for main bucket list
  - Filter buckets by name (instant search)
  - Filter by bucket size with presets (Small, Medium, Large) and custom ranges
  - Filter by creation date with presets (Last 7 Days, This Year) and custom ranges
  - Consistent UI with existing file filter bar

- **Audit Logging for Individual Actions** - Extended Job History to track all user operations
  - **File Operations:** Upload, download, delete, rename, move, copy
  - **Folder Operations:** Create, delete, rename, move, copy
  - **Bucket Operations:** Create, delete, rename
  - New `audit_log` database table with indexes
  - Unified Job History UI displays both bulk jobs and individual actions
  - Grouped operation type dropdown (Bulk, File, Folder, Bucket, AI)
  - New API endpoints: `GET /api/audit`, `GET /api/audit/summary`
  - Status tracking (success/failed) with detailed metadata

- **Centralized Logger Service** - Replaced all direct `console.*` calls with proper logging abstraction
  - New `src/services/logger.ts` provides environment-aware logging
  - Log levels: debug, info, warn, error with configurable minimum level
  - Development mode: All logs output to console
  - Production mode: Only warn/error levels output (configurable)
  - Context tagging for organized logs (e.g., `[API]`, `[FileGrid]`, `[Auth]`)
  - Extensible for future remote logging integration
  - Passes strict ESLint `no-console` rule without suppressions
  - Replaced ~150 specific console statements across 15+ backend files with structured logger

- **S3 Import (Super Slurper Integration)** - Migrate data from Amazon S3 to R2
  - New backend route: `worker/routes/s3-import.ts`
  - Create, list, get, and abort migration jobs
  - Supports AWS S3, Google Cloud Storage, and S3-compatible storage
  - Frontend panel with three tabs: New Migration, Active Jobs, History
  - Credentials form with AWS region selector and validation
  - Real-time job progress tracking with abort capability
  - Dashboard fallback link for manual job creation
  - Mock data support for local development

### Changed

- **Dependency Updates** - Updated critical dependencies to latest versions
  - `wrangler` -> ^4.53.0
  - `vite` -> ^7.2.7
  - `lucide-react` -> ^0.556.0
  - `esbuild` -> ^0.27.1 (unpinned from overrides)

- **UI Refinements** - Improved layout and visual consistency
  - Moved **List/Grid View Toggle** to Bulk Actions Toolbar for better grouping.
  - Updated **Rename** button to match standard blue accent color.
  - Updated **Delete** button to use a muted red (opacity 0.9) for reduced harshness in dark mode.
  - Improved spacing in Bulk Actions Toolbar.

### Security

- **Accessibility** - Added missing `id` and `name` attributes to "Select All Buckets" checkbox.

---

## [2.0.0] - 2025-11-27

### 🎉 Major Release Highlights

Version 2.0.0 is a major release featuring **Job History tracking**, **AI Search integration**, **API rate limiting**, **upload integrity verification**, and **strict TypeScript compliance**. This release represents a significant evolution of the R2 Bucket Manager with enterprise-grade features.

### Added

- **Job History Tracking** - Complete audit trail for bulk operations
  - Track all bulk operations: downloads, uploads, deletions, file moves/copies
  - Filterable job list by status, operation type, bucket, date range
  - Real-time progress tracking with percentage completion
  - Event timeline modal showing detailed operation history
  - Job search by ID for quick lookup
  - D1 database storage with `bulk_jobs` and `job_audit_events` tables
  - New navigation tabs to switch between "Buckets" and "Job History" views
  - API endpoints: `GET /api/jobs`, `GET /api/jobs/:jobId`, `GET /api/jobs/:jobId/events`

- **AI Search Integration** - Connect R2 buckets to Cloudflare AI Search (formerly AutoRAG) for semantic search
  - Bucket compatibility analysis shows which files can be indexed by AI Search
  - Visual donut chart displaying indexable vs non-indexable file ratios
  - Supported file types: markdown, text, JSON, YAML, HTML, code files (up to 4MB each)
  - Direct link to Cloudflare Dashboard for creating AI Search instances
  - Query interface with two search modes: AI-powered (with LLM response) and semantic search (retrieval only)
  - Instance management: list, sync, and query existing AI Search instances
  - Real-time search results with relevance scores and content snippets
  - Configurable result limits and reranking options
  - Mock data support for local development
  - New API endpoints: `/api/ai-search/*` for compatibility, instances, and queries
  - Requires `[ai]` binding in wrangler.toml for Workers AI access

- **Accessibility Improvements** - Added id/name attributes to form elements for better accessibility compliance

- **Strict TypeScript & ESLint Compliance** - Achieved full strict type safety across the codebase
  - Fixed 280+ ESLint errors and 55 type safety warnings
  - Enabled `strictTypeChecked` and `stylisticTypeChecked` ESLint rule sets
  - All `no-unsafe-*` rules now enforced as errors (not warnings)
  - Added explicit return types to all functions
  - Added proper type assertions for all API responses (no `any` types)
  - Fixed all floating promises with `void` operator
  - Replaced all `||` with `??` for nullish coalescing where appropriate
  - Fixed all strict boolean expression violations
  - Created typed interfaces for all API request/response bodies
  - TypeScript compiles cleanly with `noEmit` flag
  - Only intentional `console.log` statements remain as warnings
  - Codebase now meets strict enterprise-grade type safety standards

- **Upload Integrity Verification** - MD5 checksum verification for all file uploads
  - Client-side MD5 calculation using spark-md5 library
  - Server-side ETag capture from R2 responses
  - Automatic verification after upload completion
  - Visual feedback in UI: "Verifying..." → "✓ Verified"
  - Checksum mismatch detection with clear error messages
  - Works for both single-chunk (<10MB) and multi-chunk (>10MB) uploads
  - Per-chunk verification for chunked uploads
  - Minimal performance overhead (~2-3% of upload time)
  - Industry-standard data integrity verification
  - Prevents silent upload failures and data corruption

- **API Rate Limiting** - Tiered rate limiting to protect API endpoints from abuse
  - Three-tier rate limiting system based on operation type (READ/WRITE/DELETE)
  - READ operations: 100 requests per 60 seconds (GET endpoints)
  - WRITE operations: 30 requests per 60 seconds (POST/PATCH endpoints)
  - DELETE operations: 10 requests per 60 seconds (DELETE endpoints)
  - Per-user enforcement using authenticated email as rate limit key
  - Automatic endpoint classification by HTTP method and path
  - Detailed 429 error responses with tier, limit, period, and retry guidance
  - Violation logging with timestamp, user email, endpoint, and tier
  - Standard rate limit response headers (Retry-After, X-RateLimit-\*)
  - Automatic bypass for localhost development
  - Configurable limits via wrangler.toml
  - Uses Cloudflare Workers Rate Limiting API (no KV required)
  - Minimal performance impact with sub-millisecond latency

- **Multi-Bucket Download** - Download multiple selected buckets as a single ZIP archive
  - "Select All" button on main page to quickly select all buckets
  - "Download Selected" button in bulk action toolbar
  - Downloads all selected buckets as one ZIP file with each bucket as a folder
  - Progress tracking with visual feedback (Preparing → Downloading → Complete)
  - Automatic deselection after successful download
  - No size limit enforcement (downloads all files from all selected buckets)
  - Timestamped ZIP filename: `buckets-YYYY-MM-DDTHH-MM-SS.zip`
  - Works seamlessly with existing bulk selection UI

### Changed

- **Architecture Enhancement** - Added D1 database for job history metadata
  - New `METADATA` D1 database binding for job tracking
  - Schema includes `bulk_jobs` and `job_audit_events` tables with proper indexes
  - Optimized queries for filtering, sorting, and pagination
  - Previous D1 removal for bucket ownership still applies (simpler auth model)

### Fixed

- **Workers.dev Subdomain** - Fixed subdomain being disabled on every deployment
  - Added `workers_dev = true` to wrangler.toml to persist setting
  - Added `preview_urls = true` to enable version-specific preview URLs
  - Updated wrangler.toml.example with both settings
  - Now `*.workers.dev` subdomain remains enabled after deployments

### Technical Details

- **Rate Limiting Implementation:**
  - New utility module: `worker/utils/ratelimit.ts` (154 lines)
  - New rate limit bindings in wrangler.toml (RATE_LIMITER_READ, RATE_LIMITER_WRITE, RATE_LIMITER_DELETE)
  - Updated TypeScript types with RateLimit and RateLimitResult interfaces
  - Integrated rate limiting check in worker/index.ts after authentication
  - Rate limit check executes before route handling with 429 response on violation
  - Automatic classification: GET → READ, POST/PATCH → WRITE, DELETE → DELETE
  - ~150 lines of new code for rate limiting logic
  - Requires Wrangler 4.36.0 or later
  - Requires Cloudflare Workers paid plan

- **Multi-Bucket Download Implementation:**
  - New API method: `downloadMultipleBuckets()` in `src/services/api.ts`
  - New worker endpoint: `POST /api/files/download-buckets-zip` in `worker/routes/files.ts`
  - Uses JSZip to create nested folder structure (bucket/file.ext)
  - Parallel file fetching from multiple buckets
  - Frontend state management with progress tracking
  - ~200 lines of new code across 3 files

- **UI Enhancements:**
  - Green "Select All" button positioned on left side of toolbar
  - Blue "Download Selected" button between "Clear Selection" and "Delete Selected"
  - Toolbar shows/hides buttons based on selection state
  - Visual spacing improvements (3px between checkbox and bucket name)

---

## [1.2.0] - 2025-10-27

### Added

- **Cross-Bucket Search** - Search for files across all buckets from the main page
  - Expandable/collapsible search interface on bucket list page
  - Search by filename with real-time debounced search (300ms)
  - Filter by file extension with quick filters (Images, Documents, Videos, Code, Archives)
  - Filter by file size with preset ranges (< 1 MB, 1-10 MB, etc.) and custom range
  - Filter by upload date with preset ranges (Today, Last 7/30/90 Days, This Year) and custom range
  - Server-side parallel search across all buckets for optimal performance
  - Search results displayed in sortable table (Filename, Bucket, Size, Upload Date)
  - Click column headers to sort results (ascending/descending)
  - Full file actions available from search results (download, move, copy, delete)
  - Clickable bucket badges to navigate directly to source bucket
  - "Clear All" button to reset all filters and collapse search panel
  - Loading and empty state indicators
  - Active filter count badge when search is collapsed
  - Responsive design for mobile and tablet devices
  - Mock data support for local development

- **Bulk Bucket Deletion** - Select and force delete multiple buckets at once from the main page
  - Checkbox selection for each bucket card with visual highlighting
  - Bulk action toolbar showing selection count and action buttons
  - "Clear Selection" button to deselect all buckets
  - "Delete Selected" button to initiate bulk force delete
  - Enhanced confirmation modal supporting both single and multiple bucket deletions
  - Progress tracking during bulk deletion ("Deleting bucket X of Y...")
  - Visual progress bar showing deletion progress
  - Individual failure handling - one bucket failing doesn't stop the operation
  - Automatic file count calculation across all selected buckets
  - Selected buckets highlighted with blue border and background
  - Force delete functionality removes all files before deleting buckets

### Fixed

- **File Transfer Path Logic** - Fixed files being moved/copied into incorrectly nested folders
  - Files now correctly go to root folder when no destination path specified
  - Folder paths properly handled whether they end with `/` or not
  - Fixed issue where filename was treated as folder name, creating `filename/filename` structure

- **File Rename Operations** - Fixed image previews and video playback breaking after renaming files
  - Images now properly reload with updated filenames and fresh signed URLs after rename
  - Video files maintain playback functionality after rename operations
  - Subsequent rename operations now work correctly (fixed "Source file not found" error)
  - File list now refreshes synchronously after rename to prevent stale data

- **Context Menu** - Fixed "Copy Link" throwing TypeError when accessed from right-click menu
  - Changed `handleCopySignedUrl` to accept optional event parameter
  - Added optional chaining for event.stopPropagation()

- **ESLint Configuration** - Added `.wrangler` directory to ignored paths to prevent false positives

- **React Hook Pattern** - Fixed `set-state-in-effect` error by replacing `useEffect` with `useMemo`

### Changed

- **Code Architecture** - Major refactoring for improved maintainability
  - Extracted `useFileSort` hook (122 lines) - Manages sorting state and logic
  - Extracted `useModalState` hook (95 lines) - Consolidates modal/dropdown states
  - Extracted `useFileFilters` hook (244 lines) - Handles all filtering logic
  - Extracted `useSearch` hook (217 lines) - Cross-bucket search state management
  - Reduced main filegrid file from 1,782 to 1,579 lines (11.4% reduction)
  - Improved code reusability and testability with custom hooks
  - All functionality preserved with zero regressions

### Technical Details

- **New Backend Components:**
  - `worker/routes/search.ts` (200 lines) - Parallel cross-bucket search API endpoint
  - Search endpoint: `GET /api/search` with query params for filters

- **New Frontend Components:**
  - `src/components/search/CrossBucketSearch.tsx` (207 lines) - Main search interface
  - `src/components/search/SearchResultsTable.tsx` (393 lines) - Results table with actions
  - `src/hooks/useSearch.ts` (217 lines) - Search state management with debouncing
  - `src/types/search.ts` (40 lines) - Type definitions for search functionality
  - `src/styles/search.css` (383 lines) - Complete search component styling

- **Modified Files:**
  - `worker/index.ts` - Integrated search routes
  - `src/services/api.ts` - Added `searchAcrossBuckets()` method
  - `src/app.tsx` - Integrated search component above bucket grid
  - `eslint.config.js` - Added `.wrangler` to ignores

- **Total New Code:** ~1,440 lines across 6 new files
- **TypeScript Compilation:** Clean (0 errors)
- **ESLint:** Clean (0 errors, 0 warnings)
- **Bundle Size Impact:** +0.1 kB gzipped (366.23 kB → 366.33 kB)
- **Browser Testing:** All features verified working in Chrome/Edge

---

## [1.0.1] - 2025-10-26

### Fixed

- **Local Development Environment** - Fixed broken local development setup
  - Added `wrangler.dev.toml` configuration for development (skips frontend build)
  - Fixed CORS configuration to allow `http://localhost:5173` origin with credentials
  - Added automatic authentication bypass for localhost requests
  - Added mock bucket data support for local testing without Cloudflare API credentials
  - Fixed 500 errors when ASSETS binding is missing in development mode
  - Configured `.env` file for proper localhost API endpoint

### Changed

- Updated `worker/index.ts` to detect localhost and handle development mode
- Updated README.md with correct local development instructions
- Updated Development Guide wiki with accurate setup steps
- Updated `wrangler.toml.example` to clarify production vs development usage

### Documentation

- Added comprehensive local development section to README
- Updated Development Guide wiki with troubleshooting steps
- Clarified that local dev returns mock data and doesn't require secrets

---

## [1.0.0] - 2025-10-24

### Added

- **Initial Release** - Full-featured R2 bucket manager
  - Bucket management (create, rename, delete with force option)
  - Folder management (create, rename, copy, move, delete)
  - File operations (upload, download, rename, copy, move, delete)
  - Advanced filtering system:
    - Extension filters (images, documents, videos, code, archives)
    - Size filters (preset ranges and custom)
    - Date filters (preset ranges and custom)
    - Active filter badges and statistics
  - Chunked file uploads (10MB chunks, up to 500MB files)
  - Bulk file downloads as ZIP archives
  - Signed URL generation for secure file sharing
  - Light/Dark/System theme support with toggle
  - Breadcrumb navigation for folder hierarchies
  - Grid and list view modes
  - Real-time search and filtering
  - GitHub SSO via Cloudflare Access (Zero Trust)
  - Responsive design for mobile and desktop
  - Production deployment on Cloudflare Workers

### Tech Stack

| Component  | Technology         | Version       |
| ---------- | ------------------ | ------------- |
| Frontend   | React              | 19.2.0        |
| Build Tool | Vite               | 7.1.11        |
| Language   | TypeScript         | 5.9.3         |
| Backend    | Cloudflare Workers | Runtime API   |
| Storage    | Cloudflare R2      | S3-compatible |
| Auth       | Cloudflare Access  | Zero Trust    |

### Documentation

- Comprehensive README with quick start guide
- GitHub Wiki with complete documentation:
  - Installation & Setup Guide
  - API Reference
  - Configuration Reference
  - Development Guide
  - Authentication & Security
  - Troubleshooting
  - FAQ
- Docker deployment guide
- Contributing guidelines
- Security policy

---

## Release Notes

### Version 3.4.0 (2026-02-11)

This minor release brings **Local Uploads**, **Node.js 24 LTS Baseline**, **React 19 Compatibility Fixes**, **Lifecycle Rules Bug Fix**, and comprehensive **ESLint Disable Remediation** to the R2 Bucket Manager. Version 3.4.0 adds faster upload performance and modernizes the runtime baseline.

**Key Features:**

- **Local Uploads Toggle (BETA):** Enable per-bucket local uploads for up to 75% faster upload performance
  - Inline toggle in list and grid bucket views
  - Optimistic UI updates with loading and error states
  - New backend routes and API methods
- **Node.js 24 LTS Baseline:** Upgraded from Node 20 to Node 24 across all configurations
- **Security:** Fixed HIGH severity tar CVEs (CVE-2026-23745, CVE-2026-23950)
- **Bug Fixes:** Fixed lifecycle rules day display (86,400 → 1), React 19 FormEvent deprecation, ESLint disable remediation across 7 files
- **Dependency Updates:** 12 packages updated including wrangler 4.61.0 → 4.64.0

### Version 3.3.0 (2026-01-14)

This minor release brings **Object Lifecycle Management** to the R2 Bucket Manager. Version 3.3.0 adds automated expiration and storage class transition capabilities for cost optimization.

**Key Features:**

- **Object Lifecycle Management:** Manage R2 bucket lifecycle rules via Cloudflare REST API
  - Create expiration rules to automatically delete objects after specified days
  - Create transition rules to move objects to Infrequent Access storage (33% cost savings)
  - Filter rules by prefix for targeted lifecycle policies
- **CI/CD Improvements:** Modernized GitHub Actions with 5-job Docker architecture and native ARM builds
- **CodeQL Fixes:** Resolved 4 code scanning issues
- **Dependency Updates:** 10 packages updated including wrangler 4.56.0 → 4.59.1

### Version 3.2.0 (2026-01-09)

This minor release brings **Metrics Storage Tab**, **Health Dashboard**, **Expanded Webhook Events**, **AI Search Improvements**, and significant **Developer Experience** enhancements to the R2 Bucket Manager. Version 3.2.0 adds powerful monitoring, operational visibility, and streamlined local development.

**Key Features:**

- **Metrics Dashboard Storage Tab:** Dedicated storage trend visualization with bucket filtering
  - New "Storage" tab with storage and object count charts
  - Storage distribution chart and per-bucket breakdown
  - Filter metrics by specific bucket
- **Health Dashboard:** At-a-glance operational status
  - System health score (0-100)
  - Failed jobs alert and low activity detection
  - Organization status (color/tag coverage)
- **AI Search Instance Status:** Real-time indexing job visibility
  - Last sync time and files indexed on instance cards
  - New `/api/ai-search/instances/:name/status` endpoint
- **Dynamic File Type Detection:** Live supported types from Cloudflare API
- **Expanded Webhook Events:** 6 new events (15 total including file_move, file_copy, folder_create, etc.)
- **Auto-Detect Dev/Prod API:** `.env.development` for automatic API URL switching
- **Increased Rate Limits:** 300/100/30 requests per minute for READ/WRITE/DELETE
- **Support Email in Errors:** All API errors now include support contact
- **7 AI Search Bug Fixes:** Instance listing, sync, query results, status display
- **Local Development Fixes:** URL signing key fallback, cross-port API requests

### Version 3.1.0 (2025-12-11)

This minor release brings **Bucket Tagging**, **Bucket Color Tags**, **Automated Database Migrations**, and **Build Optimization** to the R2 Bucket Manager. Version 3.1.0 adds powerful organization and search capabilities for buckets.

**Key Features:**

- **Bucket Tagging:** Organize and search buckets with custom text tags
  - Add/remove multiple tags per bucket
  - Search buckets by tag with match-all/match-any modes
  - Tag management: add, remove, import/export tags
  - New "Search" navigation tab with Files and Tags sub-tabs
- **Bucket Color Tags:** Visual organization with 27-color palette
  - Click palette icon to assign colors to buckets
  - Available in both Grid and List views
  - Colors persist in D1 database
- **Build Optimization:** 30% bundle size reduction
  - Configured Vite manual chunks for vendor libraries
  - Lazy loading for tab-based feature components

### Version 3.0.0 (2025-12-08)

This major release brings **Metrics Dashboard**, **Webhooks**, **S3 Import**, **automated database migrations**, **audit logging for individual actions**, and **centralized logging** to the R2 Bucket Manager. Version 3.0.0 adds powerful monitoring, integration, and migration capabilities.

**Key Features:**

- **Metrics Dashboard:** R2 analytics and usage statistics
  - View requests, success rates, storage, and object counts
  - Time range selector: 24 Hours, 7 Days, 30 Days
  - Interactive charts and per-bucket metrics table
- **Webhooks:** Configure HTTP notifications for events
  - Support for file, bucket, and job events
  - HMAC-SHA256 signature verification
  - Test webhooks and manage configurations
- **S3 Import:** Migrate data from Amazon S3 to R2
  - Integration with Cloudflare Super Slurper
  - Real-time progress tracking with abort capability
- **Audit Logging:** Track all individual file, folder, and bucket operations
- **Automated Database Migrations:** One-click schema upgrades
- **Client-Side API Caching:** 50-80% performance improvement on repeat visits

### Version 2.0.0 (2025-11-27)

This major release brings **Job History tracking**, **AI Search integration**, **API rate limiting**, **upload integrity verification**, and **strict TypeScript compliance** to the R2 Bucket Manager. Version 2.0.0 represents a significant evolution with enterprise-grade features for auditing, AI-powered search, and robust API protection.

**Key Features:**

- **Job History Tracking:** Complete audit trail for all bulk operations
  - Track downloads, uploads, deletions, moves, and copies
  - Filterable job list with status, operation type, bucket, and date filters
  - Event timeline modal showing detailed operation progress
  - Real-time progress tracking with percentage completion
- **AI Search Integration:** Connect R2 buckets to Cloudflare AI Search
  - Semantic search and AI-powered question answering
  - Bucket compatibility analysis with visual reports
- **API Rate Limiting:** Tiered protection (100/30/10 requests per minute)
- **Upload Verification:** MD5 checksum verification for all uploads
- **Multi-Bucket Download:** Download multiple buckets as a single ZIP
- **Strict TypeScript:** Enterprise-grade type safety (280+ errors fixed)

### Version 1.2.0 (2025-10-27)

This minor release adds the highly requested **cross-bucket search** feature, allowing users to search for files across all buckets from the main page. The new search interface includes powerful filtering options (extension, size, date) and displays results in a sortable table with full file operations (download, move, copy, delete). This release also includes **bulk bucket deletion**, major code refactoring for improved maintainability, and several important bug fixes.

**Key Features:**

- **Cross-Bucket Search:** Search all buckets at once with advanced filters
  - Real-time search with 300ms debounce
  - Filter by extension, size, and date
  - Sortable results table with full file operations
  - Server-side parallel search for fast results
- **Bulk Bucket Deletion:** Select and delete multiple buckets at once
  - Visual checkbox selection with highlighting
  - Progress bar and status tracking
  - Force delete removes all files automatically
- **Bug Fixes:** Fixed file transfer path logic, rename operations, and ESLint configuration
- **Code Quality:** Major refactoring with extracted hooks for better maintainability

### Version 1.0.1 (2025-10-26)

This patch release fixes the local development environment which was previously non-functional. Developers can now run both frontend (Vite) and backend (Wrangler) servers locally with automatic authentication bypass and mock data support. No changes to production functionality.

### Version 1.0.0 (2025-10-24)

Initial production release with full R2 bucket management capabilities, enterprise authentication, and modern UI/UX.

---

## Stay Updated

- **GitHub Issues:** [Report bugs or request features](https://github.com/neverinfamous/R2-Manager-Worker/issues)
- **GitHub Discussions:** [Ask questions and discuss](https://github.com/neverinfamous/R2-Manager-Worker/discussions)
- **Release Article:** [v3.4.0 Release](https://adamic.tech/articles/r2-manager)
- **Previous Release:** [v3.3.0 Release](https://adamic.tech/articles/r2-manager)
