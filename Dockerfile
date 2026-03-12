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

# Copy production node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy app source
COPY server.js           ./
COPY database/           ./database/
COPY middleware/         ./middleware/
COPY routes/             ./routes/
COPY public/             ./public/

# Run as non-root
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
