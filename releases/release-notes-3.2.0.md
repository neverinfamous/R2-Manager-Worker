# 🎉 R2 Bucket Manager v3.2.0 - Minor Release

**Release Date:** January 9, 2026  
**Status:** ✅ Production Ready

This minor release brings **Metrics Storage Tab**, **Health Dashboard**, **Expanded Webhook Events**, **AI Search Improvements**, and significant **Developer Experience** enhancements to the R2 Bucket Manager. Version 3.2.0 adds powerful monitoring, operational visibility, and streamlined local development.

---

## ✨ What's New

### 📊 Metrics Dashboard Storage Tab

Dedicated storage trend visualization with comprehensive bucket analytics.

- **New "Storage" Tab** - View storage and object count trends over time
- **Storage Distribution Chart** - Visualize storage allocation by bucket
- **Storage Details Table** - Per-bucket breakdown with percentages
- **Bucket Filtering** - Filter metrics by specific bucket using dropdown selector
- **API Support** - New `bucketName` query parameter for filtered metrics

---

### 🏥 Health Dashboard

New tab providing at-a-glance operational status and system health monitoring.

- **System Health Score** - 0-100 score based on job failures, webhook config, and organization
- **Summary Cards** - Quick view of buckets, operations, webhooks, and recent jobs
- **Failed Jobs Alert** - Expandable details for failed job investigation
- **Low Activity Detection** - Identifies buckets with 7+ days without activity
- **Organization Status** - Displays color/tag coverage across buckets
- **2-Minute Caching** - Optimized performance with smart caching
- **New Backend Route** - `GET /api/health`

---

### 🤖 AI Search Instance Status

Real-time visibility into AI Search indexing jobs.

- **Instance Cards** - Now display last sync time and files indexed count
- **Parallel Loading** - Status data fetched in parallel for fast loading
- **New Backend Endpoint** - `GET /api/ai-search/instances/:name/status`
- **Job History** - Returns up to 10 recent indexing jobs per instance

---

### 📁 Dynamic File Type Detection

Always up-to-date supported file types for AI Search compatibility.

- **New Backend Endpoint** - `GET /api/ai-search/supported-types`
- **Live API Integration** - Dynamically fetches types from Cloudflare `toMarkdown()` API
- **Smart Caching** - 5-minute cache with fallback to hardcoded list
- **Extended Formats** - Includes `.pdf`, `.docx`, `.odt`, `.jpeg` and more

---

### 🪝 Expanded Webhook Events

6 new granular event types for comprehensive R2 operation tracking.

| Event | Description |
|-------|-------------|
| `file_move` | Track file transfer operations |
| `file_copy` | Monitor file duplication |
| `file_rename` | Capture file rename events |
| `folder_create` | Monitor folder creation |
| `folder_delete` | Track folder removal |
| `bucket_rename` | Capture bucket rename operations |

- **Total Events** - Increased from 7 to 15 webhook event types
- **Future Events** - Helper payloads for `bulk_download_complete`, `s3_import_complete`

---

### ⚡ Auto-Detect Dev/Prod API Endpoint

Simplified local development workflow with automatic environment detection.

- **New `.env.development`** - Automatic API URL switching for development
- **Vite Integration** - Auto-loads development config during `npm run dev`
- **Zero Configuration** - No manual commenting/uncommenting of `VITE_WORKER_API`

---

## 🐛 Fixed

### Local Development Environment

