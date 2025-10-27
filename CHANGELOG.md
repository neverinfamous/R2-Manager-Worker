# Changelog

All notable changes to R2 Bucket Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-10-27

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

### Version 1.1.0
This minor release adds a highly requested feature: **bulk bucket deletion**. Users can now select multiple buckets using checkboxes and delete them all at once with a single operation. The enhanced confirmation modal shows all buckets to be deleted, total file counts, and progress tracking during deletion. This release also includes the refactoring improvements and bug fixes from 1.0.2, including fixes for file rename operations and significant code quality improvements through custom hook extraction.

**Key Features:**
- Select multiple buckets with checkboxes (visual highlighting with blue border)
- Bulk action toolbar with selection count and action buttons
- Enhanced delete confirmation modal with progress bar
- Individual failure handling - operation continues even if one bucket fails
- All files automatically deleted before removing buckets (force delete)

### Version 1.0.2
MERGED INTO 1.1.0 - This patch release improves code maintainability through significant refactoring and fixes critical bugs with file rename operations. The refactoring extracts 3 custom hooks from the main FileGrid component, reducing complexity while maintaining 100% functionality. Users will notice that renamed files now properly maintain their image previews and video playback capabilities.

### Version 1.0.1
This patch release fixes the local development environment which was previously non-functional. Developers can now run both frontend (Vite) and backend (Wrangler) servers locally with automatic authentication bypass and mock data support. No changes to production functionality.

### Version 1.0.0
Initial production release with full R2 bucket management capabilities, enterprise authentication, and modern UI/UX.

---

**Links:**
- [GitHub Repository](https://github.com/neverinfamous/R2-Manager-Worker)
- [Live Demo](https://r2.adamic.tech/)
- [Docker Hub](https://hub.docker.com/r/writenotenow/r2-bucket-manager)
- [Documentation Wiki](https://github.com/neverinfamous/R2-Manager-Worker/wiki)

