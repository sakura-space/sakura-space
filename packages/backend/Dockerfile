FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace root + backend manifest
COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/

# Install backend dependencies
RUN npm install --workspace=packages/backend

# Copy backend source
COPY packages/backend ./packages/backend

# Generate Prisma client & compile TypeScript
RUN cd packages/backend && \
    npx prisma generate && \
    npx tsc --project tsconfig.json

# ── Runtime image ─────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# node_modules at workspace root (contains @prisma/client, bcryptjs, etc.)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/package.json ./package.json

# Prisma schema needed for db push
COPY packages/backend/prisma ./prisma

# Entrypoint: db push + seed + start
COPY packages/backend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/docker-entrypoint.sh"]
