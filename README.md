# Cloudflare R2 Bucket Manager

**Last Updated:** October 20, 2025 | **Status:** ✅ Stable 
**Tech Stack:** React 19.2.0 | Vite 7.1.11 | TypeScript 5.9.3 | Cloudflare Workers + Zero Trust

A web application for managing Cloudflare R2 buckets with GitHub SSO authentication via Cloudflare Access (Zero Trust) and Worker.

---

## 🔐 Authentication

**System:** Cloudflare Access Zero Trust + GitHub SSO (ONE-CLICK setup)
- No custom auth logic - all handled by Cloudflare Access
- Frontend: Redirects unauthenticated users to `/cdn-cgi/access/login`
- Backend: JWT validation via `cf-access-jwt-assertion` cookie
- Authorization: All authenticated users can access all buckets (Cloudflare Access handles policy enforcement)
- Files: `src/services/auth.ts` (minimal), `worker/index.ts` lines ~130-165 (validateAccessJWT function)

**Key Details:**
- JWT passed as **cookie** (`cf-access-jwt-assertion`), not header
- Verify with `jose` library using Cloudflare's public keys
- Policy ID (POLICY_AUD) + Team Domain (TEAM_DOMAIN) required as secrets
- D1 database: Schema still exists but only stores file metadata (not user auth)

---

## 📋 Critical Architecture

### File Organization
```
src/
├── app.tsx                 # Main UI (bucket list, file grid, upload area)
├── filegrid.tsx            # File browser for selected bucket
├── services/
│   ├── api.ts              # HTTP client (all requests go through Worker)
│   └── auth.ts             # Auth service (logout only)
└── components/
    └── auth.tsx            # DELETED - auth handled by Cloudflare Access

worker/
├── index.ts                # Worker runtime (~1163 lines)
│   ├── handleApiRequest()  # Main request router
│   ├── validateAccessJWT() # JWT verification (lines ~130-165)
│   └── Endpoints:          # Listed below
└── schema.sql              # D1 schema (minimal - file metadata only)
```

### Current Stack Versions
- **React:** 19.2.0 | **Vite:** 7.1.11 | **TypeScript:** 5.9.3 | **Wrangler:** 4.43.0 | **Node:** 25.x

---

## 🔌 Worker API Endpoints

All endpoints require valid Cloudflare Access JWT. Base: `https://r2.adamic.tech/api`

### Bucket Management

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/buckets` | ✅ Required | List all R2 buckets (filters: r2-bucket, sqlite-mcp-server-wiki) |
| `POST` | `/buckets` | ✅ Required | Create bucket. Body: `{ "name": "bucket-name" }` |
| `PUT` | `/buckets/:name` | ✅ Required | Rename bucket. Body: `{ "newName": "new-name" }` |
| `DELETE` | `/buckets/:name` | ✅ Required | Delete bucket. Query: `?force=true` to delete all objects first |

### File Management

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/files/:bucket` | ✅ Required | List objects in bucket. Query: `?limit=20&skipCache=true` |
| `POST` | `/files/:bucket/upload` | ✅ Required | Chunked upload. Headers: `X-Chunk-Index`, `X-Total-Chunks`, `X-File-Name` |
| `DELETE` | `/files/:bucket/:file` | ✅ Required | Delete single file |
| `POST` | `/files/:bucket/:file/move` | ✅ Required | Move file to another bucket. Body: `{ "destinationBucket": "target-bucket" }` |
| `POST` | `/files/:bucket/delete-multiple` | ✅ Required | Delete multiple files. Body: `{ "files": ["file1", "file2"] }` |
| `GET` | `/files/:bucket/download-zip` | ✅ Required (Signed) | Download files as ZIP. Uses `X-Signature` header validation |

### Static Assets (No Auth Required)

| Path | Response | Cache |
|------|----------|-------|
| `/site.webmanifest` | JSON manifest | 86400s |
| `/favicon.ico` | Static file | Via ASSETS |
| `/manifest.json` | Static file | Via ASSETS |

---

## ⚙️ Required Configuration

