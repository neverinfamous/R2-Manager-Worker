# R2 Bucket Manager for Cloudflare

**Last Updated:** October 23, 2025 | **Status:** ✅ Production Ready | **Version:** 1.1.1  
**Tech Stack:** React 19.2.0 | Vite 7.1.11 | TypeScript 5.9.3 | Cloudflare Workers + Zero Trust

![License](https://img.shields.io/badge/license-MIT-blue.svg)

A modern web application for managing Cloudflare R2 buckets with enterprise-grade authentication via Cloudflare Access (Zero Trust). Deploy to your own Cloudflare account in minutes.

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

Cloudflare's dashboard lacks full-featured R2 file management capabilities. This tool provides a self-hosted alternative for developers and enterprises wanting:

- Complete control over R2 buckets with advanced file operations
- Seamless SSO integration via GitHub (or other identity providers)
- Modern, responsive interface for managing files at scale
- Edge-deployed performance on Cloudflare's global network

---

## ✨ Features

- 🪣 **Bucket Management** - Create, rename, and delete R2 buckets
- 📁 **Folder Management** - Create, rename, copy, move, and delete folders with hierarchical navigation
- 📄 **File Management** - Rename files via right-click context menu with validation
- 📤 **Smart Uploads** - Chunked uploads with automatic retry (10MB chunks, up to 500MB files)*
- 📥 **Bulk Downloads** - Download multiple files as ZIP archives
- 🔗 **Shareable Links** - Generate signed URLs to share files securely
- 🔄 **Advanced File Operations** - Move and copy files/folders between buckets and to specific folders within buckets
- 🧭 **Breadcrumb Navigation** - Navigate through folder hierarchies with ease
- 🔐 **Enterprise Auth** - GitHub SSO via Cloudflare Access Zero Trust
- ⚡ **Edge Performance** - Deployed on Cloudflare's global network
- 🎨 **Modern UI** - Beautiful, responsive interface built with React 19

**\*Upload Size Limits:** This application supports uploads up to 500MB per file. However, **Cloudflare enforces plan-based limits**:
- **Free/Pro Plans:** 100MB maximum per file
- **Business Plan:** 200MB maximum per file  
- **Enterprise Plan:** 500MB maximum per file

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

## 🛠️ Local Development

**Terminal 1: Frontend dev server**
```bash
npm run dev
```

**Terminal 2: Worker dev server**
```bash
npx wrangler dev
```

Frontend: `http://localhost:5173`  
Worker API: `http://localhost:8787`

**Note:** Authentication is disabled on localhost for easier development.

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

### Recently Completed ✅

- ✅ **Folder-to-Folder Transfers** - Copy and move files/folders to specific folders within the same or different buckets (v1.1.1)
- ✅ **Folder Management** - Create, rename, copy, move, and delete folders with breadcrumb navigation (v1.1.0)
- ✅ **File & Folder Rename** - Right-click context menu to rename files and folders with validation (v1.1.0)

### Planned Features
- **Support toml files** - Add .toml to allowed upload file types with the code icon
- **Filter by filename** - Filter through file lists by filename input
- **AWS S3 Migration** - Add support for migrating AWS S3 to R2
- **Audit Logging** - Track all user actions in D1 database
- **Role-Based Access Control (RBAC)** - Fine-grained permissions
- **File Versioning** - Track and restore previous versions
- **Offline Upload Queue** - Resumable uploads with service workers
- **Custom Branding** - Configurable logo and colors
- **Custom Metadata** - User-defined tags and labels

**📖 See the full [Roadmap](https://github.com/neverinfamous/R2-Manager-Worker/wiki/Roadmap) for details.**

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