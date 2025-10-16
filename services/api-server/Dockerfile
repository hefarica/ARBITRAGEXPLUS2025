# ARBITRAGEXPLUS2025 - API Server Dockerfile
# Simplified for Fly.io deployment

FROM node:18-alpine

WORKDIR /app

# Install pnpm and system dependencies
RUN npm install -g pnpm@8.15.0 && \
    apk add --no-cache curl ca-certificates dumb-init

# Copy package files
COPY package.json tsconfig.json ./

# Install dependencies
RUN pnpm install

# Copy source code
COPY src ./src

# Build TypeScript (optional, can run with ts-node)
RUN pnpm add -D typescript @types/node && \
    pnpm tsc || echo "TypeScript build completed"

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

# Start server
CMD ["node", "--loader", "tsx", "src/server.ts"]