### Cloudflare Access Setup
1. Create Access Application for `r2.adamic.tech`
2. Add **GitHub** as identity provider
3. Create **Allow** policy: Include → Everyone
4. Add **Bypass** policy for static assets: Include → Everyone on path `/site.webmanifest`
5. Note Policy ID (AUD tag) and Team Domain

### Worker Secrets (via `wrangler secret put`)
```
ACCOUNT_ID          # Cloudflare account ID
CF_EMAIL            # Cloudflare account email
API_KEY             # Cloudflare API token
TEAM_DOMAIN         # Cloudflare Access team domain (from Zero Trust)
POLICY_AUD          # Policy ID from Access policy
```

### Removed Secrets (Old System)
- ~~REGISTRATION_CODE~~ - Not used
- ~~URL_SIGNING_KEY~~ - Not used
- ~~DB schema includes users/sessions~~ - Not used, but tables still in schema

---

## 🚀 Development Quick Reference

### Frontend
```bash
npm install
npm run dev           # http://localhost:5173
npm run build
npm run lint
```

### Worker
```bash
npx wrangler dev     # http://localhost:8787 (requires .env: VITE_WORKER_API=http://localhost:8787)
npx wrangler deploy
```

### Local Testing with Zero Trust
1. Add `127.0.0.1 r2.localhost` to hosts file
2. Set `VITE_WORKER_API=http://r2.localhost:8787` in `.env`
3. Note: Cloudflare Access won't intercept localhost requests; test JWT via Postman

---

## 🐛 Known Issues & Solutions

| Issue | Cause | Fix |
|-------|-------|-----|
| 403 on bucket ops | Ownership checks still in code | ✅ FIXED: Removed all ownership checks (Access handles auth) |
| Buckets don't appear after creation | Page not refreshing list | ✅ FIXED: Proper state updates in React |
| Vite dev server vulnerability (Windows) | server.fs.deny bypass via backslash | ✅ FIXED: Updated Vite to 7.1.11 (CVE-2025-30208) |

---

## 📊 Request Flow Diagram

```
Browser
   ↓
Cloudflare Access (intercepts unauthenticated requests)
   ├→ GitHub login flow (first time only)
   ├→ JWT cookie set: cf-access-jwt-assertion
   ↓
Worker receives request
   ├→ Check if static asset (/site.webmanifest) → serve directly
   ├→ Check if signed download request → validate signature
   ├→ Otherwise: validateAccessJWT() → extract userEmail from token
   ├→ Route to appropriate handler (buckets, files, etc.)
   ↓
R2 API (via Cloudflare API)
   ↓
Response back to browser
```

---

## 📝 Common Code Patterns

### Adding New Endpoint
1. Add to `handleApiRequest()` in `worker/index.ts`
2. All endpoints get JWT validation automatically (runs before routing)
3. Use `userEmail` for user context (not user ID)
4. Return `{ headers: corsHeaders }` for CORS

### JWT Validation
```typescript
const userEmail = await validateAccessJWT(request, env);
if (!userEmail) return new Response('Unauthorized', { status: 401 });
```

### R2 API Call
```typescript
const response = await fetch(
  CF_API + '/accounts/' + env.ACCOUNT_ID + '/r2/buckets',
  {
    headers: {
      'X-Auth-Email': env.CF_EMAIL,
      'X-Auth-Key': env.API_KEY
    }
  }
);
```

---

## 🔒 Security Notes

- JWT validated on every API request (no session tokens needed)
- No user data stored in D1 (except file metadata)
- All file operations authenticated via Cloudflare Access
- Signed URLs for downloads use HMAC-SHA256 (src/services/api.ts)
- Static assets bypass Access to avoid CORS issues, but are public by design

---

## 🚧 Future Work

1. **Enhancement:** Add Cloudflare Web Assets to protect `/api/*` endpoints
2. **Enhancement:** Add feature to copy files between buckets. 
3. **Enhancement:** Detect and match users light/dark mode system setting.
4. **Enhancement:** Configure repository for community standards with license, security policy, etc
5. **Enhancement:** Set up dependabot, codeql, secrets scanning, etc.
6. **Long-term:** Add support for AWS S3 buckets and bidirectional migration between S3 and Cloudflare R2.