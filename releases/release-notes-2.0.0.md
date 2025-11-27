# 🎉 R2 Bucket Manager v2.0.0 - Major Release

**Release Date:** November 27, 2025  
**Status:** ✅ Production Ready

This major release brings **Job History tracking**, **AI Search integration**, **API rate limiting**, **upload integrity verification**, and **strict TypeScript compliance** to the R2 Bucket Manager. Version 2.0.0 represents a significant evolution with enterprise-grade features for auditing, AI-powered search, and robust API protection.

---

## ✨ What's New

### 📋 Job History Tracking
Track all bulk operations with a complete audit trail and event timeline.

- **Operation Tracking** - Automatically track downloads, uploads, deletions, moves, and copies
- **Filterable Job List** - Filter by status, operation type, bucket, date range, and job ID
- **Event Timeline Modal** - View detailed progress history for each job
- **Real-time Progress** - See percentage completion and item counts during operations
- **Error Tracking** - Identify failed items with detailed error messages
- **Navigation Tabs** - Switch between "Buckets" and "Job History" views

**Use Cases:**
- 📊 **Audit Compliance** - Track who performed what operations and when
- 🔍 **Troubleshooting** - Identify failed operations and specific error causes
- 📈 **Monitoring** - Track long-running bulk operations in real-time
- 📋 **Reporting** - Export job history for compliance reports

### 🤖 AI Search Integration
Connect R2 buckets to Cloudflare AI Search for powerful semantic search and AI-powered Q&A.

- **Compatibility Analysis** - See which files can be indexed (supports MD, TXT, JSON, YAML, code files)
- **Visual Reports** - Donut chart showing indexable vs non-indexable file ratios
- **Dual Search Modes** - AI-powered (with LLM) and semantic (retrieval only)
- **Instance Management** - List, sync, and query AI Search instances from the UI
- **Direct Dashboard Link** - Quick access to create instances in Cloudflare Dashboard

### 🛡️ API Rate Limiting
Tiered protection for API endpoints prevents abuse while ensuring fair resource access.

| Tier | Operations | Limit | Period |
|------|------------|-------|--------|
| **READ** | List, Search, Signed URLs | 100 req | 60s |
| **WRITE** | Upload, Rename, Move | 30 req | 60s |
| **DELETE** | Remove Files/Buckets | 10 req | 60s |

- Per-user enforcement using authenticated email
- Standard 429 responses with retry guidance
- Automatic bypass for localhost development

### ✓ Upload Integrity Verification
MD5 checksum verification ensures uploaded files match stored files exactly.

- Client-side MD5 calculation during upload
- Server-side verification against R2 ETag
- Visual feedback: "Verifying..." → "✓ Verified"
- Prevents silent upload failures and data corruption
- Works for both single-chunk and multi-chunk uploads

### 📦 Multi-Bucket Download
Download multiple buckets as a single ZIP archive.

- "Select All" button for quick bulk selection
- Downloads all selected buckets with folder structure preserved
- Progress tracking with visual feedback
- Timestamped ZIP filename

### 🔒 Strict TypeScript Compliance
Enterprise-grade type safety across the entire codebase.

- Fixed 280+ ESLint errors and 55 type safety warnings
- All `no-unsafe-*` rules enforced as errors
- Explicit return types on all functions
- No `any` types - proper type assertions everywhere

---

## 🔄 Changed

### Architecture Enhancement
- **D1 Database for Job History** - New `METADATA` binding stores job tracking data
- **Schema Includes:**
  - `bulk_jobs` table for job records
  - `job_audit_events` table for event timeline
  - Optimized indexes for filtering and pagination

---

## 🐛 Fixed

- **Workers.dev Subdomain** - Now persists after deployments with `workers_dev = true`
- **Preview URLs** - Enabled version-specific preview URLs

---

## 🛠️ Technical Details

### Job History Implementation
```
New files:
├── worker/routes/jobs.ts (~550 lines)
├── worker/schema.sql (database schema)
├── src/components/job-history/
│   ├── JobHistory.tsx (~350 lines)
│   ├── JobHistoryDialog.tsx (~180 lines)
│   └── index.ts
├── src/styles/job-history.css (~400 lines)
└── src/services/api.ts (new methods)
```

