# Deployment Guide

## GitHub Actions CI/CD Setup

This repository uses GitHub Actions to automatically build and deploy to Cloudflare Workers.

### Deployment Flow

```
Push to main branch
    ↓
GitHub Actions Workflow Triggered (.github/workflows/deploy.yml)
    ↓
1. Checkout code
2. Setup Node.js 20
3. Install dependencies (npm ci)
4. Build project (npm run build) → generates dist/ folder
5. Deploy to Cloudflare (npx wrangler deploy)
    ↓
✅ Live on production
```

### Required GitHub Secrets

✅ **Already Configured**

The following secrets have been added to this repository:

| Secret Name | Description |
|---|---|
| `CF_API_TOKEN` | Cloudflare API token with Workers and R2 permissions |
| `CF_ACCOUNT_ID` | Cloudflare Account ID |

No setup is required. The deployment workflow will automatically use these secrets.

### Updating Secrets

If you need to update or rotate these secrets in the future:

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click on the secret name to update
4. Paste the new value and save

### Ready to Deploy

Your repository is ready for automated deployment! Simply:

1. Push to the `main` branch
2. GitHub Actions will automatically trigger
3. The project will build and deploy to Cloudflare Workers
4. Monitor progress in the **Actions** tab

### Monitoring Deployments

1. Go to your GitHub repository
2. Click the **Actions** tab
3. Click the latest workflow run
4. Check the status of each step:
   - ✅ Checkout code
   - ✅ Setup Node.js
   - ✅ Install dependencies
   - ✅ Build project
   - ✅ Deploy to Cloudflare

### Troubleshooting

**Deployment fails with "API token error"**
- Check if `CF_API_TOKEN` secret is properly set
- Go to Settings → Secrets and variables → Actions
- Verify the token is still valid in Cloudflare dashboard

**Build fails with "dist directory does not exist"**
- The build step failed
- Check the "Build project" step output for errors
- Verify `npm run build` works locally:
  ```bash
  npm install
  npm run build
  ```

**Deployment completes but changes not visible**
- Check the Cloudflare Workers dashboard at https://dash.cloudflare.com
- Verify the domain routing in wrangler.toml
- Clear browser cache or test in incognito mode

### Manual Deployment (If Needed)

For local testing or manual deployment:

```bash
npm ci
npm run build
npx wrangler deploy
```

### Local Development

For local development with authentication to Cloudflare:

```bash
# Login to Cloudflare
npx wrangler login

# Deploy locally for testing
npm run build
npx wrangler deploy
```