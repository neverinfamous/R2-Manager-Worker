# R2 Manager & Worker

Last Updated October 19, 2025 3:08 AM EST

R2 Manager is a Vite-powered React application backed by a Cloudflare Worker that proxies Cloudflare R2 and D1. The web client lets you authenticate, create and delete buckets, upload objects with chunked retries, and download multi-file archives, while the worker mediates all requests, issues signed URLs, and stores session metadata.

---

## Repository layout

```
.
├── src/                 # React SPA (components, hooks, and service clients)
│   ├── components/      # Auth views, layout, and reusable widgets
│   ├── filegrid.tsx     # Bucket object grid with previews and bulk actions
│   └── services/        # API + auth wrappers that talk to the worker
├── worker/              # Cloudflare Worker entry point, handlers, and schema
│   ├── index.ts         # Worker runtime (Durable objects/D1/R2 bindings)
│   └── schema.sql       # D1 schema applied during deploy
├── public/              # Static assets served by Vite
├── wrangler.toml        # Worker deployment configuration
└── delete_r2_bucket_robust.ps1
```

---

## Key capabilities

- Account login with session persistence through the worker.
- Bucket CRUD (create, list, delete) surfaced directly in the UI.
- Drag-and-drop uploads with MIME/type validation, 10 MB chunking, and exponential backoff retries.
- Object browser with previews, multi-select actions, and ZIP download bundling.
- Inline delete actions for individual objects or selected groups.

---

## Requirements

- **Node.js 18+** (the repo uses npm; feel free to swap in pnpm/corepack if desired).
- **Cloudflare account** with R2 and D1 enabled, plus the Wrangler CLI for deploying the worker.

Optional tooling: VS Code + ESLint/TypeScript extensions improve DX but are not required.

---

## Frontend setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure the worker API base URL. By default `src/services/api.ts` points to `https://r2.adamic.tech`. For local development create a `.env` file and supply a value:
   ```bash
   echo "VITE_WORKER_API=http://localhost:8787" >> .env
   ```
   Then update `src/services/api.ts` to read from `import.meta.env.VITE_WORKER_API` if you have not already.
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open the printed URL (defaults to `http://localhost:5173`).

### Available npm scripts

| Script            | Description                                      |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | Launch Vite with hot module replacement.         |
| `npm run build`   | Type-check and create a production bundle in `dist/`. |
| `npm run preview` | Serve the built bundle locally for smoke testing. |
| `npm run lint`    | Run ESLint using the project configuration.      |

---

## Worker deployment

The worker under `worker/index.ts` provides REST endpoints for authentication, bucket management, object CRUD, and signed download URLs. It expects the following bindings (set in `wrangler.toml`):

| Binding  | Type | Purpose |
| -------- | ---- | ------- |
| `R2`     | R2   | Primary R2 bucket used for object storage. |
| `DB`     | D1   | Session/user store (migrations live in `worker/schema.sql`). |
| `ASSETS` | KV/Static (optional) | Serve the SPA from Workers Sites/Pages if desired. |

Required secrets:
- `ACCOUNT_ID`
- `CF_EMAIL`
- `API_KEY`
- `REGISTRATION_CODE`
- `URL_SIGNING_KEY`

### Provisioning steps


Required secrets:
- `ACCOUNT_ID`
- `CF_EMAIL`
- `API_KEY`
- `REGISTRATION_CODE`
- `URL_SIGNING_KEY`

### Provisioning steps

```bash
# Authenticate and set up Cloudflare access
npm install
npx wrangler login

# Create the D1 database and apply migrations
npx wrangler d1 create <database-name>
npx wrangler d1 execute <database-name> --file worker/schema.sql

# Configure secrets
npx wrangler secret put ACCOUNT_ID
npx wrangler secret put CF_EMAIL
npx wrangler secret put API_KEY
npx wrangler secret put REGISTRATION_CODE
npx wrangler secret put URL_SIGNING_KEY

# Deploy the worker (ensure wrangler.toml references your bindings)
npm run build
npx wrangler deploy
```

Adjust `wrangler.toml` with your account ID, routes, and binding names. During development you can run `npx wrangler dev` to proxy requests locally on port 8787.

---

## Development tips

- Upload logic chunks files at 10 MB; align worker limits and R2 settings when changing this value.
- Auth tokens currently live in `sessionStorage`. If you migrate to HTTP-only cookies update `src/services/auth.ts`.
- Client-side ZIP creation uses JSZip, so extremely large bundles may exhaust browser memory.

---

## Desired improvements

1. **Enhancement:** Add the ability to edit R2 bucket names.
2. **Enhancement:** Modify the delete bucket workflow to optionally remove non-empty buckets after a confirmation, following the behavior of `delete_r2_bucket_robust.ps1` while still warning the user.
3. **Enhancement:** Add a feature to move file(s) from one bucket to another.
4. **Enhancement:** Switch login to the Cloudflare Worker SSO integration backed by Cloudflare Zero Trust and GitHub.
5. **Long-term:** Add support for AWS S3 buckets and bidirectional migration between S3 and Cloudflare R2.

---

## Contributing

1. Fork and clone the repository.
2. Create a feature branch and commit your changes.
3. Run `npm run lint` and `npm run build` before opening a pull request.

---

## License

This project is released under the [MIT License](LICENSE).