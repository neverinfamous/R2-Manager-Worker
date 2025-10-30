# Changelog

All notable changes to R2 Bucket Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Cloudflare D1 (SQLite database)
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