**API Endpoints:**
- `GET /api/jobs` - List jobs with filtering
- `GET /api/jobs/:jobId` - Get job details
- `GET /api/jobs/:jobId/events` - Get event timeline

### Code Quality Metrics
- ✅ **TypeScript:** Clean compilation with strict mode
- ✅ **ESLint:** 0 errors (only intentional console warnings)
- ✅ **Bundle Size:** ~420 kB gzipped (minimal increase)
- ✅ **Browser Testing:** Verified in Chrome/Edge

---

## 📦 Downloads

- **Source Code (zip):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v2.0.0.zip)
- **Source Code (tar.gz):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v2.0.0.tar.gz)
- **Docker Image:** `docker pull writenotenow/r2-bucket-manager:v2.0.0`

---

## 🚀 Upgrade Instructions

### From v1.x to v2.0.0

1. **Pull the latest code:**
   ```bash
   git pull origin main
   ```

2. **Update dependencies:**
   ```bash
   npm install
   ```

3. **Create D1 database for job history:**
   ```bash
   npx wrangler d1 create r2-manager-metadata
   ```

4. **Update `wrangler.toml` with the database binding:**
   ```toml
   [[d1_databases]]
   binding = "METADATA"
   database_name = "r2-manager-metadata"
   database_id = "your-database-id"
   ```

5. **Run the schema migration:**
   ```bash
   npx wrangler d1 execute r2-manager-metadata --remote --file=worker/schema.sql
   ```

6. **Rebuild and deploy:**
   ```bash
   npm run build
   npx wrangler deploy
   ```

**Note:** Job history is optional. If you don't configure the D1 database, the app will function normally without job tracking.

---

## 📖 Documentation

- [Job History Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Job-History)
- [AI Search Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/AI-Search)
- [Installation & Setup](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Installation-&-Setup)
- [API Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/API-Reference)
- [Configuration Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Configuration-Reference)

---

## 🎯 Key Highlights

### For Administrators
- **Complete Audit Trail** - Track all user operations for compliance
- **Rate Limiting** - Protect your API from abuse
- **Upload Verification** - Ensure data integrity

### For Developers
- **Strict TypeScript** - Catch errors at compile time
- **Clean Architecture** - Well-organized code with extracted hooks
- **Comprehensive API** - Full REST API for programmatic access

### For End Users
- **Job History View** - Monitor your bulk operations
- **AI-Powered Search** - Find files using natural language
- **Multi-Bucket Downloads** - Backup multiple buckets at once

---

## 🔗 Links

- **Live Demo:** https://r2.adamic.tech/
- **GitHub Repository:** https://github.com/neverinfamous/R2-Manager-Worker
- **Docker Hub:** https://hub.docker.com/r/writenotenow/r2-bucket-manager
- **GitHub Wiki:** https://github.com/neverinfamous/R2-Manager-Worker/wiki
- **CHANGELOG:** [View Full Changelog](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/CHANGELOG.md)

---

## 🎬 What's Next?

Looking ahead to v2.1.0 and beyond:
- **More Operation Tracking** - Track uploads, deletions, and transfers
- **Job Export** - Export job history to CSV/JSON
- **AWS S3 Migration** - Tools for migrating from AWS S3 to R2
- **File Versioning** - Track and restore previous file versions
- **Custom Metadata** - User-defined tags and labels

See the full [Roadmap](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Roadmap) for details.

---

## 🙏 Acknowledgments

Thank you to everyone who contributed feedback and feature requests. Special thanks to the Cloudflare community for their continued support!

---

## 🐛 Known Issues

None at this time. If you encounter any issues, please [open an issue](https://github.com/neverinfamous/R2-Manager-Worker/issues) on GitHub.

---

## 📝 Full Changelog

See [CHANGELOG.md](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/CHANGELOG.md) for the complete version history.

---

**Made with ❤️ for the Cloudflare community**

