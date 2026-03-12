# ─── Base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# ─── Dependencies ────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
# Install production deps only (better-sqlite3 needs build tools)
RUN apk add --no-cache python3 make g++ \
    && npm ci --omit=dev \
    && apk del python3 make g++

# ─── Runtime ────────────────────────────────────────────────────────
FROM base AS runtime
WORKDIR /app

# Copy production node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy app source
COPY server.js           ./
COPY database/           ./database/
COPY middleware/         ./middleware/
COPY routes/             ./routes/
COPY public/             ./public/

# Create data directory for SQLite volume mount
RUN mkdir -p /data && chown node:node /data

# Run as non-root
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
