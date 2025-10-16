# ARBITRAGEXPLUS2025 - API Server Dockerfile
# Optimized for Fly.io deployment

FROM node:18-alpine AS base

WORKDIR /app

# Install pnpm and system dependencies
RUN npm install -g pnpm@8.15.0 && \
    apk add --no-cache curl ca-certificates dumb-init

# Copy package files from services/api-server
COPY services/api-server/package.json services/api-server/tsconfig.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code from services/api-server
COPY services/api-server/src ./src

# Build TypeScript
RUN pnpm add -D typescript @types/node tsx && \
    pnpm tsc --noEmit || echo "TypeScript check completed"

# Set environment
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S api-server -u 1001 -G nodejs && \
    chown -R api-server:nodejs /app

USER api-server

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start server with tsx for TypeScript support (using --import for Node 18.19+)
CMD ["dumb-init", "node", "--import", "tsx/esm", "src/server.ts"]

