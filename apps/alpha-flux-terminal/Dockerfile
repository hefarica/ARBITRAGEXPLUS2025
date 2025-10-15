FROM node:20-alpine AS builder

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm

# Copiar el monorepo completo
COPY . .

# Instalar dependencias y construir el frontend
WORKDIR /app/apps/alpha-flux-terminal
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:20-alpine

WORKDIR /app

# Copiar solo los artefactos de construcción y los archivos necesarios
COPY --from=builder /app/apps/alpha-flux-terminal/.next ./apps/alpha-flux-terminal/.next
COPY --from=builder /app/apps/alpha-flux-terminal/public ./apps/alpha-flux-terminal/public
COPY --from=builder /app/apps/alpha-flux-terminal/package.json ./apps/alpha-flux-terminal/package.json
COPY --from=builder /app/apps/alpha-flux-terminal/node_modules ./apps/alpha-flux-terminal/node_modules

WORKDIR /app/apps/alpha-flux-terminal

EXPOSE 3000

CMD ["pnpm", "start"]

