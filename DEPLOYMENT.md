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

The GitHub Actions workflow requires two environment variables to be configured as **Repository Secrets**:

| Secret Name | Description | How to Get |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Personal/service API token with Workers and R2 permissions | See below |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | See below |

### Setting Up Cloudflare API Token

1. **Create a new API token:**
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Choose template "Edit Cloudflare Workers" (recommended) or create custom
   - Required permissions:
     - ✅ Workers Scripts - Edit
     - ✅ Workers Routes - Edit
     - ✅ D1 - Edit
     - ✅ R2 - Edit
   - Set permissions scope to your account
   - Click "Create Token"
   - **Copy the token immediately** (it won't be shown again)

2. **Find your Account ID:**
   - Go to https://dash.cloudflare.com (select your domain)
   - Right sidebar shows "Account ID" or look in domain overview
   - Copy your Account ID (12-32 character hex string)

### Adding Secrets to GitHub

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret:

   **First secret:**
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: (paste your token)
   - Click "Add secret"

   **Second secret:**
   - Name: `CLOUDFLARE_ACCOUNT_ID`
   - Value: (paste your account ID)
   - Click "Add secret"

### Verifying Setup

1. Make a push to `main` branch
2. Go to GitHub repository → **Actions** tab
3. Click the latest workflow run
4. Check if the "Deploy to Cloudflare" step shows:
   - ✅ Dependencies installed
   - ✅ Project built
   - ✅ Deploy successful

### Troubleshooting

**Error: "CLOUDFLARE_API_TOKEN environment variable not set"**
- Secrets were not configured correctly
- Verify they appear in Settings → Secrets and variables
- Ensure secret names match exactly (case-sensitive)

**Error: "assets directory does not exist: /opt/buildhome/repo/dist"**
- The build step failed
- Check the "Build project" step in the workflow for errors
- Verify `npm run build` works locally

**Error: "Unauthorized" or "Invalid token"**
- API token has incorrect permissions
- Regenerate token with proper scopes (Workers Scripts Edit, R2 Edit, D1 Edit)
- Verify account ID is correct

### Manual Deployment (If Needed)

If you need to deploy manually without GitHub Actions:

```bash
npm ci
npm run build
npx wrangler login
npx wrangler deploy
```

### Environment Setup for Local Development

For local testing, create a `.env` file (not committed):

```bash
# .env (add to .gitignore, do not commit)
CLOUDFLARE_API_TOKEN=your_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
```

Then deploy locally:
```bash
npm run build
npx wrangler deploy
```
