# R2 Bucket Manager - Docker

**Last Updated March 7, 2026**

A modern web application for managing Cloudflare R2 buckets with enterprise-grade authentication via Cloudflare Access Zero Trust.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/version-v3.4.3-green)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/SECURITY.md)
[![CodeQL](https://img.shields.io/badge/CodeQL-Passing-brightgreen.svg)](https://github.com/neverinfamous/R2-Manager-Worker/security/code-scanning)
[![Type Safety](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/R2-Manager-Worker)

R2 Bucket Manager for Cloudflare — A full-featured, self-hosted web app to manage Cloudflare R2 buckets and objects. Supports job history tracking, AI-powered search, drag-and-drop uploads with verification, batch copy/move/delete, multi-file ZIP downloads, signed share links, folder hierarchies, advanced cross-bucket search + filters (extension, size, date), S3 import, tags and GitHub SSO via Cloudflare Zero Trust.

**[Live Demo](https://r2.adamic.tech/)** • **[GitHub](https://github.com/neverinfamous/R2-Manager-Worker)** • **[Wiki](https://github.com/neverinfamous/R2-Manager-Worker/wiki)** • **[Changelog](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/CHANGELOG.md)** • **[Release Article](https://adamic.tech/articles/r2-manager)**

**Tech Stack:** React | Vite | TypeScript | Cloudflare Workers + Zero Trust

---

## ✨ Features

- 🎯 **Custom Metadata** - User-defined, searchable bucket tags
- 🚀 **S3 Import** `BETA` - Migrate data from Amazon, Google, and All S3 Compatible buckets to R2 using Cloudflare's Super Slurper API.
- 📊 **Metrics Dashboard** - Comprehensive R2 analytics with tabbed interface (Overview | Storage), bucket-level filtering, storage trends, object count tracking, and Class A/B operation breakdowns powered by Cloudflare's GraphQL Analytics API
- 🏥 **Health Dashboard** - At-a-glance operational status with health score, job monitoring, and bucket organization metrics
- 🪝 **WebHooks** - 15 event types for bucket operations (file uploads, moves, copies, renames, folder lifecycle, bucket operations, job status)
- 📋 **Job History & Audit Logging** - Complete audit trail for all operations (bulk and individual) with filterable job list and event timeline
- 🤖 **AI Search Integration** - Connect R2 buckets to Cloudflare AI Search for semantic search, natural language queries, and RAG capabilities. Supports PDF, DOCX, and 20+ file formats with automatic indexing and real-time status monitoring.
- 🔎 **Cross-Bucket Search** - Search for files across all buckets with advanced filtering
- 🪣 **Bucket Management** - Create, rename, and delete R2 buckets (with bulk delete support)
- 📦 **Multi-Bucket Download** - Select and download multiple buckets as a single ZIP archive with "Select All" button
- 🧭 **Bucket Filtering** - Filter buckets by name, size, and creation date with preset and custom ranges
- ⏳ **Object Lifecycle Management** - Configure automated expiration and storage class transitions for cost optimization (33% savings with Infrequent Access)
- ⚡ **Local Uploads** `BETA` - Enable per-bucket local uploads for up to 75% faster upload performance by writing data to storage near the client
- 📁 **Folder Management** - Create, rename, copy, move, and delete folders with hierarchical navigation
- 📄 **File Management** - Rename files via right-click context menu with validation
- 🔍 **Smart Filtering** - Real-time client-side filtering by filename/folder name with type filters (All/Files/Folders)
- 🎯 **Advanced Filtering** - Filter files by extension, size ranges, and upload dates with preset and custom options
- 📤 **Smart Uploads** - Chunked uploads with automatic retry and integrity verification (10MB chunks, up to 500MB files)\*
- ✓ **Upload Verification** - MD5 checksum verification ensures uploaded files match stored files exactly
- 📥 **Bulk Downloads** - Download multiple files as ZIP archives
- 🔗 **Shareable Links** - Generate signed URLs to share files securely
- 🔄 **Advanced File Operations** - Move and copy files/folders between buckets and to specific folders within buckets
- 🗑️ **Bulk Bucket Delete** - Select and force delete multiple buckets at once with progress tracking
- 🧭 **Breadcrumb Navigation** - Navigate through folder hierarchies with ease
- 🔐 **Enterprise Auth** - GitHub SSO via Cloudflare Access Zero Trust
- 🛡️ **Rate Limiting** - Tiered API rate limits (600/min reads, 200/min writes, 60/min deletes) with automatic enforcement
- ⚡ **Edge Performance** - Deployed on Cloudflare's global network with intelligent client-side caching (5-min TTL)
- 🔄 **Smart Retry Logic** - Automatic exponential backoff for rate limits and transient errors (429/503/504)
- 🎨 **Modern UI** - Beautiful, responsive interface built with React 19
- 🌓 **Light/Dark Mode** - Auto-detects system preference with manual toggle (System → Light → Dark)

**\*Upload Size Limits:** Plan-based (Free: 100MB, Pro: 100MB, Business: 200MB, Enterprise: 500MB)

### Supported File Types

**Accepted file types and size limits:**

- **Archives** (7Z, GZ, RAR, TAR, ZIP) - up to 500MB
- **Audio** (AAC, FLAC, M4A, MP3, OGG, OPUS, WAV) - up to 100MB
- **Code** (CSS, GO, HTML, HTM, Java, JS, JSX, Rust, SH, TS, TSX, Python, etc.) - up to 10MB
- **Config & Metadata** (CONF, ENV, INI, JSON, JSONC, LOCK, PROPERTIES, TOML, XML, YAML, YML, etc.) - up to 10MB
- **Data Formats** (AVRO, FEATHER, NDJSON) - up to 50MB
- **Databases** (DB, PARQUET, SQL) - up to 50MB
- **Dev Environment** (Dockerfile, editorconfig, .gitignore, nvmrc, etc.) - up to 1MB
- **Documents** (CSV, Excel, LaTeX, Markdown, MDX, ODT, PDF, PowerPoint, RST, SGML, TXT, Word, etc.) - up to 50MB
- **Documentation** (NFO) - up to 10MB
- **Fonts** (EOT, OTF, TTF, WOFF, WOFF2) - up to 10MB
- **Images** (AVIF, BMP, GIF, HEIC, JPG, PNG, PSD, SVG, WebP) - up to 15MB
- **Jupyter Notebooks** (.ipynb) - up to 10MB
- **Scripts** (BAT, PS1, SH) - up to 10MB
- **Videos** (3GP, AVI, FLV, M4V, MKV, MOV, MP4, MPEG, OGG, WebM, WMV) - up to 500MB

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

| Variable      | Required   | Description                            |
| ------------- | ---------- | -------------------------------------- |
| `ACCOUNT_ID`  | Yes        | Your Cloudflare account ID             |
| `CF_EMAIL`    | Yes        | Your Cloudflare email                  |
| `API_KEY`     | Yes        | Your Cloudflare API key                |
| `TEAM_DOMAIN` | Yes (prod) | Your Cloudflare Zero Trust team domain |
| `POLICY_AUD`  | Yes (prod) | Cloudflare Access policy audience tag  |

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

| Tag           | Description                | Use Case                    |
| ------------- | -------------------------- | --------------------------- |
| `latest`      | Latest stable release      | **Recommended for testing** |
| `v3.4.3`      | Specific version           | Pin to exact version        |
| `sha-abc1234` | Commit SHA (12-char short) | Development/traceability    |

**Pull a specific version:**

```bash
docker pull writenotenow/r2-bucket-manager:v3.4.3
```

---

## 🐳 Docker Image Details

### Image Specifications

- **Base Image:** Node.js 24-alpine (LTS)
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

## 🔄 Upgrading

### Database Schema Updates

If you're upgrading from a previous version and want to enable new features like individual action logging (file uploads, downloads, deletes, etc.), run the schema migration:

```bash
npx wrangler d1 execute r2-manager-metadata --remote --file=worker/schema.sql
```

> **Note:** This command is safe to run multiple times - it uses `CREATE TABLE IF NOT EXISTS` so existing tables are not affected. If you haven't run this migration, the application will continue to work normally but individual actions won't be logged in Job History.

### Version-Specific Upgrades

**Upgrading to v3.0.0 or later:**

- Job History requires a D1 database. See the [Installation Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Installation-&-Setup) for setup instructions.
- Rate limiting requires a Cloudflare Workers paid plan.
- AI Search requires the `[ai]` binding in your wrangler.toml.

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
const systemBuckets = [
  "r2-bucket",
  "sqlite-mcp-server-wiki",
  "your-bucket-name",
];
```

2. **Deploy the changes:**
   ```bash
   npx wrangler deploy
   ```

### Example

To hide buckets named `blog-wiki` and `internal-data`:

```typescript
const systemBuckets = [
  "r2-bucket",
  "sqlite-mcp-server-wiki",
  "blog-wiki",
  "internal-data",
];
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

**Note:** Mock data enables UI/UX testing without Cloudflare API access. Files and folders are not actually stored. Authentication and rate limiting are automatically disabled for localhost development. For full functionality with real storage, provide Cloudflare credentials or deploy to production.

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
- ✅ **Rate Limiting** - Tiered API rate limits (production only, requires paid plan)
- ✅ **HTTPS Only** - Encrypted via Cloudflare edge
- ✅ **Signed URLs** - HMAC-SHA256 for downloads
- ✅ **No Stored Credentials** - Zero password storage

**Note:** Rate limiting requires Cloudflare Workers paid plan and is not available in Docker development mode.

---

## 📚 Production Deployment

**Note:** This Docker image is designed for **development and testing**. For production deployment:

1. Build the application: `npm run build`
2. Deploy to Cloudflare Workers: `wrangler deploy`
3. Configure Cloudflare Access (Zero Trust)
4. Set up custom domain (optional)

See the [Installation & Setup Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Installation-&-Setup) for complete production deployment instructions.

---

## 🔗 Links & Resources

- **GitHub:** https://github.com/neverinfamous/R2-Manager-Worker
- **Wiki:** https://github.com/neverinfamous/R2-Manager-Worker/wiki
- **Issues:** https://github.com/neverinfamous/R2-Manager-Worker/issues
- **Support:** https://adamic.tech/

**Cloudflare Documentation:**

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)

---

## 📄 License

MIT License - See [LICENSE](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/LICENSE)

---

**Made with ❤️ for the Cloudflare community**
