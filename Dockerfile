# --- Flash Cup workers (cron jobs) --------------------------------------
# Build context must include the checked-out `vendor/flashleague` submodule
# (CI: actions/checkout with submodules: recursive).
FROM node:20-slim AS base
WORKDIR /app
# openssl is required by Prisma's query engine on debian-slim
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# --- dependencies + generated Prisma client ---------------------------
FROM base AS deps
COPY package.json package-lock.json ./
# The submodule carries prisma/schema.prisma, which `postinstall`
# (prisma generate) needs, so it must be present before `npm ci`.
COPY vendor ./vendor
RUN npm ci

# --- runtime image --------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# node-cron has no leader-election — run exactly ONE replica of this.
CMD ["node", "src/worker.js"]
