# 🎉 R2 Bucket Manager v3.4.0 - Minor Release

**Release Date:** February 11, 2026  
**Status:** ✅ Production Ready

This minor release introduces **Local Uploads (BETA)** for up to 75% faster upload performance, upgrades to the **Node.js 24 LTS** baseline, fixes lifecycle rules displaying incorrect day values, resolves React 19 deprecation warnings, and remediates all ESLint disable suppressions across the codebase.

---

## ✨ What's New

### ⚡ Local Uploads Toggle (BETA)

Enable per-bucket local uploads for dramatically faster upload performance by writing data to storage near the client.

- **Up to 75% reduction** in upload latency
- **Inline toggle** in both list and grid bucket views
- **Optimistic UI** with loading and error states
- **Mock data support** for local development

#### New API Endpoints

| Endpoint                         | Method | Description                           |
| -------------------------------- | ------ | ------------------------------------- |
| `/api/local-uploads/:bucketName` | GET    | Get local uploads status for a bucket |
| `/api/local-uploads/:bucketName` | PUT    | Enable or disable local uploads       |

#### New Types

- `LocalUploadsStatus`, `LocalUploadsResponse`

#### New API Methods

- `getLocalUploadsStatus()`, `setLocalUploadsStatus()`

---

## 🔄 Changed

### Node.js 24 LTS Baseline

Upgraded from Node 20 to Node 24 LTS across all configurations.

- **Dockerfile** already using `node:24-alpine` for both builder and runtime stages
- **GitHub Actions** workflows updated to use Node 24.x as primary version
- **`package.json`** now includes `engines` field requiring Node.js >=24.0.0
- **README** prerequisites updated to specify Node.js 24+ (LTS)
- **DOCKER_README** updated to reflect Node 24-alpine base image

### Dependency Updates

| Package                       | Previous     | New          | Note         |
| ----------------------------- | ------------ | ------------ | ------------ |
| `@babel/core`                 | 7.28.6       | 7.29.0       |              |
| `@cloudflare/workers-types`   | 4.20260127.0 | 4.20260210.0 |              |
| `@types/node`                 | 25.0.10      | 25.2.3       |              |
| `@types/react`                | 19.2.10      | 19.2.14      |              |
| `@vitejs/plugin-react`        | 5.1.2        | 5.1.4        |              |
| `esbuild`                     | 0.27.2       | 0.27.3       |              |
| `eslint-plugin-react-refresh` | 0.4.26       | 0.5.0        | Major update |
| `globals`                     | 17.1.0       | 17.3.0       |              |
| `react-dropzone`              | 14.3.8       | 14.4.1       |              |
| `typescript-eslint`           | 8.54.0       | 8.55.0       |              |
| `wrangler`                    | 4.61.0       | 4.64.0       |              |

---

## 🛡️ Security

### tar Package Security

Updated tar override to 7.5.4 to fix HIGH severity CVEs:

- **CVE-2026-23745** (HIGH 8.2) - Path Traversal via hardlink/symlink escape
- **CVE-2026-23950** (HIGH 8.8) - Unicode handling race condition on macOS APFS

### Docker Security

Documented 3 curl CVEs as accepted upstream risks:

- CVE-2025-14819 (MEDIUM 5.3) - Fix 8.18.0-r0 not yet in Alpine repos
- CVE-2025-14524 (MEDIUM 5.3) - Fix 8.18.0-r0 not yet in Alpine repos
- CVE-2025-14017 (N/A) - Fix 8.18.0-r0 not yet in Alpine repos
- Will upgrade when Alpine publishes patched packages

---

## 🐛 Fixed

### Lifecycle Rules Display

Fixed lifecycle rules showing incorrect day values (e.g., 86,400 days instead of 1 day).

- `CreateLifecycleRuleModal.tsx` incorrectly converted days to seconds (`days * 86400`) before setting `maxAge`
- Cloudflare R2 lifecycle API `maxAge` is already in days, not seconds
- Affects both Expiration (Delete) and Transition to Infrequent Access rule types

### React 19 Compatibility

Resolved deprecated `FormEvent` usage across the codebase.

- Replaced deprecated `React.FormEvent` with inline type `{ preventDefault(): void }` in form handlers
- Fixed in `app.tsx`, `AISearchQuery.tsx`, `CreateLifecycleRuleModal.tsx`, `S3CredentialsForm.tsx`
- Removed unused eslint-disable directives in `filegrid.tsx`
- Added missing `sortedFilesRef` to useCallback dependency arrays

### ESLint Disable Remediation

Properly fixed all eslint-disable suppressions across the codebase:

| File                   | Fix Applied                                                                 |
| ---------------------- | --------------------------------------------------------------------------- |
| `JobHistory.tsx`       | Refactored to use separate `fetchJobs` callback with proper dependencies    |
| `JobHistoryDialog.tsx` | Wrapped `loadEvents` in useCallback with proper dependencies                |
| `ThemeContext.tsx`     | Split context into `theme-context-value.ts` for react-refresh compliance    |
| `useFileFilters.ts`    | Replaced useEffect + setState with useMemo for `availableExtensions`        |
| `api.ts`               | Extracted file validation regex to documented top-level constant            |
| `logger.ts`            | Consolidated 8 individual eslint-disable-next-line into single scoped block |
| `filegrid.tsx`         | Captured ref values at effect start for cleanup function pattern            |

---

## 📖 Documentation

- **Added** [Local Uploads](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Local-Uploads) wiki page
- **Updated** Sidebar and Home with Local Uploads feature link

---

## 🛠️ Technical Details

### Code Quality Metrics

- ✅ **TypeScript:** Clean compilation with strict mode
- ✅ **ESLint:** 0 errors, 0 suppressions
- ✅ **Prettier:** Fully formatted
- ✅ **Zero eslint-disable directives** remaining in codebase

---

## 📦 Downloads

- **Source Code (zip):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v3.4.0.zip)
- **Source Code (tar.gz):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v3.4.0.tar.gz)
- **Docker Image:** `docker pull writenotenow/r2-bucket-manager:v3.4.0`

---

## 🚀 Upgrade Instructions

### From v3.3.0 to v3.4.0

> ⚠️ **Node.js 24 Required:** This release requires Node.js 24+ (LTS). Please upgrade your Node.js installation before proceeding.

1. **Update Node.js to 24 LTS:**

   ```bash
   # Verify your Node.js version
   node --version  # Must be v24.x.x or higher
   ```

2. **Pull the latest code:**

   ```bash
   git pull origin main
   ```

3. **Update dependencies:**

   ```bash
   npm install
   ```

4. **Rebuild and deploy:**
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
- **CHANGELOG:** [View Full Changelog](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Changelog)

---

## 🔜 What's Next?

Looking ahead to future releases:

### Planned Features

- **File Versioning** - Track and restore previous file versions
- **Advanced Webhooks** - Custom headers, retry logic, and delivery logs
- **Offline Upload Queue** - Resumable uploads with service workers

See the full [Roadmap](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Roadmap) for details.

---

## 🐛 Known Issues

None reported at this time.

If you encounter any issues, please [open an issue](https://github.com/neverinfamous/R2-Manager-Worker/issues) on GitHub with:

- Version number (3.4.0)
- Browser and OS
- Steps to reproduce
- Expected vs actual behavior

---

## 🎬 Breaking Changes

### Node.js Version Requirement

This release requires **Node.js 24+** (LTS). Users on Node.js 20 or earlier must upgrade before building or deploying. The Docker image is unaffected as it ships with Node 24-alpine.

---

**Made with ❤️ for the Cloudflare community**
