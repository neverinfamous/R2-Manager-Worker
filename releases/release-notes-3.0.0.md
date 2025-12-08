# 🎉 R2 Bucket Manager v3.0.0 - Major Release

**Release Date:** December 8, 2025  
**Status:** ✅ Production Ready

This major release brings **S3 Import [BETA]**, **Metrics Dashboard**, **Webhooks**, **Bucket Filtering**, **Audit Logging**, **Automated Database Migrations**, and **Client-Side API Caching** to the R2 Bucket Manager. Version 3.0.0 represents a significant evolution with powerful monitoring, integration, and migration capabilities.

---

## ✨ What's New

### 🚀 S3 Import [BETA] - Migrate from Amazon S3 to R2

Seamlessly migrate data from Amazon S3, Google Cloud Storage, or any S3-compatible storage provider to Cloudflare R2 using the Super Slurper API.

- **Universal S3 Compatibility** - Migrate from:
  - Amazon S3 (all regions)
  - Google Cloud Storage
  - Any S3-compatible storage provider
- **Three-Panel Interface**:
  - **New Migration** - Create new migration jobs with credential validation
  - **Active Jobs** - Real-time progress tracking for running migrations
  - **History** - View completed and failed migration jobs
- **Smart Credentials Form** - AWS region selector with validation
- **Real-Time Progress** - Monitor migration status with abort capability
- **Dashboard Fallback** - Direct link to Cloudflare Dashboard for manual job creation
- **Mock Data Support** - Test UI without actual migrations in development

**Use Cases:**
- 📦 **Cloud Migration** - Move existing S3 data to Cloudflare R2 for cost savings
- 🔄 **Multi-Cloud Strategy** - Sync data between providers
- 🚚 **Data Transfer** - Bulk import from external S3 sources

**Note:** S3 Import is currently in BETA and should be tested thoroughly before production use.

---

### 📊 Metrics Dashboard - R2 Analytics & Usage Statistics

Comprehensive analytics for your R2 storage with interactive charts and per-bucket breakdowns.

- **Summary Cards**:
  - Total Requests (with trend indicator)
  - Success Rate (%)
  - Total Storage (formatted with units)
  - Total Object Count
- **Time Range Selector** - View metrics for 24 Hours, 7 Days, or 30 Days
- **Requests Trend Chart** - Line chart showing request volume over time with per-bucket breakdown
- **Storage Usage Chart** - Bar chart displaying storage per bucket
- **Per-Bucket Metrics Table** - Sortable table with detailed statistics:
  - Requests (success/failed counts)
  - Success rate percentage
  - Storage size
  - Object count
- **Performance Optimized** - 2-minute client-side cache for fast loading
- **GraphQL Integration** - Uses Cloudflare Analytics API (`r2OperationsAdaptiveGroups`, `r2StorageAdaptiveGroups`)

**Use Cases:**
- 📈 **Usage Monitoring** - Track R2 usage trends and patterns
- 💰 **Cost Analysis** - Identify high-traffic buckets for optimization
- 🔍 **Performance Insights** - Monitor success rates and error patterns
- 📊 **Capacity Planning** - Track storage growth over time

---

### 🔔 Webhooks - HTTP Notifications for R2 Events

Configure HTTP endpoints to receive real-time notifications for bucket and file operations.

- **Event Types**:
  - **File Events**: `file_upload`, `file_download`, `file_delete`
  - **Bucket Events**: `bucket_create`, `bucket_delete`
  - **Job Events**: `job_completed`, `job_failed`
- **Security First**:
  - HMAC-SHA256 signature support for payload verification
  - Custom secret keys per webhook
  - Signature included in `X-Webhook-Signature` header
- **Management Features**:
  - Create, edit, delete, and test webhook configurations
  - Enable/disable webhooks without deletion
  - Test webhooks with sample payloads
  - View webhook delivery status
- **Flexible Configuration**:
  - Multiple webhooks per event type
  - URL validation
  - Custom headers support (planned)

