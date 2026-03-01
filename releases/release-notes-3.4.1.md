# 🎉 R2 Bucket Manager v3.4.1 - Patch Release

**Release Date:** March 1, 2026
**Status:** ✅ Production Ready

This patch release delivers **ESLint 10 migration**, **accessibility fixes**, **relaxed API rate limits**, **dependency updates**, and **security fixes** for the R2 Bucket Manager.

---

## 🐛 Fixed

### Local Uploads Accessibility

Fixed "No label associated with a form field" violation in the `LocalUploadsToggle` component.

- Changed `<label>` to `<span>` since the toggle button already carries a descriptive `aria-label`
- Resolves 5 accessibility violations (one per rendered bucket)

### ESLint 10 Code Quality Fixes

Resolved 9 new violations surfaced by ESLint 10:

- Fixed 5 `no-useless-assignment` violations in `JobHistoryDialog.tsx`, `api.ts`, `worker/index.ts`, and `worker/routes/files.ts`
- Fixed 4 `preserve-caught-error` violations in `api.ts` by attaching `{ cause: error }` to re-thrown errors
- Suppressed 6 `no-deprecated` violations for `autorag` → `aiSearch` API migration (tracked as TODO)

---

## 🔄 Changed

### Relaxed API Rate Limits

Doubled all rate limit tiers to reduce 429 errors during normal usage:

| Tier       | Previous | New     |
| ---------- | -------- | ------- |
| **READ**   | 300/min  | 600/min |
| **WRITE**  | 100/min  | 200/min |
| **DELETE** | 30/min   | 60/min  |

### ESLint 10 Migration

Upgraded linting toolchain to ESLint 10 with strict checking:

- `eslint`: 9.39.2 → 10.0.1
- `@eslint/js`: 9.39.2 → 10.0.1
- `tsconfig.app.json` target and lib: ES2020 → ES2022 (enables `Error` `cause` option)
- Removed `brace-expansion` override (incompatible with ESLint 10's `minimatch` 10.x)
- Added `eslint-plugin-react-hooks` peer dependency override for ESLint 10
- Added `@typescript-eslint/typescript-estree` → `minimatch` override (`^10.2.1`)

### Dependency Updates

| Package                       | Previous     | New          | Note                          |
| ----------------------------- | ------------ | ------------ | ----------------------------- |
| `@cloudflare/workers-types`   | 4.20260212.0 | 4.20260305.0 |                               |
| `@types/node`                 | 25.2.3       | 25.3.3       |                               |
| `eslint`                      | 10.0.1       | 10.0.2       |                               |
| `eslint-plugin-react-refresh` | 0.5.0        | 0.5.2        |                               |
| `globals`                     | 17.3.0       | 17.4.0       |                               |
| `lucide-react`                | 0.563.0      | 0.575.0      |                               |
| `typescript-eslint`           | 8.55.0       | 8.56.1       |                               |
| `wrangler`                    | 4.65.0       | 4.69.0       |                               |
| `react-dropzone`              | 14.4.1       | 15.0.0       | Major; no breaking impact [1] |

[1] The only breaking change in react-dropzone 15.0.0 is `isDragReject` behavior, which this project does not use.

---

## 🛡️ Security

### tar CVE Fix

- Updated tar override from 7.5.7 → 7.5.8 to address **CVE-2026-26960**

### minimatch ReDoS

- Updated override from `^10.2.1` → `^10.2.4` and promoted to top-level override
- Fixes **GHSA-7r86-cg39-jmmj** and **GHSA-23c5-xmqv-rm74**

### CodeQL Workflow

- Removed deprecated `fail-on: error` and `wait-for-processing` inputs from `codeql.yml`

### Docker minimatch CVE

- Patched npm CLI's bundled minimatch 10.2.2 → 10.2.4 in Dockerfile
- Fixes **CVE-2026-27904** (HIGH 7.5) and **CVE-2026-27903** (HIGH 7.5) — Inefficient Regular Expression / Algorithmic Complexity

---

## 📦 CI/CD

### Removed Dependabot Auto-Merge Workflow

- Deleted `dependabot-auto-merge.yml` to prevent automatic merging of dependency PRs
- Dependabot will still open PRs for visibility into available updates
- Dependencies are now updated manually in batched local sessions to avoid unnecessary Docker deployments

---

## 🛠️ Technical Details

### Code Quality Metrics

- ✅ **TypeScript:** Clean compilation with strict mode
- ✅ **ESLint 10:** 0 errors
- ✅ **Prettier:** Fully formatted
- ✅ **npm audit:** 0 vulnerabilities

---

## 📦 Downloads

- **Source Code (zip):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v3.4.1.zip)
- **Source Code (tar.gz):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v3.4.1.tar.gz)
- **Docker Image:** `docker pull writenotenow/r2-bucket-manager:v3.4.1`

---

## 🚀 Upgrade Instructions

### From v3.4.0 to v3.4.1

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
- **CHANGELOG:** [View Full Changelog](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/CHANGELOG.md)

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

- Version number (3.4.1)
- Browser and OS
- Steps to reproduce
- Expected vs actual behavior

---

**Made with ❤️ for the Cloudflare community**
