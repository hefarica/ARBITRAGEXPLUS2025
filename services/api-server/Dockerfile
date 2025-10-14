FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY services/api-server/package.json services/api-server/pnpm-lock.yaml services/api-server/tsconfig.json services/api-server/src ./services/api-server/
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY services/api-server/package.json services/api-server/pnpm-lock.yaml services/api-server/tsconfig.json services/api-server/src ./services/api-server/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api-server build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
USER node
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/services/api-server/dist ./services/api-server/dist
EXPOSE 3000
CMD ["node", "services/api-server/dist/server.js"]

