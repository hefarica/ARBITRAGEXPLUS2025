# Install dependencies only when needed
FROM node:20-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b46437cd86d4987416702202685750050772714a#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY apps/alpha-flux-terminal/package.json apps/alpha-flux-terminal/pnpm-lock.yaml apps/alpha-flux-terminal/tsconfig.json apps/alpha-flux-terminal/next.config.js apps/alpha-flux-terminal/src ./apps/alpha-flux-terminal/
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./
COPY apps/alpha-flux-terminal/package.json apps/alpha-flux-terminal/pnpm-lock.yaml apps/alpha-flux-terminal/tsconfig.json apps/alpha-flux-terminal/next.config.js apps/alpha-flux-terminal/src ./apps/alpha-flux-terminal/
RUN pnpm --filter alpha-flux-terminal build

# Production image, copy all the files and run next
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/alpha-flux-terminal/.next/standalone ./apps/alpha-flux-terminal/.next/standalone
COPY --from=builder /app/apps/alpha-flux-terminal/.next/static ./apps/alpha-flux-terminal/.next/static
COPY --from=builder /app/apps/alpha-flux-terminal/public ./apps/alpha-flux-terminal/public

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "apps/alpha-flux-terminal/.next/standalone/server.js"]

