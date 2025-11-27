# Changelog

*Last Updated November 27, 2025*

All notable changes to R2 Bucket Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-11-27

### 🎉 Major Release Highlights

Version 2.0.0 is a major release featuring **Job History tracking**, **AI Search integration**, **API rate limiting**, **upload integrity verification**, and **strict TypeScript compliance**. This release represents a significant evolution of the R2 Bucket Manager with enterprise-grade features and code quality improvements.

### Added
- **Job History Tracking** - Complete audit trail for bulk operations
  - Track all bulk operations: downloads, uploads, deletions, file moves/copies
  - Filterable job list by status, operation type, bucket, date range
  - Real-time progress tracking with percentage completion
  - Event timeline modal showing detailed operation history
  - Job search by ID for quick lookup
  - Sorting by date, items count, or error count
  - D1 database storage with `bulk_jobs` and `job_audit_events` tables
  - New navigation tabs to switch between "Buckets" and "Job History" views
  - API endpoints: `GET /api/jobs`, `GET /api/jobs/:jobId`, `GET /api/jobs/:jobId/events`
  - Visual status badges (queued, running, completed, failed, cancelled)
  - Operation-specific icons (download, upload, delete, move, copy, sync)

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
  - Filter inputs and selects now have proper id and name attributes
  - AI Search query and options have accessible identifiers
  - Checkbox elements include unique identifiers for screen readers

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
  - Standard rate limit response headers (Retry-After, X-RateLimit-*)
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
  - All bucket operations continue to use Cloudflare R2 REST API directly

### Fixed
- **Workers.dev Subdomain** - Fixed subdomain being disabled on every deployment
  - Added `workers_dev = true` to wrangler.toml to persist setting
  - Added `preview_urls = true` to enable version-specific preview URLs
  - Updated wrangler.toml.example with both settings
  - Now `*.workers.dev` subdomain remains enabled after deployments

### Technical Details
- **Job History Implementation:**
  - New route file: `worker/routes/jobs.ts` (~550 lines)
  - New frontend components: `src/components/job-history/` (JobHistory.tsx, JobHistoryDialog.tsx)
  - New CSS: `src/styles/job-history.css` (~400 lines)
  - D1 schema: `worker/schema.sql` with bulk_jobs and job_audit_events tables
  - API service methods: `getJobList()`, `getJobEvents()`, `getJobStatus()`
  - Integrated job tracking in file operations (downloads)
  - Navigation tabs in app.tsx for view switching
  - ~1,500 lines of new code across 8 files

- **AI Search Implementation:**
  - New route file: `worker/routes/ai-search.ts` (~600 lines)
  - New frontend components: `src/components/ai-search/` (AISearchPanel, CompatibilityReport, AISearchQuery)
  - New CSS: `src/components/ai-search/ai-search.css` (~900 lines)
  - New API service methods in `src/services/api.ts`
  - New TypeScript types for AI Search responses in `worker/types/index.ts`
  - Uses Cloudflare Workers AI binding for native integration
  - Supports both AI-powered search (with LLM) and semantic search (retrieval only)
  - Mock data support for local development without AI binding
  - ~2,000 lines of new code across 8 files

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
  - Navigation tabs for switching between Buckets and Job History views
  - Green "Select All" button positioned on left side of toolbar
  - Blue "Download Selected" button between "Clear Selection" and "Delete Selected"
  - Toolbar shows/hides buttons based on selection state
  - Visual spacing improvements (3px between checkbox and bucket name)

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
  - Full file actions available from search results:
    - Download files directly
    - Move files between buckets with destination folder selection
    - Copy files between buckets with destination folder selection
    - Delete files with confirmation modal
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
  - Transfer modal help text updated for clarity
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

## [1.1.0] - UNRELEASED (merged into 1.2.0)

### Added
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
- **File Rename Operations** - Fixed image previews and video playback breaking after renaming files
  - Images now properly reload with updated filenames and fresh signed URLs after rename
  - Video files maintain playback functionality after rename operations
  - Subsequent rename operations now work correctly (fixed "Source file not found" error)
  - File list now refreshes synchronously after rename to prevent stale data
- **Context Menu** - Fixed "Copy Link" throwing TypeError when accessed from right-click menu
  - Changed `handleCopySignedUrl` to accept optional event parameter
  - Added optional chaining for event.stopPropagation()

### Changed
- **Code Architecture** - Major refactoring of `filegrid.tsx` for improved maintainability
  - Extracted `useFileSort` hook (122 lines) - Manages sorting state and logic
  - Extracted `useModalState` hook (95 lines) - Consolidates modal/dropdown states
  - Extracted `useFileFilters` hook (244 lines) - Handles all filtering logic
  - Reduced main file from 1,782 to 1,579 lines (11.4% reduction)
  - Improved code reusability and testability with custom hooks
  - All functionality preserved with zero regressions

### Technical Details
- Total lines extracted into reusable hooks: 461 lines
- New hook files created: 3 (`src/hooks/useFileSort.ts`, `useModalState.ts`, `useFileFilters.ts`)
- New UI components: Bulk action toolbar, enhanced delete modal with progress tracking
- New state management: `selectedBuckets`, `isBulkDeleting`, updated `deleteConfirmState`
- CSS additions: ~170 lines for selection, toolbar, and progress styling
- TypeScript compilation: Clean (0 errors)
- ESLint: Clean (0 errors, 0 warnings)
- Bundle size impact: Minimal (+0.8% gzipped)

