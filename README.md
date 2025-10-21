# Cloudflare R2 Bucket Manager

**Last Updated:** October 21, 2025 | **Status:** ✅ Production Ready  
**Tech Stack:** React 19.2.0 | Vite 7.1.11 | TypeScript 5.9.3 | Cloudflare Workers + Zero Trust

A modern web application for managing Cloudflare R2 buckets with enterprise-grade authentication via Cloudflare Access (Zero Trust). Deploy to your own Cloudflare account in minutes.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## ✨ Features

- 🪣 **Bucket Management** - Create, rename, and delete R2 buckets
- 📤 **Smart Uploads** - Chunked uploads with automatic retry (10MB chunks)
- 📥 **Bulk Downloads** - Download multiple files as ZIP archives
- 🔄 **File Operations** - Move and copy files between buckets
- 🔐 **Enterprise Auth** - GitHub SSO via Cloudflare Access Zero Trust
- ⚡ **Edge Performance** - Deployed on Cloudflare's global network
- 🎨 **Modern UI** - Beautiful, responsive interface built with React 19

---

## 🚀 Quick Start

### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (Free tier works!)
- [Node.js](https://nodejs.org/) 18+ and npm
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed globally
- Domain managed by Cloudflare (optional - can use Workers.dev subdomain)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/neverinfamous/R2-Manager-Worker.git
   cd R2-Manager-Worker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   # Copy template and configure for development
   cp .env.example .env
   
   # Edit .env - for local development, use:
   # VITE_WORKER_API=http://localhost:8787
   ```

4. **Configure Wrangler**
   ```bash
   # Copy template and customize
   cp wrangler.toml.example wrangler.toml
   
   # Edit wrangler.toml and update:
   # - bucket_name (your R2 bucket name)
   # - database_name and database_id (your D1 database details)
   # - Optional: custom domain routing
   ```

5. **Create Cloudflare resources**
   ```bash
   # Login to Cloudflare
   wrangler login
   
   # Create R2 bucket
   wrangler r2 bucket create your-bucket-name
   
   # Create D1 database
   wrangler d1 create your-database-name
   # Copy the database_id from output to wrangler.toml
   
   # Initialize database schema
   wrangler d1 execute your-database-name --file=worker/schema.sql
   ```

6. **Configure Cloudflare Access (Zero Trust)**
   
   Navigate to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/):
   
   - **Add Identity Provider:**
     - Go to Settings → Authentication → Login methods
     - Click "Add new" → Select "GitHub"
     - Follow GitHub OAuth setup instructions
     - Save your Client ID and Client Secret
   
   - **Create Access Application:**
     - Go to Access → Applications → Add an application
     - Select "Self-hosted"
     - Application name: "R2 Manager"
     - Session Duration: 24 hours (or your preference)
     - Application domain: Your worker domain (e.g., `r2.yourdomain.com` or `r2.yourname.workers.dev`)
   
   - **Configure Policies:**
     - **Allow Policy:** Include → Everyone (or specific GitHub users/organizations)
     - **Bypass Policy:** Include → Everyone on path `/site.webmanifest` (for static assets)
   
   - **Note Configuration:**
     - Copy your **Policy AUD** (Application Audience tag)
     - Copy your **Team Domain** (e.g., `yourteam.cloudflareaccess.com`)

7. **Set Worker Secrets**
   ```bash
   # Set required secrets (you'll be prompted for values)
   wrangler secret put ACCOUNT_ID       # From Cloudflare Dashboard
   wrangler secret put CF_EMAIL         # Your Cloudflare account email
   wrangler secret put API_KEY          # API token from Cloudflare Dashboard
   wrangler secret put TEAM_DOMAIN      # From Zero Trust (e.g., yourteam.cloudflareaccess.com)
   wrangler secret put POLICY_AUD       # From Access application
   ```

   **Where to find these values:**
   - `ACCOUNT_ID`: Dashboard → Overview (right sidebar)
   - `CF_EMAIL`: Your Cloudflare login email
   - `API_KEY`: Dashboard → My Profile → API Tokens → Create Token
     - Use "Edit Cloudflare Workers" template
     - Add R2 permissions: Account → R2 → Edit
   - `TEAM_DOMAIN`: Zero Trust → Settings → Custom Pages (shown at top)
   - `POLICY_AUD`: Access → Applications → Your App → Overview → Application Audience (AUD) Tag

8. **Deploy**
   ```bash
   # Build frontend
   npm run build
   
   # Deploy to Cloudflare
   wrangler deploy
   
   # Your app is now live! Access at:
   # - Custom domain: https://your-subdomain.your-domain.com
   # - Workers.dev: https://r2.yourname.workers.dev
   ```

---

## 🛠️ Development

### Local Development

```bash
# Terminal 1: Start Vite dev server
npm run dev
# Frontend available at http://localhost:5173

# Terminal 2: Start Wrangler worker
npx wrangler dev
# Worker API available at http://localhost:8787
```

**Note:** Cloudflare Access won't intercept localhost requests. For testing JWT authentication locally:
1. Add `127.0.0.1 r2.localhost` to your hosts file
2. Set `VITE_WORKER_API=http://r2.localhost:8787` in `.env`
3. Or test JWT validation via Postman using production tokens

### Build Commands

```bash
npm run dev           # Start Vite dev server
npm run build         # Build for production
npm run lint          # Run ESLint
npm run preview       # Preview production build
npx wrangler dev      # Start local worker
npx wrangler deploy   # Deploy to Cloudflare
```

---

## 📋 Architecture

### File Organization

```
├── src/
│   ├── app.tsx                 # Main UI component
│   ├── filegrid.tsx            # File browser with bulk operations
│   └── services/
│       ├── api.ts              # HTTP client & API calls
│       └── auth.ts             # Auth utilities (logout)
├── worker/
│   ├── index.ts                # Worker runtime & API endpoints
│   └── schema.sql              # D1 database schema
├── wrangler.toml.example       # Wrangler configuration template
├── .env.example                # Environment variables template
└── README.md                   # This file
```

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
| Deployment | Wrangler | 4.43.0+ |

---

## 🔌 API Endpoints

All endpoints require valid Cloudflare Access JWT (automatically handled by Cloudflare Access).

**Base URL:** `https://YOUR_DOMAIN/api`

### Bucket Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/buckets` | List all R2 buckets |
| `POST` | `/buckets` | Create bucket (Body: `{ "name": "bucket-name" }`) |
| `PATCH` | `/buckets/:name` | Rename bucket (Body: `{ "newName": "new-name" }`) |
| `DELETE` | `/buckets/:name` | Delete bucket (Query: `?force=true` to delete all objects first) |

### File Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/files/:bucket` | List objects in bucket (Query: `?limit=20&skipCache=true`) |
| `POST` | `/files/:bucket/upload` | Upload file (Headers: `X-Chunk-Index`, `X-Total-Chunks`, `X-File-Name`) |
| `DELETE` | `/files/:bucket/:file` | Delete single file |
| `POST` | `/files/:bucket/:file/move` | Move file (Body: `{ "destinationBucket": "target" }`) |
| `POST` | `/files/:bucket/:file/copy` | Copy file (Body: `{ "destinationBucket": "target" }`) |
| `POST` | `/files/:bucket/delete-multiple` | Delete multiple files (Body: `{ "files": ["file1", "file2"] }`) |
| `POST` | `/files/:bucket/download-zip` | Download files as ZIP (Requires `X-Signature` header) |

---

## 🔐 Authentication & Security

### How It Works

1. **User visits your domain** → Cloudflare Access intercepts unauthenticated requests
2. **GitHub SSO login** → User authenticates via GitHub OAuth
3. **JWT cookie issued** → `cf-access-jwt-assertion` cookie set automatically
4. **Worker validates JWT** → Every API request validates JWT against Cloudflare's public keys
5. **Access granted** → User can manage R2 buckets

### Security Features

- ✅ **Zero Trust Architecture** - All requests authenticated by Cloudflare Access
- ✅ **JWT Validation** - Tokens verified on every API call using `jose` library
- ✅ **HTTPS Only** - All traffic encrypted via Cloudflare's edge network
- ✅ **Signed URLs** - Download operations use HMAC-SHA256 signatures
- ✅ **No Stored Credentials** - No user passwords stored anywhere
- ✅ **Policy Enforcement** - Access policies managed in Cloudflare dashboard

### Authorization

By default, all authenticated users can access all buckets. To restrict access:

1. Update Cloudflare Access policies to specific GitHub users/orgs
2. Modify worker JWT validation to check user email against allowlist
3. Implement per-bucket ownership in D1 database (requires code changes)

---

## ⚙️ Configuration Reference

### Environment Variables (.env)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_WORKER_API` | No* | Worker API endpoint | `http://localhost:8787` (dev)<br>`https://r2.yourdomain.com` (prod) |

*If not set, uses `window.location.origin` (same domain as frontend)

### Worker Secrets (via `wrangler secret put`)

| Secret | Required | Description | Where to Find |
|--------|----------|-------------|---------------|
| `ACCOUNT_ID` | Yes | Cloudflare account ID | Dashboard → Overview |
| `CF_EMAIL` | Yes | Cloudflare account email | Your login email |
| `API_KEY` | Yes | API token with R2 permissions | Dashboard → API Tokens |
| `TEAM_DOMAIN` | Yes | Zero Trust team domain | Zero Trust → Settings |
| `POLICY_AUD` | Yes | Access application AUD tag | Access → Applications |

### Wrangler Configuration (wrangler.toml)

Key settings to customize in `wrangler.toml`:

```toml
# R2 Bucket
[[r2_buckets]]
bucket_name = "your-bucket-name"  # Must match created bucket

# D1 Database
[[d1_databases]]
database_name = "your-database-name"
database_id = "your-database-id"  # From wrangler d1 create output

# Custom Domain (optional)
[[routes]]
pattern = "your-subdomain.your-domain.com"
custom_domain = true
zone_name = "your-domain.com"
```

---

## 🐛 Troubleshooting

### Common Issues

**❌ "Failed to authenticate" error**
- Verify `TEAM_DOMAIN` and `POLICY_AUD` secrets are set correctly
- Check Cloudflare Access policies include your GitHub account
- Clear browser cookies and re-authenticate

**❌ "Bucket not found" error**
- Ensure bucket name in `wrangler.toml` matches created bucket
- Run `wrangler r2 bucket list` to verify bucket exists
- Check `ACCOUNT_ID` secret is correct

**❌ "Database error" messages**
- Verify D1 database exists: `wrangler d1 list`
- Check database schema initialized: `wrangler d1 execute <db-name> --file=worker/schema.sql`
- Confirm `database_id` in `wrangler.toml` is correct

**❌ Worker deployment fails**
- Run `wrangler login` to re-authenticate
- Check all required secrets are set: `wrangler secret list`
- Verify `npm run build` completes without errors

**❌ CORS errors in browser**
- Ensure Cloudflare Access is configured correctly
- Check that static assets have Bypass policy
- Verify `credentials: 'include'` is set in API client

### Testing JWT Authentication

Use this curl command to test JWT validation:

```bash
# Get JWT cookie from browser DevTools → Application → Cookies
curl -H "Cookie: cf-access-jwt-assertion=YOUR_JWT_TOKEN" \
     https://YOUR_DOMAIN/api/buckets
```

### Debug Mode

Enable verbose logging in worker:

```typescript
// worker/index.ts - Add at top of fetch handler
console.log('Request:', {
  url: request.url,
  method: request.method,
  headers: Object.fromEntries(request.headers)
})
```

View logs in real-time:
```bash
wrangler tail
```

---

## 📚 Additional Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Cloudflare Access Docs](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [React 19 Documentation](https://react.dev/)
- [Vite Documentation](https://vite.dev/)

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built on [Cloudflare's edge platform](https://www.cloudflare.com/)
- Inspired by the need for better R2 management tools
- Thanks to the open-source community

---

## 📞 Support

- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/neverinfamous/R2-Manager-Worker/issues)
- 💡 **Feature Requests:** [GitHub Discussions](https://github.com/neverinfamous/R2-Manager-Worker/discussions)
- 📖 **Documentation:** This README and inline code comments

---

**Made with ❤️ for the Cloudflare community**
