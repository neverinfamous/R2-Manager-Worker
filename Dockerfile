# =============================================================================
# R2 Bucket Manager - Cloudflare Workers Deployment
# =============================================================================
# Multi-stage build for optimal image size and security
# Production-ready image: ~150MB
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

# -----------------
# Stage 2: Runtime
# -----------------
FROM node:22-alpine AS runtime

WORKDIR /app

# Install runtime dependencies only
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

