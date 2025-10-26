# R2 Bucket Manager for Cloudflare

**Last Updated:** October 24, 2025 | **Status:** ✅ Production Ready | **Version:** 1.0.1  
**Tech Stack:** React 19.2.0 | Vite 7.1.11 | TypeScript 5.9.3 | Cloudflare Workers + Zero Trust

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/R2--Manager--Worker-blue?logo=github)](https://github.com/neverinfamous/R2-Manager-Worker)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/r2-bucket-manager)](https://hub.docker.com/r/writenotenow/r2-bucket-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/version-v1.0.1-green)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/SECURITY.md)
[![CodeQL](https://img.shields.io/badge/CodeQL-Passing-brightgreen.svg)](https://github.com/neverinfamous/R2-Manager-Worker/security/code-scanning)
[![Type Safety](https://img.shields.io/badge/Pyright-Strict-blue.svg)](https://github.com/neverinfamous/R2-Manager-Worker)

A modern web application for managing Cloudflare R2 buckets with enterprise-grade authentication via Cloudflare Access (Zero Trust). Deploy to your own Cloudflare account in minutes.

**🎯 [Try the Live Demo](https://r2.adamic.tech/)** - See R2 Bucket Manager in action

**🚀 Deployment Options:**
- **[Docker Hub](https://hub.docker.com/r/writenotenow/r2-bucket-manager)** - Containerized development environment (~372MB)
- **[Cloudflare Workers](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Installation-&-Setup)** - Production deployment on the edge

**📰 [Read the v1.0 Release Article](https://adamic.tech/articles/2025-10-24-r2-bucket-manager-v1-0)** - Learn more about features, architecture, and deployment

---

## 📖 Documentation

**Complete documentation is available in the [GitHub Wiki](https://github.com/neverinfamous/R2-Manager-Worker/wiki):**

- **[Installation & Setup Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Installation-&-Setup)** - Step-by-step deployment instructions
- **[API Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/API-Reference)** - Complete endpoint documentation
- **[Configuration Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Configuration-Reference)** - Environment variables and settings
- **[Development Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Development-Guide)** - Local development and contributing
- **[Authentication & Security](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Authentication-&-Security)** - Zero Trust implementation details
- **[Troubleshooting](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Troubleshooting)** - Common issues and solutions
- **[FAQ](https://github.com/neverinfamous/R2-Manager-Worker/wiki/FAQ)** - Frequently asked questions

---

## 🎯 Why It Exists

Cloudflare's dashboard lacks the full-featured R2 file management capabilities. This tool provides a self-hosted alternative for developers and enterprises wanting:

- Complete control over R2 buckets with advanced file operations
- Seamless SSO integration via GitHub (or other identity providers)
- Modern, responsive interface for managing files at scale
- Edge-deployed performance on Cloudflare's global network

---

## ✨ Features

- 🪣 **Bucket Management** - Create, rename, and delete R2 buckets
- 📁 **Folder Management** - Create, rename, copy, move, and delete folders with hierarchical navigation
- 📄 **File Management** - Rename files via right-click context menu with validation
- 🔍 **Smart Filtering** - Real-time client-side filtering by filename/folder name with type filters (All/Files/Folders)
- 🎯 **Advanced Filtering** - Filter files by extension, size ranges, and upload dates with preset and custom options
- 📤 **Smart Uploads** - Chunked uploads with automatic retry (10MB chunks, up to 500MB files)*
- 📥 **Bulk Downloads** - Download multiple files as ZIP archives
- 🔗 **Shareable Links** - Generate signed URLs to share files securely
- 🔄 **Advanced File Operations** - Move and copy files/folders between buckets and to specific folders within buckets
- 🧭 **Breadcrumb Navigation** - Navigate through folder hierarchies with ease
- 🔐 **Enterprise Auth** - GitHub SSO via Cloudflare Access Zero Trust
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
- **Code** (CSS, GO, HTML, Java, JS, Rust, TS, Python, etc.) - up to 10MB
- **Config & Metadata** (CONF, ENV, INI, JSON, JSONC, LOCK, TOML, etc.) - up to 10MB
- **Data Formats** (AVRO, FEATHER, NDJSON) - up to 50MB
- **Databases** (DB, PARQUET, SQL) - up to 50MB
- **Dev Environment** (Dockerfile, editorconfig, .gitignore, nvmrc, etc.) - up to 1MB
- **Documents** (CSV, Excel, Markdown, PDF, PowerPoint, TXT, Word, etc.) - up to 50MB
- **Documentation** (NFO) - up to 10MB
- **Images** (AVIF, BMP, GIF, HEIC, JPG, PNG, PSD, SVG, WebP) - up to 15MB
- **Jupyter Notebooks** (.ipynb) - up to 10MB
- **Videos** (AVI, MKV, MOV, MP4, WebM, WMV) - up to 500MB

---

## 🚀 Quick Start

### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (Free tier works!)
- [Node.js](https://nodejs.org/) 18+ and npm
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Domain managed by Cloudflare (optional - can use Workers.dev subdomain)

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

3. **Create Cloudflare resources:**
   ```bash
   npx wrangler login
   npx wrangler r2 bucket create your-bucket-name
   npx wrangler d1 create your-database-name
   npx wrangler d1 execute your-database-name --remote --file=worker/schema.sql
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

## 🌓 Theme Customization

R2 Bucket Manager supports both light and dark themes with automatic system preference detection:

### Theme Modes
- **System** (default) - Automatically follows your OS/browser theme preference
- **Light** - Force light mode regardless of system settings
- **Dark** - Force dark mode regardless of system settings

### How to Use
1. Click the theme toggle button in the header (next to the Logout button)
2. Cycle through: System → Light → Dark → System
3. Your preference is saved automatically and persists across sessions
4. In System mode, the theme updates automatically when you change your OS theme

### Technical Details
- Theme preference stored in `localStorage`
- Smooth CSS transitions between themes
- All colors managed via CSS custom properties
- Mobile-friendly with responsive design
- WCAG compliant color contrast ratios

---

## 🔍 Filtering Files and Folders

R2 Bucket Manager includes a comprehensive filtering system to help you quickly find files and folders in large buckets:

### Basic Filtering
1. Use the search bar to filter by filename/folder name
2. Choose filter type from the dropdown: **All** / **Files Only** / **Folders Only**
3. View the match counter showing filtered results (e.g., "23 of 156")
4. Click the **✕** button to clear the filter

### Advanced Filtering (NEW!)

#### Extension Filter
- **Quick Filters** - One-click filters for common file types:
  - 📷 Images (.jpg, .png, .gif, .webp, etc.)
  - 📄 Documents (.pdf, .doc, .xlsx, .txt, etc.)
  - 🎬 Videos (.mp4, .mov, .webm)
  - 💻 Code (.js, .py, .html, .css, etc.)
  - 📦 Archives (.zip, .rar, .tar, .gz)
- **Custom Selection** - Select specific extensions from available files
- **Multi-select** - Combine multiple extensions in a single filter
- **Extension Counts** - See how many files of each type you have

#### Size Filter
- **Preset Ranges**:
  - < 1 MB
  - 1 - 10 MB
  - 10 - 50 MB
  - 50 - 100 MB
  - \> 100 MB
- **Custom Range** - Set your own min/max size in MB
- **Real-time Display** - See active size range in the filter button

#### Date Filter
- **Preset Ranges**:
  - Today
  - Last 7 Days
  - Last 30 Days
  - Last 90 Days
  - This Year
- **Custom Range** - Select specific start and end dates
- **Upload Date Based** - Filters by when files were uploaded to R2

### Filter Management
- **Active Filter Badges** - See all active filters at a glance with removable badges
- **Filter Statistics** - View total size and date range of filtered results
- **Clear All Filters** - One-click button to reset all filters
- **Persistent During Operations** - Filters remain active during file selection and operations

### Features
- **Real-time filtering** - Results update instantly as you apply filters
- **Case-insensitive search** - Searches match regardless of case
- **Filename-only matching** - Searches file/folder names, not full paths
- **Combine Filters** - Use multiple filter types simultaneously for precise results
- **Works with all views** - Filter in both grid and list views
- **Preserved selections** - Your selected files remain selected during filtering
- **Mobile Responsive** - Optimized for all screen sizes

### Use Cases
- Find all PDF documents uploaded in the last week
- Locate large video files (>100MB)
- Filter images by extension (.png only)
- Narrow down files by size and date range before bulk operations
- Quickly locate specific file types in buckets with thousands of items

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

**Note:** Authentication is disabled on localhost for easier development. No Cloudflare Access configuration needed for local dev.

### Development Configuration Files

- `.env` - Frontend environment variables (points to `http://localhost:8787`)
- `wrangler.dev.toml` - Development-specific Worker config (skips frontend build, adds mock data support)
- `wrangler.toml` - Production Worker config (includes build step)

### What's Different in Local Development

- **Authentication:** Automatically disabled for localhost requests
- **CORS:** Configured to allow `http://localhost:5173` with credentials
- **Data:** Returns mock bucket data (no real Cloudflare API calls)
- **No Secrets Required:** Works without `ACCOUNT_ID`, `CF_EMAIL`, or `API_KEY`

**📖 For more details, see the [Development Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Development-Guide).**

---

## 📋 Architecture

### Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Frontend | React | 19.2.0 |
| Build Tool | Vite | 7.1.11 |
| Language | TypeScript | 5.9.3 |
| Backend | Cloudflare Workers | Runtime API |
| Storage | Cloudflare R2 | S3-compatible |
| Database | Cloudflare D1 | SQLite |
| Auth | Cloudflare Access | Zero Trust |

### File Organization

```
├── src/                      # Frontend source code
│   ├── app.tsx              # Main UI component
│   ├── filegrid.tsx         # File browser with grid/list views
│   └── services/            # API client and auth utilities
├── worker/
│   ├── index.ts             # Worker runtime & API endpoints
│   └── schema.sql           # D1 database schema
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
- ✅ **HTTPS Only** - All traffic encrypted via Cloudflare's edge network
- ✅ **Signed URLs** - Download operations use HMAC-SHA256 signatures
- ✅ **No Stored Credentials** - No user passwords stored anywhere

**📖 Learn more in the [Authentication & Security Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Authentication-&-Security).**

---

## 📋 Roadmap

### Planned Features
- **Add rate limiting for API endpoints** (Cloudflare KV)
- **Refactor worker/index.ts and filegrid.tsx** - Large monolithic files
- **AWS S3 Migration** - Add support for migrating AWS S3 to R2
- **File Versioning** - Track and restore previous versions
- **Audit Logging** - Track all user actions in D1 database
- **Role-Based Access Control (RBAC)** - Fine-grained permissions
- **Offline Upload Queue** - Resumable uploads with service workers
- **Custom Branding** - Configurable logo and colors
- **Custom Metadata** - User-defined tags and labels

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
- [Cloudflare D1 Database Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare Access (Zero Trust) Documentation](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [React 19 Documentation](https://react.dev/)
- [Vite Documentation](https://vite.dev/)

---

**Made with ❤️ for the Cloudflare community**