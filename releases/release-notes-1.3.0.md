# 🎉 R2 Bucket Manager v1.3.0 - Minor Release

**Release Date:** October 30, 2025  
**Status:** ✅ Production Ready

This minor release brings **major architectural simplification** by removing the D1 database dependency and adds the highly requested **multi-bucket download** feature. The removal of D1 makes deployment easier with no database setup required, while multi-bucket download enables backing up or migrating multiple buckets in a single operation.

---

## ✨ Added

### Multi-Bucket Download
- 📦 **Download Multiple Buckets as ZIP** - Select and download multiple buckets in one operation
  - "Select All" button on main page to quickly select all buckets
  - "Download Selected" button in bulk action toolbar (positioned between "Clear Selection" and "Delete Selected")
  - Downloads all selected buckets as a single ZIP file with each bucket as a top-level folder
  - Progress tracking with visual feedback (Preparing → Downloading → Complete)
  - Automatic deselection after successful download
  - No cumulative size limits - downloads all files from all selected buckets
  - Timestamped ZIP filename: `buckets-YYYY-MM-DDTHH-MM-SS.zip`
  - Files maintain their folder hierarchy within each bucket folder
  - Works seamlessly with existing bulk selection UI

### Use Cases for Multi-Bucket Download
- 💾 **Disaster Recovery** - Back up multiple buckets for disaster recovery
- 🚀 **Migration** - Migrate entire projects containing multiple buckets
- 📸 **Snapshots** - Create snapshots of development/staging environments
- 📦 **Archival** - Archive completed project buckets
- 🔄 **Transfer** - Transfer buckets between Cloudflare accounts

### Example ZIP Structure
```
buckets-2025-10-30T14-30-00.zip
├── bucket-one/
│   ├── file1.jpg
│   ├── folder/
│   │   └── file2.txt
│   └── file3.pdf
├── bucket-two/
│   ├── index.html
│   └── assets/
│       └── style.css
└── bucket-three/
    └── data.json
```

---

## 🔄 Changed

### Architecture Simplification - D1 Database Removed
- 🗑️ **No More Database Setup** - Removed D1 database dependency completely
  - Removed D1 database binding from all configuration files (`wrangler.toml`, `wrangler.dev.toml`, `wrangler.toml.example`)
  - Removed D1 operations from worker routes (bucket ownership tracking)
  - Removed D1 type definitions and interfaces from worker types (`D1Database`, `D1PreparedStatement`, `D1Result`, `D1ExecResult`)
  - Removed `DB` binding from `Env` interface
  - Removed `bucket_owners` table operations (INSERT, UPDATE, DELETE)
  - Removed `worker/schema.sql` references from documentation
- ⚡ **Simpler Deployment** - 2 fewer setup steps (no `npx wrangler d1 create` or schema migration)
- 🎯 **Same Functionality** - All bucket operations now use Cloudflare R2 REST API directly
- 🔒 **Zero Trust Authentication** - Cloudflare Access/GitHub SSO handles all authentication and authorization
- 📉 **Lower Complexity** - Reduced maintenance burden with no database management required
- 📚 **Documentation Updated** - 22 files updated across main repo and 11 wiki pages to reflect D1 removal

### Why Remove D1?
The D1 database was originally used to track bucket ownership for multi-user scenarios. However, with Cloudflare Access (Zero Trust) authentication in place, user identity is handled at the authentication layer, and the database added unnecessary complexity. Removing D1:
- Simplifies the deployment process (no database creation, no schema migrations)
- Reduces infrastructure components to manage
- Eliminates potential database-related errors
- Maintains all functionality through Cloudflare Access policies
- Makes the codebase easier to understand and maintain

---

## 🐛 Fixed

### Workers.dev Subdomain Persistence
- ✅ Fixed subdomain being disabled on every deployment
- ✅ Added `workers_dev = true` to `wrangler.toml` to persist setting
- ✅ Added `preview_urls = true` to enable version-specific preview URLs
- ✅ Updated `wrangler.toml.example` with both settings
- ✅ Now `*.workers.dev` subdomain remains enabled after deployments

---

## 🛠️ Technical Details

### Multi-Bucket Download Implementation
- **New API Method:** `downloadMultipleBuckets()` in `src/services/api.ts`
  - Accepts array of bucket names
  - Returns blob for ZIP file download
- **New Worker Endpoint:** `POST /api/files/download-buckets-zip` in `worker/routes/files.ts`
  - Accepts JSON body: `{ buckets: string[] }`
  - Fetches all files from all specified buckets in parallel
  - Uses JSZip to create nested folder structure (bucket/folder/file.ext)
  - Streams ZIP file back to client
- **Frontend State Management:**
  - Progress tracking state: `'idle' | 'preparing' | 'downloading' | 'complete'`
  - Visual feedback during all phases of download
  - Error handling with user-friendly messages
- **~200 Lines of New Code** across 3 files (`api.ts`, `files.ts`, `app.tsx`)

### D1 Database Removal
- **Removed Files/Sections:**
  - D1 database binding configuration from all wrangler files
  - D1 type definitions (D1Database, D1PreparedStatement, D1Result, D1ExecResult)
  - DB binding from Env interface in `worker/types.ts`
  - bucket_owners table operations (INSERT, UPDATE, DELETE)
  - worker/schema.sql references from documentation
- **Updated Documentation:**
  - Main repo: 11 files (code, config, README, release notes, security)
  - Wiki: 11 pages (installation, config, troubleshooting, architecture, etc.)