**Use Cases:**
- 🔔 **Notifications** - Alert external systems on file operations
- 🔄 **Automation** - Trigger workflows on bucket events
- 📝 **Logging** - Send events to external logging services
- 🔌 **Integration** - Connect R2 to other services (Slack, Discord, custom apps)

---

### 🗃️ Automated Database Migrations - One-Click Schema Upgrades

Simplified database schema management with automatic upgrade detection and one-click migrations.

- **Smart Detection** - Automatically detects when database schema is outdated
- **Upgrade Banner** - Visual prompt appears when migration is available
- **One-Click Upgrade** - Click "Upgrade Now" to apply pending migrations
- **Legacy Support** - Automatically detects legacy installations without version tracking
- **Version Tracking** - New `schema_version` table tracks current database version
- **Safe Migrations** - Uses `CREATE TABLE IF NOT EXISTS` to prevent data loss
- **New API Endpoints**:
  - `GET /api/migrations/status` - Check if migrations are needed
  - `POST /api/migrations/apply` - Apply pending migrations

**Use Cases:**
- 🔄 **Seamless Upgrades** - Update database schema without manual SQL execution
- 🛡️ **Data Safety** - Prevent schema drift and compatibility issues
- ⚡ **Quick Setup** - New features automatically add required database tables

---

### 🧭 Bucket Filter Bar - Enhanced Bucket Discovery

Client-side filtering for the main bucket list with multiple filter dimensions.

- **Name Filter** - Instant search by bucket name (real-time)
- **Size Filter**:
  - Preset ranges: Small (<10 MB), Medium (10-100 MB), Large (>100 MB)
  - Custom range: Set minimum and maximum sizes
- **Date Filter**:
  - Preset ranges: Last 7 Days, This Month, This Year
  - Custom range: Select start and end dates
- **Active Filter Badges** - Visual indicators for applied filters
- **Filter Stats** - Shows result count (e.g., "Showing 5 of 12 buckets")
- **Clear Filters** - One-click reset of all filters
- **Persistent UI** - Consistent design with existing file filter bar

**Use Cases:**
- 🔍 **Quick Discovery** - Find specific buckets in large accounts
- 📊 **Organization** - Filter by size to identify large buckets
- 📅 **Recent Activity** - Find recently created buckets
- 🧹 **Cleanup** - Identify old or unused buckets

---

### 📋 Audit Logging - Complete Individual Action Tracking

Extended Job History system to track all user operations, not just bulk actions.

- **File Operations** - Track every file action:
  - Upload, download, delete
  - Rename, move, copy
- **Folder Operations** - Track folder management:
  - Create, delete, rename
  - Move, copy
- **Bucket Operations** - Track bucket changes:
  - Create, delete, rename
- **Unified Job History UI** - Both bulk jobs and individual actions in one view
- **Grouped Operation Dropdown** - Operations organized by category:
  - Bulk, File, Folder, Bucket, AI
- **Status Tracking** - Success/failed status with detailed metadata
- **New Database Table** - `audit_log` table with optimized indexes
- **New API Endpoints**:
  - `GET /api/audit` - List audit log entries with filtering
  - `GET /api/audit/summary` - Get operation counts by type

**Use Cases:**
- 🔐 **Compliance** - Full audit trail for regulatory requirements
- 🔍 **Forensics** - Investigate what happened to specific files
- 👥 **User Tracking** - Monitor individual user actions
- 📊 **Usage Analytics** - Understand how R2 is being used

---

### ⚡ Client-Side API Caching - 50-80% Faster Page Loads

Intelligent caching system dramatically improves performance on repeat visits.

- **Bucket List Cache** - 5-minute TTL (300 seconds)
- **File List Cache** - First page only, 5-minute TTL
- **Smart Behavior**:
  - Used on initial load for instant rendering
  - Bypassed on user-triggered refreshes
  - Automatic invalidation on mutations (create/delete/rename)
- **Exponential Backoff Retry** - Resilient error handling:
  - Automatic retry for rate limits (429)
  - Retry for service errors (503/504)
  - Retry pattern: 2s → 4s → 8s (max 3 attempts)
