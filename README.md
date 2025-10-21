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
   
   Copy the template:
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` and set for local development:
   ```
   VITE_WORKER_API=http://localhost:8787
   ```

4. **Configure Wrangler**
   
   Copy the template:
   ```bash
   cp wrangler.toml.example wrangler.toml
   ```
   
   Then edit `wrangler.toml` and update these fields:
   - `bucket_name` - your R2 bucket name
   - `database_name` and `database_id` - your D1 database details
   - (Optional) custom domain routing

5. **Create Cloudflare resources**
   
   Login to Cloudflare:
   ```bash
   npx wrangler login
   ```
   
   Create R2 bucket (replace `your-bucket-name`):
   ```bash
   npx wrangler r2 bucket create your-bucket-name
   ```
   
   **Note:** Bucket names must:
   - Only contain lowercase letters (a-z), numbers (0-9), and hyphens (-)
   - Not begin or end with a hyphen
   - Be between 3-63 characters in length
   
   Create D1 database (replace `your-database-name`):
   ```bash
   npx wrangler d1 create your-database-name
   ```
   
   Copy the `database_id` from the output. When prompted "Would you like Wrangler to add it on your behalf?", select `No` (you'll add it manually to `wrangler.toml`).
   
   Initialize database schema:
   ```bash
   npx wrangler d1 execute your-database-name --remote --file=worker/schema.sql
   ```

6. **Configure Cloudflare Access (Zero Trust)**
   
   Navigate to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/):
   
   - **Add Identity Provider (GitHub OAuth):**
     1. In GitHub, go to **Settings** → **Developer Settings** → **OAuth Apps** → **New OAuth App**
     2. Enter an **Application name** (e.g., "R2 Manager")
     3. Set **Homepage URL** to: `https://<your-team-name>.cloudflareaccess.com`
     4. Set **Authorization callback URL** to: `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/callback`
     5. Click **Register application** and copy the **Client ID** and **Client Secret**
     6. In Zero Trust, go to **Settings** → **Authentication** → **Login methods** → **Add new** → **GitHub**
     7. Paste your GitHub **Client ID** and **Client Secret**, then click **Save**
     8. Test the connection by clicking **Test** next to your GitHub login method
   
   - **Create Access Application:**
     1. Go to **Access** → **Applications** → **Add an application** → **Self-hosted**
     2. **Application name:** "R2 Manager" (or your preference)
     3. **Session Duration:** 24 hours (or your preference)
     4. Click **Add public hostname**
     5. Select your domain and enter the subdomain (e.g., `r2.yourdomain.com` or use `workers.dev`)
     6. Click **Next**
   
   - **Configure Access Policies:**
     1. **Allow Policy:**
        - **Policy name:** "Allow authenticated users"
        - **Action:** Allow
        - **Include:** Select your GitHub identity provider (or specific emails/groups)
        - Click **Next**
     2. **Bypass Policy (for static assets):**
        - Create a second policy if needed
        - **Policy name:** "Bypass static assets"
        - **Action:** Bypass
        - **Include:** Everyone
        - **Path:** `/site.webmanifest`, `/favicon.ico`, `/logo.png`, and other public assets
   
   - **Save Configuration Values:**
     - After saving the application, go to **Applications** → select your app → **Overview**
     - Copy the **Application Audience (AUD) Tag** (you'll need this for `POLICY_AUD`)
     - Your **Team Domain** is shown in **Settings** → **Custom Pages** (e.g., `yourteam.cloudflareaccess.com`)

7. **Set Worker Secrets**
   
   Set each secret individually using the `npx wrangler secret put` command. You'll be prompted to enter each value:
   
   ```bash
   npx wrangler secret put ACCOUNT_ID
   ```
   ```bash
   npx wrangler secret put CF_EMAIL
   ```
   ```bash
   npx wrangler secret put API_KEY
   ```
   ```bash
   npx wrangler secret put TEAM_DOMAIN
   ```
   ```bash
   npx wrangler secret put POLICY_AUD
   ```
   
   **Where to find these values:**
   - `ACCOUNT_ID`: 
     - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → Select your account
     - Find your Account ID in the right sidebar or under **Account Home**
   
   - `CF_EMAIL`: Your Cloudflare account login email address
   
   - `API_KEY`: Create an API token with proper permissions:
     1. Go to [API Tokens page](https://dash.cloudflare.com/profile/api-tokens)
     2. Click **Create Token** → Find **Edit Cloudflare Workers** → Click **Use template**
     3. **Required permissions:**
        - Account → Workers Scripts → Edit
        - Account → Workers KV Storage → Edit  
        - Account → Workers R2 Storage → Edit
        - Account → D1 → Edit
        - Zone → Workers Routes → Edit (if using custom domain)
     4. Set **Account Resources** to the account you want to deploy to
     5. Set **Zone Resources** to your domain (if using custom domain)
     6. Click **Continue to summary** → **Create Token**
     7. **Copy the token immediately** (you won't be able to see it again)
   
   - `TEAM_DOMAIN`: 
     - In Zero Trust dashboard, go to **Settings** → **Custom Pages**
     - Your team domain is shown at the top (format: `https://yourteam.cloudflareaccess.com`)
     - Enter the **full URL** including `https://`
   
   - `POLICY_AUD`: 
     - Go to **Access** → **Applications** → Select your R2 Manager application
     - On the **Overview** tab, copy the **Application Audience (AUD) Tag**

8. **Deploy**
   
   Build frontend:
   ```bash
   npm run build
   ```
   
   Deploy to Cloudflare:
   ```bash
   npx wrangler deploy
   ```
   
   Your app is now live! Access it at:
   - **Custom domain** (if configured in `wrangler.toml`): `https://your-subdomain.your-domain.com`
   - **Workers.dev subdomain**: `https://r2-manager-worker.<your-subdomain>.workers.dev`
   
   **Note:** The deployment will automatically:
   - Upload your Worker script to Cloudflare's global network
   - Bind your R2 bucket and D1 database
   - Configure routes based on your `wrangler.toml` settings
   - Make your secrets available to the Worker

---

## 🛠️ Development

### Local Development

**Terminal 1: Start Vite dev server**
```bash
npm run dev
```
Frontend available at `http://localhost:5173`

**Terminal 2: Start Wrangler worker**
```bash
npx wrangler dev
```
Worker API available at `http://localhost:8787`

**Important Notes about Local Development:**
- Cloudflare Access authentication is **not enforced** on localhost during development
- JWT validation will be skipped for local requests
- For testing with authentication:
  - Deploy to production and test there, OR
  - Use your deployed Worker URL in `.env`: `VITE_WORKER_API=https://your-worker.workers.dev`
- Local development uses `--local` flag by default, which doesn't require secrets to be set
- To test against remote resources (D1, R2), use `npx wrangler dev --remote`

### Build Commands

Run any of these commands individually:

**Start Vite dev server:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
```

**Run ESLint:**
```bash
npm run lint
```

**Preview production build:**
```bash
npm run preview
```

**Start local worker:**
```bash
npx wrangler dev
```

**Deploy to Cloudflare:**
```bash
npx wrangler deploy
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
name = "r2-manager-worker"
main = "worker/index.ts"
compatibility_date = "2024-01-01"

# R2 Bucket binding
[[r2_buckets]]
binding = "BUCKET"  # Variable name used in your Worker code
bucket_name = "your-bucket-name"  # Must match the bucket you created

# D1 Database binding
[[d1_databases]]
binding = "DB"  # Variable name used in your Worker code
database_name = "your-database-name"  # Name of your D1 database
database_id = "your-database-id"  # UUID from wrangler d1 create output

# Custom Domain (optional - for production deployment)
# Option 1: Custom Domain (recommended)
[[routes]]
pattern = "r2.yourdomain.com"
custom_domain = true

# Option 2: Route with existing DNS (if you have an origin server)
# [[routes]]
# pattern = "r2.yourdomain.com/*"
# zone_name = "yourdomain.com"

# Workers.dev subdomain (enabled by default)
# Your Worker will be accessible at: https://r2-manager-worker.<your-subdomain>.workers.dev
```

**Important Notes:**
- `bucket_name` must exactly match the R2 bucket you created
- `database_id` is the UUID shown when you ran `wrangler d1 create`
- For custom domains, your domain must be active on Cloudflare
- Custom domains automatically create DNS records and SSL certificates
- The `binding` values (e.g., `BUCKET`, `DB`) are how you access these resources in your Worker code

---

## 🐛 Troubleshooting

### Common Issues

**❌ "Failed to authenticate" error**
- Verify `TEAM_DOMAIN` includes the full URL: `https://yourteam.cloudflareaccess.com`
- Confirm `POLICY_AUD` matches the Application Audience Tag in Zero Trust dashboard
- Check your GitHub account is allowed in the Access policy
- Clear browser cookies and try re-authenticating
- Verify the JWT cookie `cf-access-jwt-assertion` is being set (check browser DevTools → Application → Cookies)

**❌ "Bucket not found" error**
- Run `npx wrangler r2 bucket list` to verify the bucket exists
- Ensure `bucket_name` in `wrangler.toml` exactly matches the created bucket (case-sensitive)
- Verify `ACCOUNT_ID` secret is correct
- Check your API token has R2 Storage permissions

**❌ "Database error" messages**
- List databases: `npx wrangler d1 list`
- Verify schema is initialized: `npx wrangler d1 execute <db-name> --remote --command="SELECT name FROM sqlite_master WHERE type='table'"`
- Confirm `database_id` in `wrangler.toml` matches the UUID from `wrangler d1 create` output
- Ensure your API token has D1 Edit permissions

**❌ Worker deployment fails**
- Re-authenticate: `npx wrangler login`
- List secrets to verify they're set: `npx wrangler secret list`
- Check for build errors: `npm run build`
- Verify `wrangler.toml` syntax is correct (especially multiline arrays)
- Ensure your API token has Workers Scripts Edit permission

**❌ CORS errors in browser**
- Verify Cloudflare Access application domain matches your Worker domain
- Create a Bypass policy for static assets (`/favicon.ico`, `/logo.png`, etc.)
- Check that API requests include credentials: `credentials: 'include'` in fetch calls
- Ensure the Worker is deployed to the correct domain

### Testing JWT Authentication

Test JWT validation with curl:

```bash
curl -H "Cookie: cf-access-jwt-assertion=YOUR_JWT_TOKEN" \
     https://YOUR_DOMAIN/api/buckets
```

**To get your JWT token:**
1. Open your browser and log in to your deployed Worker
2. Open DevTools (F12) → **Application** tab → **Cookies**
3. Find `cf-access-jwt-assertion` and copy its value
4. Replace `YOUR_JWT_TOKEN` in the curl command above
5. Replace `YOUR_DOMAIN` with your Worker's domain

**To verify JWT payload:**
1. Copy your JWT token
2. Visit [jwt.io](https://jwt.io/)
3. Paste the token in the "Encoded" section
4. Verify:
   - `iss` matches your team domain: `https://<team-name>.cloudflareaccess.com`
   - `aud` contains your Application Audience Tag
   - Token is not expired (check `exp` timestamp)

### Debug Mode

Enable verbose logging in your Worker:

1. Add logging to `worker/index.ts` at the top of the fetch handler:

```typescript
console.log('Request:', {
  url: request.url,
  method: request.method,
  headers: Object.fromEntries(request.headers),
  jwtToken: request.headers.get('cf-access-jwt-assertion') ? 'Present' : 'Missing'
})
```

2. View real-time logs:
```bash
npx wrangler tail
```

3. Or view logs in the dashboard:
   - Go to **Workers & Pages** → Select your Worker → **Logs** tab
   - Real-time logs show all console.log output and errors

---

## 📚 Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare R2 Storage Documentation](https://developers.cloudflare.com/r2/)
- [Cloudflare D1 Database Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare Access (Zero Trust) Documentation](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [Cloudflare Access JWT Validation](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/)
- [Wrangler CLI Commands Reference](https://developers.cloudflare.com/workers/wrangler/commands/)
- [Wrangler Configuration Reference](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Creating Cloudflare API Tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
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
