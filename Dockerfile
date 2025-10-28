# =============================================================================
# R2 Bucket Manager - Cloudflare Workers Deployment
# =============================================================================
# Multi-stage build with Google Distroless base for enhanced security
# Distroless runtime image: ~660MB (includes Wrangler + dependencies)
# Security: Eliminates BusyBox CVEs, no shell, no package manager
# =============================================================================

# -----------------
# Stage 1: Builder
# -----------------
FROM node:22-alpine AS builder

WORKDIR /app

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

# Create a minimal wrangler.toml for Docker runtime
# This is a self-contained configuration for the development server
RUN printf 'name = "r2"\nmain = "worker/index.ts"\ncompatibility_date = "2025-01-01"\ncompatibility_flags = ["nodejs_compat"]\nplacement = { mode = "off" }\n\n[assets]\ndirectory = "dist"\nbinding = "ASSETS"\n' > wrangler.toml

# -----------------
# Stage 2: Runtime Dependencies
# -----------------
# Install production dependencies in a separate stage to copy to distroless
FROM node:22-alpine AS deps

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies + wrangler (needed for runtime)
# Note: wrangler is in devDependencies but required to run the dev server
RUN npm ci --omit=dev && \
    npm install wrangler && \
    npm cache clean --force

# -----------------
# Stage 3: Distroless Runtime
# -----------------
FROM gcr.io/distroless/nodejs22-debian12 AS runtime

WORKDIR /app

# Copy production dependencies + wrangler from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy package files for runtime
COPY --from=builder /app/package*.json ./

# Copy built application and config from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/worker ./worker
COPY --from=builder /app/wrangler.toml ./wrangler.toml

# Expose Wrangler dev server port
EXPOSE 8787

# Health check using Node.js instead of curl (distroless has no shell/curl)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["worker/health-check.js"]

# Default command: Run Wrangler in development mode
# Distroless runs as non-root user 'nonroot' (UID 65532) by default
# Use wrangler binary directly (npx not available in distroless)
CMD ["node_modules/wrangler/bin/wrangler.js", "dev", "--ip", "0.0.0.0", "--port", "8787"]