- **Performance Gains**:
  - 50-80% faster page loads on repeat visits
  - Reduced API calls to Cloudflare
  - Better resilience to transient errors
  - Improved user experience with instant data display

---

### 🪣 Bucket Item Count Display

See the number of files/objects in each bucket at a glance.

- **Grid View** - Item count displayed below total size on bucket cards
- **List View** - New "Items" column in the bucket table
- **Zero API Overhead** - Counts objects during existing size calculation
- **Smart Formatting** - Locale-aware number separators for large counts (e.g., "1,234,567 items")
- **Accurate Counts** - Includes all objects and folders

---

### 📁 Persistent View Preference

Your preferred view mode now persists between sessions.

- **Applies to Both**:
  - Buckets list (Grid/List)
  - Files grid (Grid/List)
- **Local Storage** - Remembers your choice across browser sessions
- **Smart Defaults** - Defaults to List view for new sessions
- **Per-View Memory** - Separate preferences for buckets and files

---

### 🪵 Centralized Logger Service

Replaced all direct `console.*` calls with a proper logging abstraction.

- **Environment-Aware Logging**:
  - Development: All logs output to console
  - Production: Only warn/error levels (configurable)
- **Log Levels** - debug, info, warn, error with configurable minimum level
- **Context Tagging** - Organized logs with tags (e.g., `[API]`, `[FileGrid]`, `[Auth]`)
- **Extensible Design** - Ready for future remote logging integration
- **Clean ESLint** - Passes strict `no-console` rule without suppressions
- **Comprehensive Coverage** - ~150 console statements replaced across 15+ files

**Benefits:**
- 🛠️ **Better Debugging** - Context-aware log messages
- 🎯 **Production Ready** - Control log verbosity in production
- 🔌 **Future Ready** - Easy to add remote logging (Sentry, LogRocket, etc.)

---

## 🔄 Changed

### Dependency Updates

Critical dependencies updated to latest stable versions:

- **wrangler** → ^4.53.0 (from 4.36.0)
- **vite** → ^7.2.6 (latest)
- **lucide-react** → ^0.556.0 (icon library)
- **esbuild** → ^0.27.1 (unpinned from overrides)

### UI Refinements

Visual improvements for better user experience:

- **View Toggle Moved** - List/Grid toggle relocated to Bulk Actions Toolbar for better grouping
- **Button Color Updates**:
  - Rename button: Updated to standard blue accent color
  - Delete button: Muted red (opacity 0.9) for reduced harshness in dark mode
- **Toolbar Spacing** - Improved spacing in Bulk Actions Toolbar
- **Accessibility** - Added missing `id` and `name` attributes to "Select All Buckets" checkbox

---

## 🐛 Fixed

- **Accessibility** - Added required `id` and `name` attributes to form elements
- **Type Safety** - Resolved lingering TypeScript strict mode warnings
- **Cache Invalidation** - Fixed stale cache after mutations

---

## 🛠️ Technical Details

### S3 Import Implementation

```
New files:
├── worker/routes/s3-import.ts (~400 lines)
├── src/components/s3-import/
│   ├── S3ImportPanel.tsx (~320 lines)
│   ├── S3CredentialsForm.tsx (~180 lines)
│   ├── MigrationJobsList.tsx (~240 lines)
│   ├── s3-import.css (~200 lines)
│   └── index.ts
└── src/services/api.ts (new methods)
```

**API Endpoints:**
- `POST /api/s3-import/migrations` - Create migration job
- `GET /api/s3-import/migrations` - List migrations
- `GET /api/s3-import/migrations/:id` - Get migration details
- `DELETE /api/s3-import/migrations/:id` - Abort migration

### Metrics Dashboard Implementation

```
New files:
├── worker/routes/metrics.ts (~350 lines)
├── src/components/MetricsDashboard.tsx (~420 lines)
├── src/components/MetricsChart.tsx (~180 lines)
├── src/styles/metrics.css (~250 lines)
└── src/services/api.ts (new methods)
```

**GraphQL Queries:**
- `r2OperationsAdaptiveGroups` - Request/operation metrics
- `r2StorageAdaptiveGroups` - Storage/object count metrics

