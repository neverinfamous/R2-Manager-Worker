# R2 Bucket Manager for Cloudflare

**Last Updated:** November 27, 2025 | **Version:** 1.3.0
 
**Tech Stack:** React 19.2.0 | Vite 7.2.4 | TypeScript 5.9.3 | Cloudflare Workers + Zero Trust

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/R2--Manager--Worker-blue?logo=github)](https://github.com/neverinfamous/R2-Manager-Worker)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/r2-bucket-manager)](https://hub.docker.com/r/writenotenow/r2-bucket-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/version-v1.3.0-green)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/SECURITY.md)
[![CodeQL](https://img.shields.io/badge/CodeQL-Passing-brightgreen.svg)](https://github.com/neverinfamous/R2-Manager-Worker/security/code-scanning)
[![Type Safety](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/R2-Manager-Worker)

A modern web application for managing Cloudflare R2 buckets with enterprise-grade authentication via Cloudflare Access (Zero Trust). Deploy to your own Cloudflare account in minutes.

**[Live Demo](https://r2.adamic.tech/)** • **[Wiki](https://github.com/neverinfamous/R2-Manager-Worker/wiki)** • **[Docker Hub](https://hub.docker.com/r/writenotenow/r2-bucket-manager)** • **[Changelog](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Changelog)** • **[Release Article](https://adamic.tech/articles/2025-10-30-r2-bucket-manager-v1-3-0)**

---

## 🎯 Why It Exists

Cloudflare's dashboard lacks the full-featured R2 file management capabilities. This tool provides a self-hosted alternative for developers and enterprises wanting:

- Complete control over R2 buckets with advanced file operations
- Seamless SSO integration via GitHub (or other identity providers)
- Modern, responsive interface for managing files at scale
- Edge-deployed performance on Cloudflare's global network

---

## ✨ Features

- 🔎 **Cross-Bucket Search** - Search for files across all buckets with advanced filtering
- 🪣 **Bucket Management** - Create, rename, and delete R2 buckets (with bulk delete support)
- 📦 **Multi-Bucket Download** - Select and download multiple buckets as a single ZIP archive with "Select All" button
- 📁 **Folder Management** - Create, rename, copy, move, and delete folders with hierarchical navigation
- 📄 **File Management** - Rename files via right-click context menu with validation
- 🔍 **Smart Filtering** - Real-time client-side filtering by filename/folder name with type filters (All/Files/Folders)
- 🎯 **Advanced Filtering** - Filter files by extension, size ranges, and upload dates with preset and custom options
- 📤 **Smart Uploads** - Chunked uploads with automatic retry and integrity verification (10MB chunks, up to 500MB files)*
- ✓ **Upload Verification** - MD5 checksum verification ensures uploaded files match stored files exactly
- 📥 **Bulk Downloads** - Download multiple files as ZIP archives
- 🔗 **Shareable Links** - Generate signed URLs to share files securely
- 🔄 **Advanced File Operations** - Move and copy files/folders between buckets and to specific folders within buckets
- 🗑️ **Bulk Bucket Delete** - Select and force delete multiple buckets at once with progress tracking
- 🧭 **Breadcrumb Navigation** - Navigate through folder hierarchies with ease
- 🔐 **Enterprise Auth** - GitHub SSO via Cloudflare Access Zero Trust
- 🛡️ **Rate Limiting** - Tiered API rate limits (100/min reads, 30/min writes, 10/min deletes) with automatic enforcement
- ⚡ **Edge Performance** - Deployed on Cloudflare's global network
- 🎨 **Modern UI** - Beautiful, responsive interface built with React 19
- 🌓 **Light/Dark Mode** - Auto-detects system preference with manual toggle (System → Light → Dark)

**\*Upload Size Limits:** This application supports uploads up to 500MB per file. However, **Cloudflare enforces plan-based limits**:
- **Free/Pro Plans:** 100MB maximum per file
- **Business Plan:** 200MB maximum per file  
- **Enterprise Plan:** 500MB maximum per file

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

## 🚀 Quick Start

### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (Free tier works!)
- [Node.js](https://nodejs.org/) 18+ and npm
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (4.36.0+ for rate limiting)
- Domain managed by Cloudflare (optional - can use Workers.dev subdomain)

**Note:** Rate limiting requires a Cloudflare Workers paid plan. All other features work on the free tier.

### Installation

1. **Clone and install:**
   ```bash
   git clone https://github.com/neverinfamous/R2-Manager-Worker.git
   cd R2-Manager-Worker
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   cp wrangler.toml.example wrangler.toml
   ```
   
   Edit both files with your settings.
   
   **Optional - Enable Rate Limiting:**
   - Rate limiting is pre-configured in `wrangler.toml.example`
   - Requires Wrangler 4.36.0+ and Workers paid plan
   - If you don't have a paid plan, the app works fine without it

3. **Create R2 bucket:**
   ```bash
   npx wrangler login
   npx wrangler r2 bucket create your-bucket-name
   ```

4. **Configure Cloudflare Access:**
   - Set up GitHub OAuth in [Zero Trust](https://one.dash.cloudflare.com/)
   - Create an Access application for your domain
   - Copy the Application Audience (AUD) Tag

5. **Set Worker secrets:**
   ```bash
   npx wrangler secret put ACCOUNT_ID
   npx wrangler secret put CF_EMAIL
   npx wrangler secret put API_KEY
   npx wrangler secret put TEAM_DOMAIN
   npx wrangler secret put POLICY_AUD
   ```

6. **Deploy:**
   ```bash
   npm run build
   npx wrangler deploy
   ```

**📖 For detailed instructions, see the [Installation & Setup Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Installation-&-Setup).**

---

## 🐳 Docker Development Environment

For local development and testing, use the Docker image:

```bash
docker pull writenotenow/r2-bucket-manager:latest
```

```bash
docker run -p 8787:8787 writenotenow/r2-bucket-manager:latest
```

Access the development server at `http://localhost:8787`

**Note:** Docker deployment is for development/testing only. For production, deploy to Cloudflare Workers using the instructions above.

**📖 See the [Docker Hub page](https://hub.docker.com/r/writenotenow/r2-bucket-manager) for complete Docker documentation.**

---

## 📦 Bulk Operations

### Multi-Bucket Download
Download multiple buckets simultaneously as a single, timestamped ZIP archive.
* **Zero Dependencies:** Generates archives on the fly without size limits.
* **Smart Structure:** Maintains full folder hierarchy (`/bucket-name/folder/file.ext`).
* **Bulk Actions:** dedicated toolbar for "Select All" and batch processing.

### Bulk Bucket Deletion
Select and force-delete multiple buckets in one operation.
* **Safety First:** Enhanced confirmation modal calculates total files and size before deletion.
* **Force Delete:** Automatically recursively empties buckets before removing them.
* **Progress Tracking:** Visual feedback for long-running deletion tasks.

---

## 🔎 Search & Filtering

### Cross-Bucket Search
Real-time, server-side parallel search across **all** your buckets instantly.
* **Performance:** Queries thousands of files in seconds with minimal overhead.
* **Direct Actions:** Move, copy, download, or delete files directly from search results.
* **Deep Linking:** Click bucket badges to navigate directly to the source.

### Advanced Filtering
Comprehensive client-side filtering for large buckets.
* **Smart Filters:** Filter by **File Type** (Images, Code, Docs), **Size** (Presets or custom ranges), and **Date** (Upload time).
* **Context Aware:** Toggle between "Files Only," "Folders Only," or "All."
* **Persistent:** Active filters remain applied during batch operations and navigation.

---

## 🛡️ Rate Limiting

Intelligent, per-user rate limiting prevents abuse while ensuring fair resource access. Limits are applied based on the authenticated user's email.

| Tier | Operations | Limit | Period | Scope |
| :--- | :--- | :--- | :--- | :--- |
| **READ** | List, Search, Signed URLs | 100 req | 60s | High-volume access |
| **WRITE** | Upload, Rename, Move | 30 req | 60s | Modification safety |
| **DELETE** | Remove Files/Buckets | 10 req | 60s | Destructive actions |

**Note:** Rate limiting returns standard `429 Too Many Requests` headers and can be configured or disabled via `wrangler.toml`.

### Response Headers

When rate limited, responses include:

- `Retry-After` - Seconds to wait before retrying
- `X-RateLimit-Limit` - Maximum requests allowed in the period
- `X-RateLimit-Period` - Time period in seconds
- `X-RateLimit-Tier` - Which tier was exceeded (READ/WRITE/DELETE)

### Configuration

Rate limits are defined in `wrangler.toml` using Cloudflare Workers Rate Limiting API bindings. To modify limits, edit the configuration and redeploy:

```toml
[[ratelimits]]
name = "RATE_LIMITER_READ"
namespace_id = "1001"
simple = { limit = 100, period = 60 }
```

**Requirements:**
- Wrangler CLI version 4.36.0 or later
- Cloudflare Workers paid plan (rate limiting not available on free plan)

**Note:** Rate limiting is optional. If not configured in `wrangler.toml`, the application will function normally without rate limiting protection.

---

## 🛠️ Local Development

### Quick Start (Two Terminal Windows Required)

**Terminal 1: Frontend dev server (Vite)**
```bash
npm run dev
```
- Runs on: `http://localhost:5173`
- Hot Module Replacement (HMR) enabled
- Watches for file changes automatically

**Terminal 2: Worker dev server (Wrangler)**
```bash
npx wrangler dev --config wrangler.dev.toml --local
```
- Runs on: `http://localhost:8787`
- Uses local bindings with mock data (no secrets required)
- Automatically reloads on code changes
- **Note:** Returns mock bucket data for testing UI without Cloudflare API access

### Access the Application

Open your browser to `http://localhost:5173` - the frontend will automatically communicate with the Worker API on port 8787.

**Note:** Authentication and rate limiting are disabled on localhost for easier development. No Cloudflare Access configuration needed for local dev.

### Development Configuration Files

- `.env` - Frontend environment variables (points to `http://localhost:8787`)
- `wrangler.dev.toml` - Development-specific Worker config (skips frontend build, adds mock data support)
- `wrangler.toml` - Production Worker config (includes build step)

### What's Different in Local Development

- **Authentication:** Automatically disabled for localhost requests
- **Rate Limiting:** Automatically bypassed for localhost requests
- **CORS:** Configured to allow `http://localhost:5173` with credentials
- **Mock Data:** Returns simulated responses (no real Cloudflare API calls)
- **No Secrets Required:** Works without `ACCOUNT_ID`, `CF_EMAIL`, or `API_KEY`

### Mock Operations in Local Development

The following operations return simulated success responses for UI testing:
- ✅ List buckets (returns `dev-bucket`)
- ✅ Create bucket
- ✅ Rename bucket
- ✅ List files (returns empty array)
- ✅ Upload files (simulates success, files not stored)
- ✅ Create folders

**Note:** Files and folders are not actually stored. Local development is for UI/UX testing only. For full functionality, deploy to Cloudflare Workers.

**📖 For more details, see the [Development Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Development-Guide).**

---

## 📋 Architecture

### Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Frontend | React | 19.2.0 |
| Build Tool | Vite | 7.2.2 |
| Language | TypeScript | 5.9.3 |
| Backend | Cloudflare Workers | Runtime API |
| Storage | Cloudflare R2 | S3-compatible |
| Auth | Cloudflare Access | Zero Trust |

### File Organization

```
├── src/                      # Frontend source code
│   ├── app.tsx              # Main UI component
│   ├── filegrid.tsx         # File browser with grid/list views
│   └── services/            # API client and auth utilities
├── worker/
│   ├── index.ts             # Worker runtime & API endpoints
│   ├── routes/              # API route handlers
│   └── utils/               # Helper utilities
├── wrangler.toml.example    # Wrangler configuration template
└── .env.example             # Environment variables template
```

**📖 For complete API documentation, see the [API Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/API-Reference).**

### API Endpoints

#### Bucket Operations
- `GET /api/buckets` - List all buckets
- `POST /api/buckets` - Create a new bucket
- `DELETE /api/buckets/:bucketName` - Delete a bucket (with optional `?force=true`)
- `PATCH /api/buckets/:bucketName` - Rename a bucket

#### File Operations
- `GET /api/files/:bucketName` - List files in a bucket (supports `?cursor`, `?limit`, `?prefix`, `?skipCache`)
- `POST /api/files/:bucketName/upload` - Upload a file (supports chunked uploads)
- `GET /api/files/:bucketName/signed-url/:fileName` - Generate a signed download URL
- `POST /api/files/:bucketName/download-zip` - Download multiple files as ZIP
- `DELETE /api/files/:bucketName/delete/:fileName` - Delete a file
- `POST /api/files/:bucketName/:fileName/copy` - Copy a file to another bucket or folder (supports `destinationPath`)
- `POST /api/files/:bucketName/:fileName/move` - Move a file to another bucket or folder (supports `destinationPath`)
- `PATCH /api/files/:bucketName/:fileName/rename` - Rename a file within the same bucket

#### Folder Operations
- `POST /api/folders/:bucketName/create` - Create a new folder
- `PATCH /api/folders/:bucketName/rename` - Rename a folder (batch operation)
- `POST /api/folders/:bucketName/:folderPath/copy` - Copy a folder to another bucket or folder (supports `destinationPath`)
- `POST /api/folders/:bucketName/:folderPath/move` - Move a folder to another bucket or folder (supports `destinationPath`)
- `DELETE /api/folders/:bucketName/:folderPath` - Delete a folder and its contents (with optional `?force=true`)

---

## 🔐 Security

- ✅ **Zero Trust Architecture** - All requests authenticated by Cloudflare Access
- ✅ **JWT Validation** - Tokens verified on every API call
- ✅ **Rate Limiting** - Tiered API rate limits prevent abuse and ensure fair usage
- ✅ **HTTPS Only** - All traffic encrypted via Cloudflare's edge network
- ✅ **Signed URLs** - Download operations use HMAC-SHA256 signatures
- ✅ **No Stored Credentials** - No user passwords stored anywhere

**📖 Learn more in the [Authentication & Security Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Authentication-&-Security).**

---

## 📋 Roadmap

### Unreleased Features (In Development)
- ✅ **Upload Integrity Verification** - MD5 checksum verification for all uploads (completed, pending release)
- ✅ **API Rate Limiting** - Tiered rate limits using Cloudflare Workers Rate Limiting API (completed, pending release)

### Planned Features
- **Audit Logging** - Track all user actions with detailed logs
- **AWS S3 Migration** - Add support for migrating AWS S3 to R2
- **Custom Metadata** - User-defined tags and labels
- **Offline Upload Queue** - Resumable uploads with service workers

**📖 See the full [Roadmap](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Roadmap) for details.**

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

**Note:** Hidden buckets are completely filtered from the API response and won't appear in the bucket list or be accessible through the UI.

**📖 See the [Configuration Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Configuration-Reference#hiding-buckets) for more details.**

---

## 📝 Extending File Type Support

To add support for new file extensions:

1. **Update `src/services/api.ts`:**
   - Add file type category to `FILE_TYPES` object
   - Map extensions in `getConfigByExtension()`

2. **Update `src/filegrid.tsx`:**
   - Add custom icon rendering for new extensions

3. **Update `src/app.tsx`:**
   - Add file type to upload instructions

**📖 See the [Development Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Development-Guide#adding-file-type-support) for complete instructions.**

---

## 🐛 Troubleshooting

Common issues and solutions:

- **Authentication errors:** Verify `TEAM_DOMAIN` and `POLICY_AUD` secrets
- **Bucket not found:** Check `wrangler.toml` bucket name matches exactly
- **Upload failures:** Verify your Cloudflare plan's upload size limits
- **Deployment issues:** Re-authenticate with `npx wrangler login`

**📖 For detailed solutions, see the [Troubleshooting Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Troubleshooting).**

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**📖 See the [Development Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Development-Guide) for setup instructions.**

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📞 Support

- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/neverinfamous/R2-Manager-Worker/issues)
- 💡 **Feature Requests:** [GitHub Discussions](https://github.com/neverinfamous/R2-Manager-Worker/discussions)
- 📖 **Documentation:** [GitHub Wiki](https://github.com/neverinfamous/R2-Manager-Worker/wiki)
- ❓ **Questions:** [FAQ](https://github.com/neverinfamous/R2-Manager-Worker/wiki/FAQ)

---

## 📚 Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare R2 Storage Documentation](https://developers.cloudflare.com/r2/)
- [Cloudflare Access (Zero Trust) Documentation](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [React 19 Documentation](https://react.dev/)
- [Vite Documentation](https://vite.dev/)

---

**Made with ❤️ for the Cloudflare community**