Fixed issues preventing local development from working ([#149](https://github.com/neverinfamous/R2-Manager-Worker/issues/149)).

- **URL Signing Key Fallback** - Auto-generates random signing key when `URL_SIGNING_KEY` not configured
- **Metrics API** - Updated to use `VITE_WORKER_API` for cross-port requests
- **Webhooks API** - Updated to use `VITE_WORKER_API` for cross-port requests
- **Vite Compatibility** - Replaced `process.env.NODE_ENV` with `import.meta.env.DEV`

Thanks to [@denzyve](https://github.com/denzyve) for identifying these issues in [PR #150](https://github.com/neverinfamous/R2-Manager-Worker/pull/150).

### AI Search Fixes

- **Instance Listing** - Fixed instances not appearing (corrected API response parsing)
- **Sync Operations** - Fixed "Route not found" error (changed POST to PATCH)
- **Query Results** - Fixed empty results (added response transformation)
- **Instance Status** - Fixed "Last sync" time not displaying (corrected field mappings)

### Docker Scout Security Scan

- Fixed vulnerability check incorrectly blocking builds
- Grep pattern now correctly parses CRITICAL/HIGH counts
- MEDIUM/LOW vulnerabilities no longer falsely trigger failures

---

## 🔄 Changed

### Increased API Rate Limits

Prevents 429 errors during rapid UI navigation.

| Tier | Previous | New |
|------|----------|-----|
| READ | 100/min | 300/min |
| WRITE | 30/min | 100/min |
| DELETE | 10/min | 30/min |

### Support Email in Error Messages

All API error responses now include support contact.

- **New Utility** - Centralized `createErrorResponse` in `worker/utils/error-response.ts`
- **Automatic Inclusion** - Support email (`admin@adamic.tech`) for all 4xx/5xx errors
- **Consistent Format** - `{ error, support?, code?, details? }`
- **70+ Locations** - Updated across 8 route files

### Dependency Updates

| Package | Previous | New |
|---------|----------|-----|
| `@cloudflare/workers-types` | 4.20251213.0 | 4.20260109.0 |
| `@types/node` | 25.0.2 | 25.0.3 |
| `esbuild` | 0.27.1 | 0.27.2 |
| `eslint-plugin-react-refresh` | 0.4.25 | 0.4.26 |
| `globals` | 16.5.0 | 17.0.0 |
| `lucide-react` | 0.561.0 | 0.562.0 |
| `typescript-eslint` | 8.49.0 | 8.52.0 |
| `vite` | 7.3.0 | 7.3.1 |
| `wrangler` | 4.55.0 | 4.58.0 |

---

## 📖 Documentation

- **Added** [Upgrade Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Upgrade-Guide) - Comprehensive documentation for the automated in-app upgrade system covering all 4 schema migrations

---

## 🛠️ Technical Details

### New API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | System health status and metrics |
| `/api/ai-search/instances/:name/status` | GET | AI Search instance indexing status |
| `/api/ai-search/supported-types` | GET | Dynamic file type detection |

### Code Quality Metrics

- ✅ **TypeScript:** Clean compilation with strict mode
- ✅ **ESLint:** 0 errors
- ✅ **Browser Testing:** Verified in Chrome/Edge

---

## 📦 Downloads

- **Source Code (zip):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v3.2.0.zip)
- **Source Code (tar.gz):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v3.2.0.tar.gz)
- **Docker Image:** `docker pull writenotenow/r2-bucket-manager:v3.2.0`

---

## 🚀 Upgrade Instructions

### From v3.1.0 to v3.2.0

1. **Pull the latest code:**
   ```bash
   git pull origin main
   ```

2. **Update dependencies:**
   ```bash
   npm install
   ```

3. **Rebuild and deploy:**
   ```bash
   npm run build
   npx wrangler deploy
   ```

No database migrations required for this release.

---

## 🔗 Links

- **Live Demo:** https://r2.adamic.tech/
- **GitHub Repository:** https://github.com/neverinfamous/R2-Manager-Worker
- **Docker Hub:** https://hub.docker.com/r/writenotenow/r2-bucket-manager
- **GitHub Wiki:** https://github.com/neverinfamous/R2-Manager-Worker/wiki
- **Release Article:** https://adamic.tech/articles/r2-manager
- **CHANGELOG:** [View Full Changelog](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Changelog)

---

## 🔜 What's Next?

Looking ahead to v3.3.0 and beyond:

### Planned Features
- **File Versioning** - Track and restore previous file versions
- **Advanced Webhooks** - Custom headers, retry logic, and delivery logs
- **Offline Upload Queue** - Resumable uploads with service workers

See the full [Roadmap](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Roadmap) for details.

---

## 🐛 Known Issues

None reported at this time.

If you encounter any issues, please [open an issue](https://github.com/neverinfamous/R2-Manager-Worker/issues) on GitHub with:
- Version number (3.2.0)
- Browser and OS
- Steps to reproduce
- Expected vs actual behavior

---

## 🎬 Breaking Changes

No breaking changes in this release. All v3.1.0 functionality remains intact.

---

## 🛡️ Security

No security changes in this release. All security features from v3.1.0 remain active.

---

## 🙏 Acknowledgments

Special thanks to [@denzyve](https://github.com/denzyve) for identifying and reporting local development issues that were fixed in this release.

---

**Made with ❤️ for the Cloudflare community**