- **Lines Removed:** ~300+ lines of D1-related code and documentation
- **Architecture Benefits:**
  - Simpler deployment (2 fewer setup steps)
  - No database management required
  - Lower complexity and maintenance burden
  - Same functionality with Zero Trust authentication

### UI Enhancements
- **Green "Select All" Button** - Positioned on left side of bulk action toolbar
- **Blue "Download Selected" Button** - Between "Clear Selection" and "Delete Selected"
- **Improved Spacing** - 3px gap between checkbox and bucket name for better visual clarity
- **Toolbar State Management** - Shows/hides buttons based on selection state

### Build & Quality Metrics
- ✅ **TypeScript Compilation:** Clean (0 errors)
- ✅ **ESLint:** Clean (0 errors, 0 warnings)
- ✅ **Bundle Size Impact:** Minimal increase (~0.3 kB gzipped)
- ✅ **Browser Testing:** All features verified working in Chrome/Edge

---

## 📦 Downloads

- **Source Code (zip):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v1.3.0.zip)
- **Source Code (tar.gz):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v1.3.0.tar.gz)
- **Docker Image:** `docker pull writenotenow/r2-bucket-manager:v1.3.0`

---

## 🐳 Docker Updates

Version 1.3.0 Docker images are available on Docker Hub:
- **Latest Tag:** `writenotenow/r2-bucket-manager:latest`
- **Specific Version:** `writenotenow/r2-bucket-manager:v1.3.0`

Use `docker pull writenotenow/r2-bucket-manager:latest` to get the updated image.

---

## 🚀 Upgrade Instructions

### From v1.2.0 to v1.3.0

**Important:** This release removes the D1 database dependency. If you had previously set up a D1 database, you can optionally delete it (it's no longer used).

1. **Pull the latest code:**
   ```bash
   git pull origin main
   ```

2. **Update dependencies:**
   ```bash
   npm install
   ```

3. **Update your wrangler.toml:**
   - Remove any D1 database bindings if present:
   ```toml
   # Remove this section if it exists:
   [[d1_databases]]
   binding = "DB"
   database_name = "your-database-name"
   database_id = "your-database-id"
   ```

4. **Rebuild the application:**
   ```bash
   npm run build
   ```

5. **Deploy to Cloudflare Workers:**
   ```bash
   npx wrangler deploy
   ```

6. **(Optional) Delete the old D1 database:**
   ```bash
   npx wrangler d1 delete your-database-name
   ```

**Note:** No other configuration changes required. This is a seamless upgrade with reduced complexity!

### From v1.0.x to v1.3.0

Follow the same steps as above. The D1 database was never required in v1.0.x, so you can upgrade directly.

---

## 📖 Documentation

- [Installation & Setup Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Installation-&-Setup)
- [API Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/API-Reference)
- [Configuration Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Configuration-Reference)
- [Development Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Development-Guide)
- [Multi-Bucket Download Documentation](https://github.com/neverinfamous/R2-Manager-Worker#-multi-bucket-download)
- [Troubleshooting](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Troubleshooting)

---

## 🎯 Key Highlights

### Multi-Bucket Download
- **One-Click Selection** - "Select All" button for quick bulk operations
- **Parallel Fetching** - Downloads all buckets simultaneously for speed
- **Organized Structure** - Each bucket becomes a top-level folder in the ZIP
- **No Size Limits** - Downloads all files regardless of total size
- **Progress Feedback** - Visual indicators during preparation and download phases

### Architecture Simplification
- **Fewer Components** - No database to create, migrate, or maintain
- **Easier Onboarding** - 2 fewer steps in the setup process
- **Cleaner Codebase** - ~300 lines of code removed
- **Same Security** - Zero Trust authentication handles all authorization
- **Better Performance** - Direct R2 API calls without database overhead

---

## 🔗 Links

- **Live Demo:** https://r2.adamic.workers.dev/
- **GitHub Repository:** https://github.com/neverinfamous/R2-Manager-Worker
- **Docker Hub:** https://hub.docker.com/r/writenotenow/r2-bucket-manager
- **GitHub Wiki:** https://github.com/neverinfamous/R2-Manager-Worker/wiki
- **CHANGELOG:** [View Full Changelog](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/CHANGELOG.md)

---

## 🎬 What's Next?

Looking ahead to v1.4.0 and beyond:
- **Rate Limiting** - API endpoint rate limiting with Cloudflare KV
- **Refactor Large Files** - Break down `worker/index.ts` and `filegrid.tsx` into smaller modules
- **AWS S3 Migration** - Tools for migrating from AWS S3 to R2
- **File Versioning** - Track and restore previous file versions
- **Audit Logging** - Track all user actions with detailed logs
- **Role-Based Access Control (RBAC)** - Fine-grained permissions
- **Custom Metadata** - User-defined tags and labels

See the full [Roadmap](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Roadmap) for details.

---

## 🙏 Acknowledgments

Thank you to everyone who provided feedback on the deployment process and requested multi-bucket download functionality. Special thanks to the Cloudflare community for their continued support and feature suggestions!

---

## 🐛 Known Issues

None at this time. If you encounter any issues, please [open an issue](https://github.com/neverinfamous/R2-Manager-Worker/issues) on GitHub.

---

## 📝 Full Changelog

See [CHANGELOG.md](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/CHANGELOG.md) for the complete version history.

---

**Made with ❤️ for the Cloudflare community**

