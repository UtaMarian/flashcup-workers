# --- Flash Cup API ---------------------------------------------------------
FROM node:20-slim AS base
WORKDIR /app
# openssl is required by Prisma's query engine on debian-slim
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# --- dependencies + generated Prisma client -------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate

# --- runtime image -------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 4001
# Apply migrations (retrying until the DB is reachable; a no-op when a restored
# dump already carries the schema), seed (idempotent), then start the API.
CMD ["sh", "-c", "for i in $(seq 1 30); do npx prisma migrate deploy && break || echo \"waiting for database ($i/30)...\"; sleep 2; done; node prisma/seed.js || echo '[backend] seed skipped'; node src/server.js"]
