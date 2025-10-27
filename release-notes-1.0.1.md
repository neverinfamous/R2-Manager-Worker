# 🔧 R2 Bucket Manager v1.0.1 - Patch Release

**Release Date:** October 27, 2025  
**Status:** ✅ Production Ready

This patch release fixes the local development environment which was previously non-functional. Developers can now run both frontend (Vite) and backend (Wrangler) servers locally with automatic authentication bypass and mock data support.

**No changes to production functionality.**

---

## 🐛 Fixed

### Local Development Environment
- ✅ Fixed broken local development setup
- ✅ Added `wrangler.dev.toml` configuration for development (skips frontend build)
- ✅ Fixed CORS configuration to allow `http://localhost:5173` origin with credentials
- ✅ Added automatic authentication bypass for localhost requests
- ✅ Added mock bucket data support for local testing without Cloudflare API credentials
- ✅ Fixed 500 errors when ASSETS binding is missing in development mode
- ✅ Configured `.env` file for proper localhost API endpoint

---

## 🔄 Changed

- Updated `worker/index.ts` to detect localhost and handle development mode
- Updated README.md with correct local development instructions
- Updated Development Guide wiki with accurate setup steps
- Updated `wrangler.toml.example` to clarify production vs development usage

---

## 📚 Documentation Updates

- Added comprehensive local development section to README
- Updated Development Guide wiki with troubleshooting steps
- Clarified that local dev returns mock data and doesn't require secrets

---

## 🐳 Docker Updates

Version 1.0.1 Docker images have already been published to Docker Hub:
- **Latest Tag:** `writenotenow/r2-bucket-manager:latest`
- **Specific Version:** `writenotenow/r2-bucket-manager:1.0.1`

Use `docker pull writenotenow/r2-bucket-manager:latest` to get the updated image.

---

## 🧪 Local Development Testing

To test the fixed local development setup:

```bash
# Terminal 1: Frontend dev server
npm run dev
# Runs on http://localhost:5173

# Terminal 2: Worker dev server (in another terminal)
npx wrangler dev --config wrangler.dev.toml --local
# Runs on http://localhost:8787
```

Open `http://localhost:5173` in your browser - authentication is automatically disabled for localhost.

---

## 📦 Downloads

- **Source Code (zip):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v1.0.1.zip)
- **Source Code (tar.gz):** [Download](https://github.com/neverinfamous/R2-Manager-Worker/archive/refs/tags/v1.0.1.tar.gz)
- **Docker Image:** `docker pull writenotenow/r2-bucket-manager:1.0.1`

---

## 📖 Documentation

- [Installation & Setup Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Installation-&-Setup)
- [Development Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Development-Guide)
- [Local Development Instructions](https://github.com/neverinfamous/R2-Manager-Worker#-local-development)
- [API Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/API-Reference)
- [Troubleshooting](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Troubleshooting)

---

## 🔗 Links

- **Live Demo:** https://r2.adamic.tech/
- **GitHub Repository:** https://github.com/neverinfamous/R2-Manager-Worker
- **Docker Hub:** https://hub.docker.com/r/writenotenow/r2-bucket-manager
- **GitHub Wiki:** https://github.com/neverinfamous/R2-Manager-Worker/wiki

---

**Made with ❤️ for the Cloudflare community**