## [1.0.2] - UNRELEASED

### Fixed
- **File Rename Operations** - Fixed image previews and video playback breaking after renaming files
  - Images now properly reload with updated filenames and fresh signed URLs after rename
  - Video files maintain playback functionality after rename operations
  - Subsequent rename operations now work correctly (fixed "Source file not found" error)
  - File list now refreshes synchronously after rename to prevent stale data
- **Context Menu** - Fixed "Copy Link" throwing TypeError when accessed from right-click menu
  - Changed `handleCopySignedUrl` to accept optional event parameter
  - Added optional chaining for event.stopPropagation()

### Changed
- **Code Architecture** - Major refactoring of `filegrid.tsx` for improved maintainability
  - Extracted `useFileSort` hook (122 lines) - Manages sorting state and logic
  - Extracted `useModalState` hook (95 lines) - Consolidates modal/dropdown states
  - Extracted `useFileFilters` hook (244 lines) - Handles all filtering logic
  - Reduced main file from 1,782 to 1,579 lines (11.4% reduction)
  - Improved code reusability and testability with custom hooks
  - All functionality preserved with zero regressions

### Technical Details
- Total lines extracted into reusable hooks: 461 lines
- New hook files created: 3 (`src/hooks/useFileSort.ts`, `useModalState.ts`, `useFileFilters.ts`)
- TypeScript compilation: Clean (0 errors)
- ESLint: Clean (0 errors, 0 warnings)
- Bundle size impact: Minimal (+0.5% gzipped)

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
- React 19.2.0
- Vite 7.1.11
- TypeScript 5.9.3
- Cloudflare Workers Runtime API
- Cloudflare R2 (S3-compatible storage)
- Cloudflare Access (Zero Trust authentication)

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

### Version 2.0.0
This major release brings **Job History tracking**, **AI Search integration**, **API rate limiting**, **upload integrity verification**, and **strict TypeScript compliance** to the R2 Bucket Manager. Version 2.0.0 represents a significant evolution with enterprise-grade features for auditing, AI-powered search, and robust API protection.

**Key Features:**
- **Job History Tracking:** Complete audit trail for all bulk operations
  - Track downloads, uploads, deletions, moves, and copies
  - Filterable job list with status, operation type, bucket, and date filters
  - Event timeline modal showing detailed operation progress
  - Real-time progress tracking with percentage completion
  - New navigation tabs to switch between Buckets and Job History views
- **AI Search Integration:** Connect R2 buckets to Cloudflare AI Search
  - Semantic search and AI-powered question answering
  - Bucket compatibility analysis with visual reports
  - Two search modes: AI-powered (with LLM) and semantic (retrieval only)
- **API Rate Limiting:** Tiered protection for API endpoints
  - READ: 100/min, WRITE: 30/min, DELETE: 10/min
  - Per-user enforcement with detailed 429 responses
- **Upload Verification:** MD5 checksum verification for all uploads
  - Automatic verification with visual feedback
  - Prevents silent upload failures and data corruption
- **Multi-Bucket Download:** Download multiple buckets as a single ZIP
- **Strict TypeScript:** Enterprise-grade type safety (280+ errors fixed)

### Version 1.2.0
This minor release adds the highly requested **cross-bucket search** feature, allowing users to search for files across all buckets from the main page. The new search interface includes powerful filtering options (extension, size, date) and displays results in a sortable table with full file operations (download, move, copy, delete). This release also includes **bulk bucket deletion**, major code refactoring for improved maintainability, and several important bug fixes including file transfer path logic and rename operations.

**Key Features:**
- **Cross-Bucket Search:** Search all buckets at once with advanced filters
  - Real-time search with 300ms debounce for optimal performance
  - Filter by extension (Images, Documents, Videos, Code, Archives, custom)
  - Filter by size (preset ranges or custom min/max)
  - Filter by date (preset ranges or custom date picker)
  - Sortable results table (filename, bucket, size, date)
  - Full file operations from search results (download, move, copy, delete)
  - Server-side parallel search for fast results across many buckets
- **Bulk Bucket Deletion:** Select and delete multiple buckets at once
  - Visual checkbox selection with highlighting
  - Progress bar and status tracking
  - Force delete removes all files automatically
- **Bug Fixes:** Fixed file transfer path logic, rename operations, and ESLint configuration
- **Code Quality:** Major refactoring with extracted hooks for better maintainability

### Version 1.1.0
MERGED INTO 1.2.0 - Originally planned for bulk bucket deletion feature.

### Version 1.0.1
This patch release fixes the local development environment which was previously non-functional. Developers can now run both frontend (Vite) and backend (Wrangler) servers locally with automatic authentication bypass and mock data support. No changes to production functionality.

### Version 1.0.0
Initial production release with full R2 bucket management capabilities, enterprise authentication, and modern UI/UX.

---

**Links:**
- [GitHub Repository](https://github.com/neverinfamous/R2-Manager-Worker)
- [Live Demo](https://r2.adamic.workers.dev/)
- [Docker Hub](https://hub.docker.com/r/writenotenow/r2-bucket-manager)
- [Documentation Wiki](https://github.com/neverinfamous/R2-Manager-Worker/wiki)

