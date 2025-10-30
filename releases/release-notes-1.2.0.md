# 🎉 R2 Bucket Manager v1.2.0 - Minor Release

**Release Date:** October 27, 2025  
**Status:** ✅ Production Ready

This minor release adds the highly requested **cross-bucket search** feature, allowing users to search for files across all buckets from the main page. The new search interface includes powerful filtering options (extension, size, date) and displays results in a sortable table with full file operations (download, move, copy, delete). This release also includes **bulk bucket deletion**, major code refactoring for improved maintainability, and several important bug fixes.

---

## ✨ Added

### Cross-Bucket Search
- 🔍 **Search Across All Buckets** - Find files anywhere in your R2 storage
  - Expandable/collapsible search interface on bucket list page
  - Search by filename with real-time debounced search (300ms)
  - Server-side parallel search across all buckets for optimal performance
  - Search results displayed in sortable table (Filename, Bucket, Size, Upload Date)
  - Click column headers to sort results (ascending/descending)
  - Clickable bucket badges to navigate directly to source bucket
  - "Clear All" button to reset all filters and collapse search panel
  - Loading and empty state indicators
  - Active filter count badge when search is collapsed
  - Responsive design for mobile and tablet devices
  - Mock data support for local development

### Advanced Filtering
- 📁 **Filter by File Extension** with quick filters:
  - 📷 Images (.jpg, .png, .gif, .webp, .svg, etc.)
  - 📄 Documents (.pdf, .doc, .xlsx, .txt, .csv, etc.)
  - 🎬 Videos (.mp4, .mov, .webm, .avi, etc.)
  - 💻 Code (.js, .py, .html, .css, .ts, .go, etc.)
  - 📦 Archives (.zip, .rar, .tar, .gz, .7z, etc.)
  - Custom extension selection from available files
- 📏 **Filter by File Size** with preset ranges:
  - < 1 MB
  - 1-10 MB
  - 10-50 MB
  - 50-100 MB
  - \> 100 MB
  - Custom range with min/max size in MB
- 📅 **Filter by Upload Date** with preset ranges:
  - Today
  - Last 7 Days
  - Last 30 Days
  - Last 90 Days
  - This Year
  - Custom range with date picker

### Full File Operations from Search Results
- ⬇️ **Download files** directly with signed URLs
- 📋 **Copy files** between buckets with destination folder selection
- ➡️ **Move files** between buckets with destination folder selection
- 🗑️ **Delete files** with confirmation modal

### Bulk Bucket Deletion
- ☑️ **Select Multiple Buckets** - Checkbox selection for each bucket card
  - Visual highlighting with blue border and background
  - Bulk action toolbar showing selection count
  - "Clear Selection" button to deselect all buckets
  - "Delete Selected" button to initiate bulk force delete
- 📊 **Enhanced Confirmation Modal** - Supports both single and multiple bucket deletions
  - Lists all buckets to be deleted
  - Shows total file count across all selected buckets
  - Displays progress during deletion ("Deleting bucket X of Y...")
  - Visual progress bar showing deletion progress
