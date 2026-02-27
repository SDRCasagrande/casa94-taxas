# --- Stage 1: Dependencies ---
FROM node:20-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# --- Stage 2: Build ---
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js (standalone)
RUN npm run build

# --- Stage 3: Production ---
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl su-exec
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma for runtime (db push, seed)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=builder /app/package.json ./package.json

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Entrypoint: always sync schema + seed, then start
COPY <<'EOF' /app/entrypoint.sh
#!/bin/sh
set -e

# Fix data directory permissions
chown -R nextjs:nodejs /app/data

# Run Prisma via node directly (npx not available in standalone)
PRISMA="node /app/node_modules/prisma/build/index.js"

# Always push schema (creates tables if missing, safe to run multiple times)
echo "==> Syncing database schema..."
su-exec nextjs:nodejs $PRISMA db push --skip-generate --accept-data-loss 2>&1 || echo "Schema sync warning (non-fatal)"

# Always run seed (uses upsert, safe to run multiple times)
echo "==> Ensuring seed data..."
su-exec nextjs:nodejs node /app/prisma/seed.js 2>&1 || echo "Seed warning (non-fatal)"

echo "==> Starting server..."
exec su-exec nextjs:nodejs node server.js
EOF
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000

CMD ["/app/entrypoint.sh"]
