# Multi-stage build for the Express server.
# Build stage compiles TypeScript; runtime stage runs as a non-root user.

# ---------- Build ----------
FROM node:20-alpine AS build
WORKDIR /app

# Prisma's schema-engine and query-engine need libssl at both generate-time
# (here) and at runtime. Without these packages, Prisma falls back to a
# libssl-1.1 binary that doesn't exist on Alpine 3.21 and crashes at startup.
RUN apk add --no-cache openssl ca-certificates

# Workspace package manifests first (better layer caching)
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install all workspace deps in a single pass (server + shared; client is
# touched too because npm workspaces resolves from the lockfile in one go)
RUN npm ci --no-audit --no-fund

# Source
COPY packages/shared ./packages/shared
COPY server ./server

# Generate Prisma client + compile TypeScript
RUN npx --workspace=server prisma generate
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=server

# ---------- Runtime ----------
FROM node:20-alpine
WORKDIR /app

# dumb-init makes SIGTERM from `docker compose down` reach Node cleanly
# so the graceful shutdown handler in src/index.ts actually runs.
# openssl + ca-certificates are required by the Prisma engine at runtime.
RUN apk add --no-cache dumb-init openssl ca-certificates

# Run as non-root user (defence in depth — OWASP A05)
RUN addgroup -S app && adduser -S app -G app

# Copy artefacts. We keep node_modules from build stage because we need
# the Prisma CLI at startup to apply the schema.
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/packages/shared ./packages/shared
COPY --from=build --chown=app:app /app/server ./server

USER app
WORKDIR /app/server

EXPOSE 3001

# At startup: apply schema (idempotent), then start the server.
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/server/src/index.js"]
