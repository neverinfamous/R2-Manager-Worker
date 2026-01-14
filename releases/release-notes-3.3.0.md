# 🎉 R2 Bucket Manager v3.3.0 - Minor Release

**Release Date:** January 14, 2026  
**Status:** ✅ Production Ready

This minor release introduces **Object Lifecycle Management**, enabling automated object expiration and transition to Infrequent Access storage. It also includes dependency updates and CI/CD improvements.

---

## ✨ What's New

### 🔄 Object Lifecycle Management

Automate your R2 storage lifecycle with powerful rule-based management.

- **Expiration Rules** - Automatically delete objects after a specified number of days
- **Transition Rules** - Move objects to Infrequent Access storage for 33% cost savings
- **Prefix Filtering** - Target specific objects by path prefix (e.g., `logs/`, `temp/`)
- **Enable/Disable Toggle** - Temporarily disable rules without deleting them
- **Lifecycle Panel** - New bucket-level panel accessible from list and grid views

#### New API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/lifecycle/:bucketName` | GET | Retrieve lifecycle rules for a bucket |
| `/api/lifecycle/:bucketName` | PUT | Set lifecycle rules (replaces all rules) |

#### New Components

- `LifecycleRulesPanel.tsx` - View, toggle, and delete lifecycle rules
- `CreateLifecycleRuleModal.tsx` - Create expiration or transition rules
- `lifecycle.css` - Styling matching the app design system

#### New Types

- `LifecycleRule`, `LifecycleTransitionCondition`, `ObjectTransition`
- `StorageClassTransition`, `LifecycleRuleConditions`, `LifecycleConfiguration`

---

## 🔄 Changed

### CI/CD Improvements

Modernized GitHub Actions workflows to match the d1/do/kv-manager fleet pattern.

- **`docker-publish.yml`** - Migrated from single-job to 5-job architecture
  - lint → codeql → build-platform → security-scan → merge-and-push
- **Native ARM builds** via `ubuntu-24.04-arm` runner (replaces slow QEMU emulation)
- **Lint and CodeQL gates** block Docker builds on failure
- **Docker Scout** security scanning with SARIF upload to GitHub Security
- **`codeql.yml`** - Added `fail-on: error` to block builds on security vulnerabilities
- **Consolidated workflows** - Removed standalone `deploy.yml`

### Dependency Updates

| Package | Previous | New |
|---------|----------|-----|
| `@cloudflare/workers-types` | 4.20260109.0 | 4.20260114.0 |
| `@types/node` | 25.0.3 | 25.0.8 |
| `@types/react` | 19.2.7 | 19.2.8 |
| `@babel/core` | 7.28.5 | 7.28.6 |
| `baseline-browser-mapping` | 2.9.11 | 2.9.14 |
| `caniuse-lite` | 1.0.30001762 | 1.0.30001764 |
| `rollup` | 4.54.0 | 4.55.1 |
| `typescript-eslint` | 8.51.0 | 8.53.0 |
| `vite` | 7.3.0 | 7.3.1 |
| `wrangler` | 4.56.0 | 4.59.1 |

---

## 🐛 Fixed

### CodeQL Alerts

Resolved 4 code scanning issues:

- Removed redundant null check on narrowed variable in `files.ts`
- Removed unused variable `url` in `src/worker.js`
- Removed useless `hasMore = false` assignments before `break` in `folders.ts`
- Removed always-true conditional `userEmail ?? undefined` in `index.ts`

---

## 📖 Documentation

- **Added** [Object Lifecycles](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Object-Lifecycles) wiki page
- **Updated** Sidebar and Home with Object Lifecycle Management feature link

---

## 🛠️ Technical Details

### Cloudflare API Integration

The lifecycle feature integrates with the Cloudflare R2 REST API:

- **Read-Modify-Write Pattern** - Fetches existing rules before adding new ones
- **API Format** - Uses `maxAge` in seconds with required `conditions` field
- **Types** - `deleteObjectsTransition`, `storageClassTransitions`, `abortMultipartUploadsTransition`

### Code Quality Metrics

- ✅ **TypeScript:** Clean compilation with strict mode
- ✅ **ESLint:** 0 errors
- ✅ **Browser Testing:** Verified in Chrome/Edge

---

## 📦 Downloads

- **Source Code (zip):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v3.3.0.zip)
- **Source Code (tar.gz):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v3.3.0.tar.gz)
- **Docker Image:** `docker pull writenotenow/r2-bucket-manager:v3.3.0`

---

## 🚀 Upgrade Instructions

### From v3.2.0 to v3.3.0

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
- **CHANGELOG:** [View Full Changelog](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Changelog)

---

## 🔜 What's Next?

Looking ahead to v3.4.0 and beyond:

### Planned Features
- **File Versioning** - Track and restore previous file versions
- **Advanced Webhooks** - Custom headers, retry logic, and delivery logs
- **Offline Upload Queue** - Resumable uploads with service workers

See the full [Roadmap](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Roadmap) for details.

---

## 🐛 Known Issues

None reported at this time.

If you encounter any issues, please [open an issue](https://github.com/neverinfamous/R2-Manager-Worker/issues) on GitHub with:
- Version number (3.3.0)
- Browser and OS
- Steps to reproduce
- Expected vs actual behavior

---

## 🎬 Breaking Changes

No breaking changes in this release. All v3.2.0 functionality remains intact.

---

## 🛡️ Security

No security changes in this release. All security features from v3.2.0 remain active.

---

**Made with ❤️ for the Cloudflare community**
