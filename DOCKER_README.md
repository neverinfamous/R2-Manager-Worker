# R2 Bucket Manager for Cloudflare

**Last Updated:** October 27, 2025 | **Version:** 1.2.0  
**Tech Stack:** React 19.2.0 | Vite 7.1.12 | TypeScript 5.9.3 | Cloudflare Workers + Zero Trust

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/R2--Manager--Worker-blue?logo=github)](https://github.com/neverinfamous/R2-Manager-Worker)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/r2-bucket-manager)](https://hub.docker.com/r/writenotenow/r2-bucket-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/version-v1.2.0-green)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/SECURITY.md)

 R2 Bucket Manager for Cloudflare — A full-featured, self-hosted web app to manage Cloudflare R2 buckets and objects. Supports drag-and-drop uploads, batch copy/move/delete, multi-file ZIP downloads, signed share links, folder hierarchies, advanced search + filters (extension, size, date), and GitHub SSO via Cloudflare Zero Trust.

**🎯 [Try the Live Demo](https://r2.adamic.tech/)** - See R2 Bucket Manager in action
 
**🚀 Docker Deployment:** Run the development server in a containerized environment for testing and local development.

**📰 [Read the v1.0 Release Article](https://adamic.tech/articles/2025-10-24-r2-bucket-manager-v1-0)** - Learn more about features, architecture, and deployment

---

## 🚀 Quick Start with Docker

### Prerequisites
- Docker installed and running
- Cloudflare account with R2 access
- Cloudflare Zero Trust (Access) configured

### Pull the Image

```bash
docker pull writenotenow/r2-bucket-manager:latest
```

### Run Development Server

**Basic usage (no configuration):**
```bash
docker run -p 8787:8787 writenotenow/r2-bucket-manager:latest
```

**With Cloudflare credentials:**
```bash
docker run -p 8787:8787 \
  -e ACCOUNT_ID=your_account_id \
  -e CF_EMAIL=your_email \
  -e API_KEY=your_api_key \
  writenotenow/r2-bucket-manager:latest
```

**With wrangler.toml configuration:**
```bash
docker run -p 8787:8787 \
  -v "$(pwd)/wrangler.toml:/app/wrangler.toml" \
  writenotenow/r2-bucket-manager:latest
```

The development server will be available at `http://localhost:8787`

---

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ACCOUNT_ID` | Yes | Your Cloudflare account ID |
| `CF_EMAIL` | Yes | Your Cloudflare email |
| `API_KEY` | Yes | Your Cloudflare API key |
| `TEAM_DOMAIN` | Yes (prod) | Your Cloudflare Zero Trust team domain |
| `POLICY_AUD` | Yes (prod) | Cloudflare Access policy audience tag |

### Volume Mounts

**Mount wrangler.toml from current directory:**
```bash
docker run -p 8787:8787 -v "$(pwd)/wrangler.toml:/app/wrangler.toml" writenotenow/r2-bucket-manager:latest
```

**Mount wrangler.toml from specific path:**
```bash
docker run -p 8787:8787 -v "/path/to/wrangler.toml:/app/wrangler.toml" writenotenow/r2-bucket-manager:latest
```

---

## 📦 Available Tags

| Tag | Description | Use Case |
|-----|-------------|----------|
| `latest` | Latest stable release | **Recommended for testing** |
| `v1.2.0` | Specific version | Pin to exact version |
| `sha-abc1234` | Commit SHA (12-char short) | Development/traceability |

**Pull a specific version:**

```bash
docker pull writenotenow/r2-bucket-manager:v1.2.0
```

---

## ✨ Features

- 🔎 **Cross-Bucket Search** - Search for files across all buckets with advanced filtering (NEW in v1.2.0)
- 🪣 **Bucket Management** - Create, rename, and delete R2 buckets (with bulk delete support)
- 📁 **Folder Management** - Create, rename, copy, move, and delete folders
- 📄 **File Management** - Rename files via context menu
- 🔍 **Smart Filtering** - Real-time filtering by filename/folder name
- 🎯 **Advanced Filtering** - Filter by extension, size, and date
- 📤 **Smart Uploads** - Chunked uploads with retry (up to 500MB)*
- 📥 **Bulk Downloads** - Download multiple files as ZIP
- 🔗 **Shareable Links** - Generate signed URLs
- 🔄 **Advanced Operations** - Move/copy between buckets
- 🗑️ **Bulk Bucket Delete** - Select and force delete multiple buckets at once with progress tracking
- 🧭 **Breadcrumb Navigation** - Easy folder traversal
- 🔐 **Enterprise Auth** - GitHub SSO via Cloudflare Access
- 🌓 **Light/Dark Mode** - System, light, or dark themes

**\*Upload Size Limits:** Plan-based (Free: 100MB, Pro: 100MB, Business: 200MB, Enterprise: 500MB)

### Supported File Types

**Accepted file types and size limits:**

- **Archives** (7Z, GZ, RAR, TAR, ZIP) - up to 500MB
- **Audio** (AAC, FLAC, M4A, MP3, OGG, OPUS, WAV) - up to 100MB
- **Code** (CSS, GO, HTML, Java, JS, Rust, TS, Python, etc.) - up to 10MB
- **Config & Metadata** (CONF, ENV, INI, JSON, JSONC, LOCK, TOML, etc.) - up to 10MB
- **Data Formats** (AVRO, FEATHER, NDJSON) - up to 50MB
- **Databases** (DB, PARQUET, SQL) - up to 50MB
- **Dev Environment** (Dockerfile, editorconfig, .gitignore, nvmrc, etc.) - up to 1MB
- **Documents** (CSV, Excel, Markdown, PDF, PowerPoint, TXT, Word, etc.) - up to 50MB
- **Documentation** (NFO) - up to 10MB
- **Fonts** (EOT, OTF, TTF, WOFF, WOFF2) - up to 10MB
- **Images** (AVIF, BMP, GIF, HEIC, JPG, PNG, PSD, SVG, WebP) - up to 15MB
- **Jupyter Notebooks** (.ipynb) - up to 10MB
- **Videos** (3GP, AVI, FLV, M4V, MKV, MOV, MP4, MPEG, OGG, WebM, WMV) - up to 500MB

---

## 🐳 Docker Image Details

### Image Specifications

- **Base Image:** Node.js 22 Alpine
- **Platforms:** AMD64, ARM64 (multi-arch)
- **Size:** ~372MB compressed
- **User:** Non-root (`app:1001`)
- **Working Directory:** `/app`

### Security Features

- ✅ **Non-root execution** - Runs as user `app`
- ✅ **Multi-stage build** - Minimal attack surface
- ✅ **Alpine base** - Latest security patches
- ✅ **Supply chain attestation** - SBOM and provenance included
- ✅ **Health checks** - Built-in container health monitoring

---

## 🔍 Filtering & Search

### Basic Filtering
- Search by filename/folder name
- Filter types: All / Files Only / Folders Only
- Real-time results counter
- Clear button to reset filters

### Advanced Filtering
- **Extension Filter:** Images, Documents, Videos, Code, Archives, or custom
- **Size Filter:** Preset ranges or custom min/max in MB
- **Date Filter:** Today, Last 7/30/90 days, This Year, or custom range
- **Active Filter Badges:** See all active filters with one-click removal
- **Filter Statistics:** Total size and date range of results

---

## 🙈 Hiding Buckets from the UI

You can configure R2 Bucket Manager to hide specific buckets from the UI (e.g., system buckets, internal buckets, or buckets managed by other applications).

### How to Hide Buckets

1. **Edit `worker/index.ts`:**
   - Locate the `systemBuckets` array (around line 373)
   - Add your bucket name(s) to the array

```typescript
const systemBuckets = ['r2-bucket', 'sqlite-mcp-server-wiki', 'your-bucket-name'];
```

2. **Deploy the changes:**
   ```bash
   npx wrangler deploy
   ```

### Example

To hide buckets named `blog-wiki` and `internal-data`:

```typescript
const systemBuckets = ['r2-bucket', 'sqlite-mcp-server-wiki', 'blog-wiki', 'internal-data'];
```

**Note:** Hidden buckets are completely filtered from the API response and won't appear in the bucket list or be accessible through the UI. This configuration must be done in the source code before deploying.

**📖 See the [Configuration Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Configuration-Reference#hiding-buckets) for more details.**

---

## 🏗️ Local Development with Docker

### Mock Operations in Development Mode

When running without Cloudflare credentials, the development server returns simulated responses for UI testing:

- ✅ **List buckets** - Returns `dev-bucket`
- ✅ **Create bucket** - Simulates success
- ✅ **Rename bucket** - Simulates success
- ✅ **List files** - Returns empty array
- ✅ **Upload files** - Simulates success (files not stored)
- ✅ **Create folders** - Simulates success

**Note:** Mock data enables UI/UX testing without Cloudflare API access. Files and folders are not actually stored. For full functionality with real storage, provide Cloudflare credentials or deploy to production.

### Option 1: Use Pre-built Image

**Step 1: Pull the image**
```bash
docker pull writenotenow/r2-bucket-manager:latest
```

**Step 2: Run the container**
```bash
docker run -p 8787:8787 writenotenow/r2-bucket-manager:latest
```

### Option 2: Build from Source

**Step 1: Clone the repository**
```bash
git clone https://github.com/neverinfamous/R2-Manager-Worker.git
```

**Step 2: Navigate to directory**
```bash
cd R2-Manager-Worker
```

**Step 3: Build the image**
```bash
docker build -t r2-manager-local .
```

**Step 4: Run the container**
```bash
docker run -p 8787:8787 r2-manager-local
```

---

## 🛡️ Security

- ✅ **Zero Trust Architecture** - Cloudflare Access authentication
- ✅ **JWT Validation** - Token verification on every API call
- ✅ **HTTPS Only** - Encrypted via Cloudflare edge
- ✅ **Signed URLs** - HMAC-SHA256 for downloads
- ✅ **No Stored Credentials** - Zero password storage

---

## 📚 Production Deployment

**Note:** This Docker image is designed for **development and testing**. For production deployment:

1. Build the application: `npm run build`
2. Deploy to Cloudflare Workers: `wrangler deploy`
3. Configure Cloudflare Access (Zero Trust)
4. Set up custom domain (optional)

See the [Installation & Setup Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Installation-&-Setup) for complete production deployment instructions.

---

## 📖 Documentation

**Complete documentation:** [GitHub Wiki](https://github.com/neverinfamous/R2-Manager-Worker/wiki)

**Key Topics:**
- [Installation & Setup](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Installation-&-Setup) - Production deployment
- [API Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/API-Reference) - Complete endpoints
- [Configuration Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Configuration-Reference) - Environment settings
- [Development Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Development-Guide) - Contributing
- [Troubleshooting](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Troubleshooting) - Common issues

---

## 🔗 Links & Resources

- **GitHub:** https://github.com/neverinfamous/R2-Manager-Worker
- **Wiki:** https://github.com/neverinfamous/R2-Manager-Worker/wiki
- **Issues:** https://github.com/neverinfamous/R2-Manager-Worker/issues
- **Discussions:** https://github.com/neverinfamous/R2-Manager-Worker/discussions
- **Support:** https://adamic.tech/

**Cloudflare Documentation:**
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)

---

## 🆕 Recent Updates

### v1.2.0 (October 27, 2025) 🎉
- ✅ **Cross-Bucket Search** - Search for files across all buckets with advanced filters
- ✅ **Sortable Results Table** - Click headers to sort by filename, bucket, size, or date
- ✅ **Full File Operations** - Download, move, copy, delete from search results
- ✅ **Bulk Bucket Deletion** - Select and delete multiple buckets at once
- ✅ **Progress Tracking** - Visual progress bar during bulk operations
- ✅ **Bug Fixes** - Fixed file transfer path logic and rename operations
- ✅ **Code Refactoring** - Improved maintainability with custom hooks

### v1.0 (October 24, 2025)
- ✅ **Initial Release** - Production-ready R2 bucket manager
- ✅ **Docker Support** - Containerized development environment
- ✅ **Advanced Filtering** - Extension, size, and date filters
- ✅ **Smart Uploads** - Chunked uploads with retry logic
- ✅ **Bulk Operations** - Download multiple files as ZIP
- ✅ **Theme Support** - Light, dark, and system modes
- ✅ **Enterprise Auth** - Cloudflare Access integration

---

## 📄 License

MIT License - See [LICENSE](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/LICENSE)

---

**Made with ❤️ for the Cloudflare community**