### Webhooks Implementation

```
New files:
├── worker/routes/webhooks.ts (~450 lines)
├── worker/utils/webhooks.ts (~200 lines)
├── src/components/webhooks/WebhookManager.tsx (~380 lines)
├── src/types/webhook.ts (~40 lines)
├── src/styles/webhooks.css (~220 lines)
└── worker/schema.sql (new table)
```

**Database Schema:**
```sql
CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  events TEXT NOT NULL,
  secret TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Audit Logging Implementation

```
Modified files:
├── worker/routes/audit.ts (~300 lines)
├── worker/schema.sql (new table + indexes)
├── src/components/job-history/JobHistory.tsx (updated)
└── src/services/api.ts (new methods)
```

**Database Schema:**
```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL,
  bucket_name TEXT,
  object_key TEXT,
  status TEXT NOT NULL,
  metadata TEXT,
  user_email TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Code Quality Metrics

- ✅ **TypeScript:** Clean compilation with strict mode
- ✅ **ESLint:** 0 errors (only intentional logging)
- ✅ **Bundle Size:** ~445 kB gzipped (6% increase from v2.0.0)
- ✅ **Browser Testing:** Verified in Chrome/Edge/Firefox
- ✅ **Lines of Code:** ~3,500 new lines (35% increase)

---

## 📦 Downloads

- **Source Code (zip):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v3.0.0.zip)
- **Source Code (tar.gz):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v3.0.0.tar.gz)
- **Docker Image:** `docker pull writenotenow/r2-bucket-manager:v3.0.0`

---

## 🚀 Upgrade Instructions

### From v2.0.0 to v3.0.0

1. **Pull the latest code:**
   ```bash
   git pull origin main
   ```

2. **Update dependencies:**
   ```bash
   npm install
   ```

3. **Run database migrations (automatic):**
   
   The new automated migration system will detect if your database needs upgrading. After deploying v3.0.0:
   
   - Visit your R2 Manager UI
   - If migrations are needed, you'll see a banner at the top
   - Click "Upgrade Now" to apply migrations automatically
   
   **Manual Migration (optional):**
   
   If you prefer to run migrations manually:
   ```bash
   npx wrangler d1 execute r2-manager-metadata --remote --file=worker/schema.sql
   ```
   
   This will add:
   - `audit_log` table for individual action tracking
   - `webhooks` table for webhook configurations
   - `schema_version` table for migration tracking
   - `migrations` table for migration history

4. **Rebuild and deploy:**
   ```bash
   npm run build
   npx wrangler deploy
   ```

### New Features Configuration

#### S3 Import

No additional configuration required. The feature uses your existing Cloudflare credentials.

#### Metrics Dashboard

No additional configuration required. Uses Cloudflare GraphQL Analytics API with your existing credentials.

#### Webhooks

Webhooks are ready to use immediately after migration. Create your first webhook:

1. Navigate to the "Webhooks" tab
2. Click "Create Webhook"
3. Enter your endpoint URL
4. Select events to listen for
5. (Optional) Add a secret for HMAC-SHA256 signature verification
6. Click "Create"

---

## 📖 Documentation

- [S3 Import Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/S3-Import) _(Coming Soon)_
- [Metrics Dashboard Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Metrics-Dashboard) _(Coming Soon)_
- [Webhooks Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Webhooks) _(Coming Soon)_
- [Job History & Audit Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Job-History)
- [Installation & Setup](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Installation-&-Setup)
- [API Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/API-Reference)
- [Configuration Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Configuration-Reference)

---

## 🎯 Key Highlights

### For System Administrators
- **Complete Visibility** - Metrics dashboard shows usage patterns
- **Integration Ready** - Webhooks connect R2 to external systems
- **Cloud Migration** - S3 Import for seamless provider switching
- **Audit Compliance** - Complete audit trail for all operations

### For Developers
- **Migration Tools** - Programmatic S3 import via API
- **Event-Driven** - Webhook support for automation
- **Extensible Logging** - Centralized logger ready for remote services
- **Clean TypeScript** - Strict type safety throughout

