# ARBITRAGEXPLUS2025 - API Server Dockerfile
# Multi-stage build for TypeScript API Server optimizado para producción

# ==================================================================================
# STAGE 1: Base Image with Node.js
# ==================================================================================
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm@8.15.0

# Install system dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    ca-certificates \
    dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S api-server -u 1001 -G nodejs

# ==================================================================================
# STAGE 2: Dependencies Installation
# ==================================================================================
FROM base AS deps

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY scripts/package.json ./scripts/

# Install dependencies
RUN pnpm install --frozen-lockfile --production=false

# ==================================================================================
# STAGE 3: Build Stage
# ==================================================================================
FROM base AS builder

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/scripts/node_modules ./scripts/node_modules

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Remove dev dependencies for production
RUN pnpm install --frozen-lockfile --production=true && \
    pnpm store prune

# ==================================================================================
# STAGE 4: Production Image
# ==================================================================================
FROM node:18-alpine AS production

# Install runtime dependencies only
RUN apk add --no-cache \
    ca-certificates \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S api-server -u 1001 -G nodejs

# Copy built application
COPY --from=builder --chown=api-server:nodejs /app/dist ./dist
COPY --from=builder --chown=api-server:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=api-server:nodejs /app/package.json ./

# Copy configuration files
COPY --from=builder --chown=api-server:nodejs /app/configs ./configs
COPY --from=builder --chown=api-server:nodejs /app/scripts ./scripts

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    LOG_LEVEL=info \
    NODE_OPTIONS="--max-old-space-size=1024 --experimental-json-modules"

# Create necessary directories
RUN mkdir -p /app/logs /app/cache /app/uploads && \
    chown -R api-server:nodejs /app

# Switch to non-root user
USER api-server

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]

# ==================================================================================
# LABELS & METADATA
# ==================================================================================
LABEL maintainer="MANU <manu@arbitragexplus2025.com>"
LABEL description="ARBITRAGEXPLUS2025 API Server - DeFi Arbitrage System"
LABEL version="1.0.0"
LABEL service="api-server"
LABEL component="typescript"

# Build-time arguments
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

LABEL org.label-schema.build-date=$BUILD_DATE \
      org.label-schema.name="ARBITRAGEXPLUS2025 API Server" \
      org.label-schema.description="TypeScript API Server for DeFi Arbitrage System" \
      org.label-schema.url="https://github.com/hefarica/ARBITRAGEXPLUS2025" \
      org.label-schema.vcs-ref=$VCS_REF \
      org.label-schema.vcs-url="https://github.com/hefarica/ARBITRAGEXPLUS2025" \
      org.label-schema.vendor="ARBITRAGEXPLUS2025" \
      org.label-schema.version=$VERSION \
      org.label-schema.schema-version="1.0"

# ==================================================================================
# DEVELOPMENT OVERRIDE (Multi-target)
# ==================================================================================
FROM base AS development

# Install all dependencies (including dev)
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Set development environment
ENV NODE_ENV=development \
    LOG_LEVEL=debug

# Install development tools
RUN pnpm install -g tsx nodemon

# Create development directories
RUN mkdir -p /app/logs /app/cache && \
    chown -R api-server:nodejs /app

USER api-server

EXPOSE 3000 9229

# Development command with debugging and hot reload
CMD ["pnpm", "dev"]

# ==================================================================================
# DOCKER COMPOSE OVERRIDES
# ==================================================================================

# For local development:
# docker build --target development -t arbitragexplus2025-api-server:dev .
# docker run -p 3000:3000 -p 9229:9229 -v $(pwd)/src:/app/src arbitragexplus2025-api-server:dev

# For production:
# docker build --target production -t arbitragexplus2025-api-server:prod .
# docker run -p 3000:3000 arbitragexplus2025-api-server:prod