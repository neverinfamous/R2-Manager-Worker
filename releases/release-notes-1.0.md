# 🎉 R2 Bucket Manager v1.0 - First Official Release

**Release Date:** October 24, 2025  
**Status:** ✅ Production Ready

We're excited to announce the first official release of **R2 Bucket Manager** - a modern, enterprise-grade web application for managing Cloudflare R2 buckets with Zero Trust authentication!

---

## 🌟 What is R2 Bucket Manager?

A self-hosted, feature-rich file management interface for Cloudflare R2 storage that provides capabilities missing from Cloudflare's native dashboard. Built with React 19, TypeScript, and deployed on Cloudflare's global edge network.

**Live Demo:** [https://adamic.tech](https://adamic.tech)

---

## ✨ Key Features

### 🪣 **Bucket Management**
- Create, rename, and delete R2 buckets
- Force delete with confirmation for non-empty buckets

### 📁 **Folder Management**
- Create, rename, copy, move, and delete folders
- Hierarchical navigation with breadcrumbs
- Batch operations on entire folder structures

### 📄 **File Management**
- Upload files with drag-and-drop support
- Chunked uploads (10MB chunks, up to 500MB files)*
- Rename files via right-click context menu
- Copy and move files between buckets and folders
- Batch operations (copy, move, delete multiple files)

### 🔍 **Smart Filtering**
- **Basic Filter** - Real-time search by filename/folder name
- **Type Filter** - Show All / Files Only / Folders Only
- **Advanced Filters:**
  - 📷 **Extension Filter** - Quick filters for Images, Documents, Videos, Code, Archives, or custom selection
  - 📊 **Size Filter** - Preset ranges (< 1MB, 1-10MB, etc.) or custom min/max
  - 📅 **Date Filter** - Preset ranges (Today, Last 7/30/90 Days) or custom date range
- **Filter Management** - Active filter badges, statistics, and one-click clear all

### 📥 **Download & Sharing**
- Generate signed URLs for secure file sharing
- Download multiple files as ZIP archives
- Bulk download with progress tracking

### 🎨 **Modern UI**
- Beautiful, responsive interface built with React 19
- Light/Dark mode with system preference detection
- Grid and list view modes
- Mobile-optimized design
- Smooth animations and transitions

### 🔐 **Enterprise Security**
- GitHub SSO via Cloudflare Access (Zero Trust)
- JWT token validation on every API call
- HTTPS-only traffic via Cloudflare's edge
- HMAC-SHA256 signed URLs
- No stored credentials

---

## 🚀 Tech Stack

| Component  | Technology         | Version       |
| ---------- | ------------------ | ------------- |
| Frontend   | React              | 19.2.0        |
| Build Tool | Vite               | 7.1.11        |
| Language   | TypeScript         | 5.9.3         |
| Backend    | Cloudflare Workers | Runtime API   |
| Storage    | Cloudflare R2      | S3-compatible |
| Auth       | Cloudflare Access  | Zero Trust    |

---

## 📦 Installation

### Prerequisites
- Cloudflare account (Free tier works!)
- Node.js 18+ and npm
- Wrangler CLI
- Domain managed by Cloudflare (optional - can use Workers.dev subdomain)

### Quick Start

```bash
# Clone and install
git clone https://github.com/neverinfamous/R2-Manager-Worker.git
cd R2-Manager-Worker
npm install

# Configure environment
cp .env.example .env
cp wrangler.toml.example wrangler.toml

# Create Cloudflare resources
npx wrangler login
npx wrangler r2 bucket create your-bucket-name

# Set Worker secrets
npx wrangler secret put ACCOUNT_ID
npx wrangler secret put CF_EMAIL
npx wrangler secret put API_KEY
npx wrangler secret put TEAM_DOMAIN
npx wrangler secret put POLICY_AUD

# Deploy
npm run build
npx wrangler deploy
```

**📖 Full documentation:** [Installation & Setup Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Installation-&-Setup)

---

## 📚 Documentation

Complete documentation is available in the [GitHub Wiki](https://github.com/neverinfamous/R2-Manager-Worker/wiki):

- [Installation & Setup Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Installation-&-Setup)
- [API Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/API-Reference)
- [Configuration Reference](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Configuration-Reference)
- [Development Guide](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Development-Guide)
- [Authentication & Security](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Authentication-&-Security)
- [Troubleshooting](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Troubleshooting)
- [FAQ](https://github.com/neverinfamous/R2-Manager-Worker/wiki/FAQ)

---

## 🔒 Security Highlights

This release includes several security enhancements:

- ✅ **HMAC-SHA256 Signatures** - Replaced weak XOR-based signatures with industry-standard HMAC-SHA256 (2^256 possible values)
- ✅ **Zero Trust Architecture** - All requests authenticated by Cloudflare Access
- ✅ **JWT Validation** - Tokens verified on every API call
- ✅ **HTTPS Only** - All traffic encrypted via Cloudflare's edge network
- ✅ **No Stored Credentials** - No user passwords stored anywhere

---

## ⚠️ Important Notes

**Upload Size Limits:** This application supports uploads up to 500MB per file. However, **Cloudflare enforces plan-based limits**:
- **Free/Pro Plans:** 100MB maximum per file
- **Business Plan:** 200MB maximum per file  
- **Enterprise Plan:** 500MB maximum per file

---

## 🗺️ Roadmap

Future enhancements planned:
- Rate limiting for API endpoints (Cloudflare KV)
- Refactor large monolithic files (worker/index.ts, filegrid.tsx)
- AWS S3 migration support
- File versioning
- Audit logging
- Role-Based Access Control (RBAC)
- Offline upload queue
- Custom branding
- Custom metadata and tags

**📖 Full roadmap:** [Roadmap](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Roadmap)

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/CONTRIBUTING.md) for guidelines.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/neverinfamous/R2-Manager-Worker/blob/main/LICENSE) file for details.

---

## 📞 Support

- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/neverinfamous/R2-Manager-Worker/issues)
- 💡 **Feature Requests:** [GitHub Discussions](https://github.com/neverinfamous/R2-Manager-Worker/discussions)
- 📖 **Documentation:** [GitHub Wiki](https://github.com/neverinfamous/R2-Manager-Worker/wiki)
- ❓ **Questions:** [FAQ](https://github.com/neverinfamous/R2-Manager-Worker/wiki/FAQ)

---

**Made with ❤️ for the Cloudflare community**

Thank you for using R2 Bucket Manager!