- ⚡ **Robust Error Handling** - Individual failure handling (one bucket failing doesn't stop operation)
- 🗑️ **Force Delete Functionality** - Removes all files before deleting buckets

---

## 🐛 Fixed

### File Transfer Path Logic
- ✅ Files now correctly go to root folder when no destination path specified
- ✅ Folder paths properly handled whether they end with `/` or not
- ✅ Fixed issue where filename was treated as folder name, creating `filename/filename` structure
- ✅ Transfer modal help text updated for clarity

### File Rename Operations
- ✅ Images now properly reload with updated filenames and fresh signed URLs after rename
- ✅ Video files maintain playback functionality after rename operations
- ✅ Subsequent rename operations now work correctly (fixed "Source file not found" error)
- ✅ File list now refreshes synchronously after rename to prevent stale data

### Context Menu
- ✅ Fixed "Copy Link" throwing TypeError when accessed from right-click menu
- ✅ Changed `handleCopySignedUrl` to accept optional event parameter
- ✅ Added optional chaining for event.stopPropagation()

### ESLint Configuration
- ✅ Added `.wrangler` directory to ignored paths to prevent false positives

### React Hook Pattern
- ✅ Fixed `set-state-in-effect` error by replacing `useEffect` with `useMemo`

---

## 🔄 Changed

### Code Architecture - Major Refactoring
- 🎯 **Extracted Custom Hooks** for improved maintainability:
  - `useFileSort` hook (122 lines) - Manages sorting state and logic
  - `useModalState` hook (95 lines) - Consolidates modal/dropdown states
  - `useFileFilters` hook (244 lines) - Handles all filtering logic
  - `useSearch` hook (217 lines) - Cross-bucket search state management
- 📉 **Reduced Main File Complexity** - Filegrid.tsx reduced from 1,782 to 1,579 lines (11.4% reduction)
- ♻️ **Improved Code Reusability** - All functionality preserved with zero regressions
- ✅ **Enhanced Testability** - Extracted hooks are easier to test in isolation

---

## 🛠️ Technical Details

### New Backend Components
- **`worker/routes/search.ts`** (200 lines) - Parallel cross-bucket search API endpoint
  - Search endpoint: `GET /api/search` with query params for filters
  - Server-side parallel queries for optimal performance
  - Searches across thousands of files in seconds
  - Results limited to 100 files per search (configurable)

### New Frontend Components
- **`src/components/search/CrossBucketSearch.tsx`** (207 lines) - Main search interface
- **`src/components/search/SearchResultsTable.tsx`** (393 lines) - Results table with actions
- **`src/hooks/useSearch.ts`** (217 lines) - Search state management with debouncing
- **`src/types/search.ts`** (40 lines) - Type definitions for search functionality
- **`src/styles/search.css`** (383 lines) - Complete search component styling

### Modified Files
- **`worker/index.ts`** - Integrated search routes
- **`src/services/api.ts`** - Added `searchAcrossBuckets()` method
- **`src/app.tsx`** - Integrated search component above bucket grid
- **`eslint.config.js`** - Added `.wrangler` to ignores

### Build & Quality Metrics
- ✅ **Total New Code:** ~1,440 lines across 6 new files
- ✅ **TypeScript Compilation:** Clean (0 errors)
- ✅ **ESLint:** Clean (0 errors, 0 warnings)
- ✅ **Bundle Size Impact:** +0.1 kB gzipped (366.23 kB → 366.33 kB)
- ✅ **Browser Testing:** All features verified working in Chrome/Edge

---

## 🎯 Key Features Highlights

### Cross-Bucket Search
- **Real-time Search** - Debounced search activates automatically as you type (300ms delay)
- **Server-side Performance** - Parallel queries across all buckets for fast results
- **Sortable Results** - Click any column header to sort ascending/descending
- **Direct Actions** - Download, move, copy, or delete files directly from search results
- **Bucket Navigation** - Click bucket badge to jump directly to that bucket
- **Responsive Design** - Works perfectly on mobile, tablet, and desktop

### Bulk Bucket Deletion
- **Visual Selection** - Selected buckets highlighted with blue border and background
- **Progress Tracking** - Real-time progress bar during bulk deletion
- **Error Resilience** - Continues operation even if individual buckets fail
- **Force Delete** - Automatically removes all files before deleting buckets
- **Safety Features** - Clear warnings about permanent deletion that cannot be undone

### Code Quality Improvements
- **Extracted Hooks** - 461 lines extracted into 3 reusable hooks
- **Better Separation** - UI logic separated from business logic
- **Easier Testing** - Isolated hooks can be tested independently
- **Zero Regressions** - All existing functionality preserved

---

## 📦 Downloads

- **Source Code (zip):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v1.2.0.zip)
- **Source Code (tar.gz):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v1.2.0.tar.gz)
- **Docker Image:** `docker pull writenotenow/r2-bucket-manager:v1.2.0`

---

## 🐳 Docker Updates

Version 1.2.0 Docker images are available on Docker Hub:
- **Latest Tag:** `writenotenow/r2-bucket-manager:latest`
- **Specific Version:** `writenotenow/r2-bucket-manager:v1.2.0`

Use `docker pull writenotenow/r2-bucket-manager:latest` to get the updated image.

---

## 🚀 Upgrade Instructions

### From v1.0.x to v1.2.0

1. **Pull the latest code:**
   ```bash
   git pull origin main
   ```

2. **Update dependencies:**
   ```bash
   npm install
   ```

3. **Rebuild the application:**
   ```bash
   npm run build
   ```

4. **Deploy to Cloudflare Workers:**
   ```bash
   npx wrangler deploy
   ```

**Note:** No database migrations or configuration changes required. This is a seamless upgrade.

---

## 📖 Documentation

- [Installation & Setup Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Installation-&-Setup)
- [API Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/API-Reference)
- [Configuration Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Configuration-Reference)
- [Development Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Development-Guide)
- [Cross-Bucket Search Documentation](https://github.com/neverinfamous/R2-Manager-Worker#-cross-bucket-search-new-in-v120)
- [Bulk Bucket Deletion Documentation](https://github.com/neverinfamous/R2-Manager-Worker#-bulk-bucket-deletion)
- [Troubleshooting](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Troubleshooting)

---

## 🔗 Links

- **Live Demo:** https://r2.adamic.workers.dev/
- **GitHub Repository:** https://github.com/neverinfamous/R2-Manager-Worker
- **Docker Hub:** https://hub.docker.com/r/writenotenow/r2-bucket-manager
- **GitHub Wiki:** https://github.com/neverinfamous/R2-Manager-Worker/wiki
- **CHANGELOG:** [View Full Changelog](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/CHANGELOG.md)

---

## 🎬 What's Next?

Looking ahead to v1.3.0 and beyond:
- **Rate Limiting** - API endpoint rate limiting with Cloudflare KV
- **AWS S3 Migration** - Tools for migrating from AWS S3 to R2
- **File Versioning** - Track and restore previous file versions
- **Audit Logging** - Track all user actions in D1 database
- **Role-Based Access Control (RBAC)** - Fine-grained permissions
- **Custom Metadata** - User-defined tags and labels

See the full [Roadmap](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Roadmap) for details.

---

## 🙏 Acknowledgments

Thank you to everyone who requested the cross-bucket search feature and provided feedback on the bulk bucket deletion workflow. Your input helped shape this release!

---

## 🐛 Known Issues

None at this time. If you encounter any issues, please [open an issue](https://github.com/neverinfamous/R2-Manager-Worker/issues) on GitHub.

---

## 📝 Full Changelog

See [CHANGELOG.md](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/CHANGELOG.md) for the complete version history.

---

**Made with ❤️ for the Cloudflare community**

