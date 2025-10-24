# R2 Bucket Manager for Cloudflare

**Last Updated:** October 24, 2025 | **Status:** ✅ Production Ready | **Version:** 1.0  
**Tech Stack:** React 19.2.0 | Vite 7.1.11 | TypeScript 5.9.3 | Cloudflare Workers + Zero Trust

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/R2--Manager--Worker-blue?logo=github)](https://github.com/neverinfamous/R2-Manager-Worker)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/r2-bucket-manager)](https://hub.docker.com/r/writenotenow/r2-bucket-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/version-v1.0-green)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/SECURITY.md)

A modern web application for managing Cloudflare R2 buckets with enterprise-grade authentication via Cloudflare Access (Zero Trust). 

**🚀 Docker Deployment:** Run the development server in a containerized environment for testing and local development.

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

```bash
docker run -p 8787:8787 \
  -v $(pwd)/wrangler.toml:/app/wrangler.toml \
  -e ACCOUNT_ID=your_account_id \
  -e CF_EMAIL=your_email \
  -e API_KEY=your_api_key \
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

Mount your `wrangler.toml` configuration:

```bash
-v /path/to/your/wrangler.toml:/app/wrangler.toml
```

---

## 📦 Available Tags

| Tag | Description | Use Case |
|-----|-------------|----------|
| `latest` | Latest stable release | **Recommended for testing** |
| `v1.0` | Specific version | Pin to exact version |
| `sha-abc1234` | Commit SHA (12-char short) | Development/traceability |

**Pull a specific version:**

```bash
docker pull writenotenow/r2-bucket-manager:v1.0
```

---

## ✨ Features

- 🪣 **Bucket Management** - Create, rename, and delete R2 buckets
- 📁 **Folder Management** - Create, rename, copy, move, and delete folders
- 📄 **File Management** - Rename files via context menu
- 🔍 **Smart Filtering** - Real-time filtering by filename/folder name
- 🎯 **Advanced Filtering** - Filter by extension, size, and date
- 📤 **Smart Uploads** - Chunked uploads with retry (up to 500MB)*
- 📥 **Bulk Downloads** - Download multiple files as ZIP
- 🔗 **Shareable Links** - Generate signed URLs
- 🔄 **Advanced Operations** - Move/copy between buckets
- 🧭 **Breadcrumb Navigation** - Easy folder traversal
- 🔐 **Enterprise Auth** - GitHub SSO via Cloudflare Access
- 🌓 **Light/Dark Mode** - System, light, or dark themes

**\*Upload Size Limits:** Plan-based (Free: 100MB, Pro: 100MB, Business: 200MB, Enterprise: 500MB)

---

## 🐳 Docker Image Details

### Image Specifications

- **Base Image:** Node.js 22 Alpine
- **Platforms:** AMD64, ARM64 (multi-arch)
- **Size:** ~150MB compressed
- **User:** Non-root (`app:1000`)
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

## 🏗️ Local Development with Docker

### Option 1: Use Pre-built Image

```bash
docker pull writenotenow/r2-bucket-manager:latest
docker run -p 8787:8787 -v $(pwd):/app writenotenow/r2-bucket-manager:latest
```

### Option 2: Build from Source

```bash
git clone https://github.com/neverinfamous/R2-Manager-Worker.git
cd R2-Manager-Worker
docker build -t r2-manager-local .
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

### v1.0 (October 24, 2025) 🎉
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

