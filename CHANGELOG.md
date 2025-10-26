# Changelog

All notable changes to R2 Bucket Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-10-26

### Fixed
- **Local Development Environment** - Fixed broken local development setup
  - Added `wrangler.dev.toml` configuration for development (skips frontend build)
  - Fixed CORS configuration to allow `http://localhost:5173` origin with credentials
  - Added automatic authentication bypass for localhost requests
  - Added mock bucket data support for local testing without Cloudflare API credentials
  - Fixed 500 errors when ASSETS binding is missing in development mode
  - Configured `.env` file for proper localhost API endpoint

### Changed
- Updated `worker/index.ts` to detect localhost and handle development mode
- Updated README.md with correct local development instructions
- Updated Development Guide wiki with accurate setup steps
- Updated `wrangler.toml.example` to clarify production vs development usage

### Documentation
- Added comprehensive local development section to README
- Updated Development Guide wiki with troubleshooting steps
- Clarified that local dev returns mock data and doesn't require secrets

## [1.0.0] - 2025-10-24

### Added
- **Initial Release** - Full-featured R2 bucket manager
- Bucket management (create, rename, delete with force option)
- Folder management (create, rename, copy, move, delete)
- File operations (upload, download, rename, copy, move, delete)
- Advanced filtering system:
  - Extension filters (images, documents, videos, code, archives)
  - Size filters (preset ranges and custom)
  - Date filters (preset ranges and custom)
  - Active filter badges and statistics
- Chunked file uploads (10MB chunks, up to 500MB files)
- Bulk file downloads as ZIP archives
- Signed URL generation for secure file sharing
- Light/Dark/System theme support with toggle
- Breadcrumb navigation for folder hierarchies
- Grid and list view modes
- Real-time search and filtering
- GitHub SSO via Cloudflare Access (Zero Trust)
- Responsive design for mobile and desktop
- Production deployment on Cloudflare Workers

### Tech Stack
- React 19.2.0
- Vite 7.1.11
- TypeScript 5.9.3
- Cloudflare Workers Runtime API
- Cloudflare R2 (S3-compatible storage)
- Cloudflare D1 (SQLite database)
- Cloudflare Access (Zero Trust authentication)

### Documentation
- Comprehensive README with quick start guide
- GitHub Wiki with complete documentation:
  - Installation & Setup Guide
  - API Reference
  - Configuration Reference
  - Development Guide
  - Authentication & Security
  - Troubleshooting
  - FAQ
- Docker deployment guide
- Contributing guidelines
- Security policy

---

## Release Notes

### Version 1.0.1
This patch release fixes the local development environment which was previously non-functional. Developers can now run both frontend (Vite) and backend (Wrangler) servers locally with automatic authentication bypass and mock data support. No changes to production functionality.

### Version 1.0.0
Initial production release with full R2 bucket management capabilities, enterprise authentication, and modern UI/UX.

---

**Links:**
- [GitHub Repository](https://github.com/neverinfamous/R2-Manager-Worker)
- [Live Demo](https://r2.adamic.tech/)
- [Docker Hub](https://hub.docker.com/r/writenotenow/r2-bucket-manager)
- [Documentation Wiki](https://github.com/neverinfamous/R2-Manager-Worker/wiki)

