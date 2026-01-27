# 🎉 R2 Bucket Manager v3.1.0 - Minor Release

**Release Date:** December 11, 2025  
**Status:** ✅ Production Ready

This minor release brings **Bucket Tagging**, **Bucket Color Tags**, **Automated Database Migrations**, and **Build Optimization** to the R2 Bucket Manager. Version 3.1.0 adds powerful organization and search capabilities for buckets.

---

## ✨ What's New

### 🏷️ Bucket Tagging - Organize and Search with Custom Tags

Organize your buckets with custom text tags and quickly find them using powerful search capabilities.

- **Multiple Tags Per Bucket** - Add as many tags as needed to categorize buckets
- **Tag Picker Interface** - Intuitive tag picker integrated in both List and Grid views
- **New "Search" Navigation Tab** with two sub-tabs:
  - **Files** - Cross-bucket file search (moved from expandable dialog)
  - **Tags** - Search buckets by tag with match modes
- **Search Modes**:
  - **Match All** - Find buckets that have ALL selected tags
  - **Match Any** - Find buckets that have ANY of the selected tags
- **Tag Management** - Add, remove, and organize tags
- **New Backend Routes**: `/api/tags`, `/api/buckets/:name/tags`
- **New Database Table**: `bucket_tags` with indexes for performance
- **5-Minute Backend Caching** - Optimized tag query performance
- **WCAG-Compliant UI** - Keyboard accessible with ARIA labels

**Use Cases:**

- 📁 **Project Organization** - Tag buckets by project, team, or environment
- 🔍 **Quick Discovery** - Find related buckets instantly with tag search
- 📊 **Categorization** - Group buckets by type, status, or any custom criteria

---

### 🎨 Bucket Color Tags - Visual Organization

Assign colors to buckets for quick visual identification with a 27-color palette.

- **One-Click Color Assignment** - Click the palette icon on any bucket
- **27-Color Palette** - Wide selection of colors organized in a 6-column grid
- **Available Everywhere** - Works in both Grid and List views
- **"Remove Color" Option** - Clear color assignments when needed
- **Persistent Storage** - Colors saved to D1 database (`bucket_colors` table)
- **New Backend Routes**:
  - `GET /api/buckets/colors` - Retrieve all bucket colors
  - `PUT /api/buckets/:name/color` - Update a bucket's color
- **5-Minute Client-Side Caching** - With automatic invalidation on mutations
- **WCAG-Compliant UI** - Full keyboard navigation with ARIA labels

**Use Cases:**

- 🔴 **Priority Marking** - Use red for critical, green for stable
- 🟡 **Status Indication** - Color-code by deployment stage
- 🔵 **Team Identification** - Different colors for different teams

---

### 🗃️ Automated Database Migrations - One-Click Schema Upgrades

Simplified database schema management with automatic upgrade detection.

- **Smart Detection** - Automatically detects when database schema is outdated
- **Upgrade Banner** - Visual prompt appears when migration is available
- **One-Click Upgrade** - Click "Upgrade Now" to apply pending migrations
- **Legacy Support** - Automatically detects legacy installations without version tracking
- **Version Tracking** - `schema_version` table tracks current database version
- **New API Endpoints**:
  - `GET /api/migrations/status` - Check if migrations are needed
  - `POST /api/migrations/apply` - Apply pending migrations

---

### ⚡ Build Optimization - 30% Bundle Size Reduction

Significantly improved initial page load performance through code splitting and lazy loading.

- **Vite Manual Chunks** - Split vendor libraries for better caching:
  - `vendor-react`: React core (11 KB gzip)
  - `vendor-icons`: lucide-react (1.6 KB gzip)
  - `vendor-utils`: jszip, jose, spark-md5, react-dropzone (20 KB gzip)
- **Lazy Loading** - Tab-based feature components load on-demand:
  - MetricsDashboard
  - S3ImportPanel
  - JobHistory
  - WebhookManager
- **Loading Spinner** - Smooth fallback during chunk loading
- **Results**:
  - Main bundle: 473KB → 332KB (-30%)
  - ~60KB of feature code now loads only when needed

---

## 🔄 Changed

### Dependency Updates

No dependency updates in this release. All dependencies remain at their current stable versions.

---

## 🛠️ Technical Details

### Database Changes

New tables added (automatically created via migrations):

```sql
-- Bucket tags storage
CREATE TABLE bucket_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bucket_name TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bucket_name, tag)
);

-- Bucket color assignments
CREATE TABLE bucket_colors (
  bucket_name TEXT PRIMARY KEY,
  color TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Code Quality Metrics

- ✅ **TypeScript:** Clean compilation with strict mode
- ✅ **ESLint:** 0 errors
- ✅ **Bundle Size:** ~332 kB main bundle (30% reduction from v3.0.0)
- ✅ **Browser Testing:** Verified in Chrome/Edge

---

## 📦 Downloads

- **Source Code (zip):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v3.1.0.zip)
- **Source Code (tar.gz):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v3.1.0.tar.gz)
- **Docker Image:** `docker pull writenotenow/r2-bucket-manager:v3.1.0`

---

## 🚀 Upgrade Instructions

### From v3.0.0 to v3.1.0

1. **Pull the latest code:**

   ```bash
   git pull origin main
   ```

2. **Update dependencies:**

   ```bash
   npm install
   ```

3. **Run database migrations (automatic):**

   After deploying v3.1.0:
   - Visit your R2 Manager UI
   - If migrations are needed, you'll see a banner at the top
   - Click "Upgrade Now" to apply migrations automatically

   This will add:
   - `bucket_tags` table for bucket tagging
   - `bucket_colors` table for color assignments

4. **Rebuild and deploy:**
   ```bash
   npm run build
   npx wrangler deploy
   ```

---

## 🔗 Links

- **Live Demo:** https://r2.adamic.tech/
- **GitHub Repository:** https://github.com/neverinfamous/R2-Manager-Worker
- **Docker Hub:** https://hub.docker.com/r/writenotenow/r2-bucket-manager
- **GitHub Wiki:** https://github.com/neverinfamous/R2-Manager-Worker/wiki
- **CHANGELOG:** [View Full Changelog](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/CHANGELOG.md)

---

## 🔜 What's Next?

Looking ahead to v3.2.0 and beyond:

### Planned Features

- **File Versioning** - Track and restore previous file versions
- **Advanced Webhooks** - Custom headers, retry logic, and delivery logs
- **Offline Upload Queue** - Resumable uploads with service workers

See the full [Roadmap](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Roadmap) for details.

---

## 🐛 Known Issues

None reported at this time.

If you encounter any issues, please [open an issue](https://github.com/neverinfamous/R2-Manager-Worker/issues) on GitHub with:

- Version number (3.1.0)
- Browser and OS
- Steps to reproduce
- Expected vs actual behavior

---

## 🎬 Breaking Changes

No breaking changes in this release. All v3.0.0 functionality remains intact.

### New API Endpoints

- `GET /api/tags` - List all tags
- `GET /api/buckets/:name/tags` - Get tags for a bucket
- `PUT /api/buckets/:name/tags` - Update bucket tags
- `GET /api/buckets/colors` - Get all bucket colors
- `PUT /api/buckets/:name/color` - Set bucket color
- `GET /api/migrations/status` - Check migration status
- `POST /api/migrations/apply` - Apply migrations

---

## 🛡️ Security

No security changes in this release. All security features from v3.0.0 remain active.

---

## 🙏 Acknowledgments

Thank you to everyone who contributed feedback and feature requests. Special thanks to beta testers who helped identify issues before release.

---

**Made with ❤️ for the Cloudflare community**