### For End Users
- **Better Performance** - 50-80% faster with client-side caching
- **Usage Insights** - See R2 usage trends and patterns
- **Bucket Discovery** - Filter buckets by name, size, and date
- **Persistent UI** - View preferences saved between sessions

---

## 🔗 Links

- **Live Demo:** https://r2.adamic.tech/
- **GitHub Repository:** https://github.com/neverinfamous/R2-Manager-Worker
- **Docker Hub:** https://hub.docker.com/r/writenotenow/r2-bucket-manager
- **GitHub Wiki:** https://github.com/neverinfamous/R2-Manager-Worker/wiki
- **CHANGELOG:** [View Full Changelog](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/CHANGELOG.md)

---

## 🔜 What's Next?

Looking ahead to v3.1.0 and beyond:

### Planned Features

- **Custom Metadata** - User-defined tags and labels for files
- **File Versioning** - Track and restore previous file versions
- **Advanced Webhooks** - Custom headers, retry logic, and delivery logs
- **Metrics Export** - Export analytics data to CSV/JSON
- **S3 Import Scheduling** - Scheduled/recurring migrations
- **Offline Upload Queue** - Resumable uploads with service workers
- **Bulk File Operations** - Multi-select with filtering in file grid

### Community Requests

Have a feature request? [Open a discussion](https://github.com/neverinfamous/R2-Manager-Worker/discussions) or [submit an issue](https://github.com/neverinfamous/R2-Manager-Worker/issues).

See the full [Roadmap](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Roadmap) for details.

---

## 🐛 Known Issues

### S3 Import [BETA]

- **Testing Status:** S3 Import is currently in BETA and has not been extensively tested in production environments
- **Recommendation:** Test migrations with non-critical data first
- **Limitations:**
  - Large migrations (>100GB) may take several hours
  - Migration progress updates may be delayed
  - Some S3-compatible providers may require custom endpoint configuration
- **Workaround:** For complex migrations, use the Cloudflare Dashboard directly

### General

- None reported at this time

If you encounter any issues, please [open an issue](https://github.com/neverinfamous/R2-Manager-Worker/issues) on GitHub with:
- Version number (3.0.0)
- Browser and OS
- Steps to reproduce
- Expected vs actual behavior

---

## 🙏 Acknowledgments

Thank you to everyone who contributed feedback, feature requests, and bug reports. Special thanks to:

- The Cloudflare community for continued support
- Beta testers who helped identify issues before release
- Contributors who submitted PRs and documentation improvements

---

## 📝 Full Changelog

See [CHANGELOG.md](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/CHANGELOG.md) for the complete version history.

---

## 🎬 Breaking Changes

### Database Schema

Version 3.0.0 adds new database tables. The automated migration system will handle upgrades automatically. If you're upgrading from v2.0.0:

- **No manual action required** - Migrations are automatic via the UI
- **Backward compatible** - Existing data is preserved
- **Optional manual migration** - Run `worker/schema.sql` if you prefer manual control

### API Changes

No breaking API changes. All existing v2.0.0 endpoints remain functional.

### New API Endpoints

The following endpoints are new in v3.0.0:

- `GET /api/metrics` - Metrics dashboard data
- `GET /api/webhooks`, `POST /api/webhooks`, etc. - Webhook management
- `GET /api/s3-import/migrations`, `POST /api/s3-import/migrations`, etc. - S3 import
- `GET /api/migrations/status`, `POST /api/migrations/apply` - Database migrations
- `GET /api/audit`, `GET /api/audit/summary` - Audit log

---

## 🛡️ Security

Version 3.0.0 includes the following security enhancements:

- **Webhook HMAC-SHA256** - Secure payload verification for webhooks
- **Audit Trail** - Complete logging of all user actions
- **Migration Safety** - Automated migrations use safe DDL statements
- **Dependency Updates** - Latest security patches for all dependencies

No known security vulnerabilities at release time.

**Report Security Issues:** See [SECURITY.md](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/SECURITY.md)

---

**Made with ❤️ for the Cloudflare community**


