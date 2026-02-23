# =============================================================================
# R2 Bucket Manager - Cloudflare Workers Deployment
# =============================================================================
# Multi-stage build for optimal image size and security
# Production-ready image: ~150MB
# =============================================================================

# -----------------
# Stage 1: Builder
# -----------------
FROM node:24-alpine AS builder

WORKDIR /app

# Upgrade npm to latest version to fix CVE-2024-21538 (cross-spawn vulnerability)
RUN npm install -g npm@latest

# Patch npm's own dependencies to fix CVE-2025-64756 (glob), CVE-2026-23745, CVE-2026-23950, CVE-2026-24842 & CVE-2026-26960 (tar)
# npm bundles vulnerable versions of glob and tar - we replace them with patched versions
# Note: node-gyp/node_modules/glob path may not exist in newer npm versions (handled with conditional)
RUN cd /tmp && \
    npm pack glob@11.1.0 && \
    npm pack tar@7.5.8 && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/glob && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/tar && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/glob 2>/dev/null || true && \
    tar -xzf glob-11.1.0.tgz && \
    cp -r package /usr/local/lib/node_modules/npm/node_modules/glob && \
    if [ -d /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules ]; then \
        cp -r package /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/glob; \
    fi && \
    rm -rf package && \
    tar -xzf tar-7.5.8.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/tar && \
    rm -rf /tmp/*

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build the application
RUN npm run build

# -----------------
# Stage 2: Runtime
# -----------------
FROM node:24-alpine AS runtime

WORKDIR /app

# Upgrade npm to latest version to fix CVE-2024-21538 (cross-spawn vulnerability)
RUN npm install -g npm@latest

# Patch npm's own dependencies to fix CVE-2025-64756 (glob), CVE-2026-23745, CVE-2026-23950, CVE-2026-24842 & CVE-2026-26960 (tar)
# npm bundles vulnerable versions of glob and tar - we replace them with patched versions
# Note: node-gyp/node_modules/glob path may not exist in newer npm versions (handled with conditional)
RUN cd /tmp && \
    npm pack glob@11.1.0 && \
    npm pack tar@7.5.8 && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/glob && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/tar && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/glob 2>/dev/null || true && \
    tar -xzf glob-11.1.0.tgz && \
    cp -r package /usr/local/lib/node_modules/npm/node_modules/glob && \
    if [ -d /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules ]; then \
        cp -r package /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/glob; \
    fi && \
    rm -rf package && \
    tar -xzf tar-7.5.8.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/tar && \
    rm -rf /tmp/*

# Install runtime dependencies only
# Security Notes:
# - Application dependencies: glob@11.1.0, tar@7.5.8 (patched via package.json overrides)
# - npm CLI dependencies: glob@11.1.0, tar@7.5.8 (manually patched in npm's installation)
# - curl 8.17.0-r1 has CVE-2025-14819, CVE-2025-14524, CVE-2025-14017 (MEDIUM)
#   Fix version 8.18.0-r0 not yet available in Alpine repos (upstream availability gap)
# - busybox has CVE-2025-46394 & CVE-2024-58251 (LOW) with no fixes available yet
# These are accepted upstream risks - will upgrade when Alpine publishes patched packages
RUN apk add --no-cache \
    curl \
    ca-certificates

# Create non-root user for security
# Note: Alpine Linux uses GID 1000 for 'users' group, so we use a different GID
RUN addgroup -g 1001 app && \
    adduser -D -u 1001 -G app app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/worker ./worker
COPY --from=builder /app/wrangler.toml.example ./wrangler.toml.example

# Set ownership to non-root user
RUN chown -R app:app /app

# Switch to non-root user
USER app

# Expose Wrangler dev server port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8787/health || exit 1

# Default command: Run Wrangler in development mode
# Override with specific commands for production deployment
CMD ["npx", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "8787"]

