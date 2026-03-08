FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/frontend/package.json ./packages/frontend/

RUN npm install --workspace=packages/frontend

COPY packages/frontend ./packages/frontend

# Build (VITE_API_URL="" means same-origin, nginx will proxy)
RUN cd packages/frontend && npm run build

# ── Runtime: nginx ────────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
