# ─── Base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# ─── Dependencies ────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
# Install production dependencies
RUN npm ci --omit=dev

# ─── Runtime ────────────────────────────────────────────────────────
FROM base AS runtime
WORKDIR /app

# Run as non-root before copying code
USER node

# Copy production node_modules
COPY --chown=node:node --from=deps /app/node_modules ./node_modules

# Copy app source and manifest
COPY --chown=node:node package.json server.js ./
COPY --chown=node:node database/ ./database/
COPY --chown=node:node middleware/ ./middleware/
COPY --chown=node:node routes/ ./routes/
COPY --chown=node:node public/ ./public/

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
