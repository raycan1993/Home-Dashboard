# Multi-stage: Vite build, then nginx serves the static files + proxies /api.

# ---------- Build ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN npm ci --no-audit --no-fund

COPY packages/shared ./packages/shared
COPY client ./client

RUN npm run build --workspace=client

# ---------- Runtime: nginx ----------
FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 80
