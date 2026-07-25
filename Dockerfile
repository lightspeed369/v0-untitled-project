# Next.js standalone build for Railway.
#
# The persistent volume is mounted at /data (DATA_DIR). Because Railway mounts
# volumes owned by root, the entrypoint fixes ownership and then drops to an
# unprivileged user before starting the server.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# --- dependencies ---------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- build ----------------------------------------------------------------
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- runtime --------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data

RUN apk add --no-cache su-exec \
 && addgroup -S -g 1001 nodejs \
 && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Seed data: only read when the volume has no config.json yet (first boot).
COPY --from=builder --chown=nextjs:nodejs /app/data/config.seed.json ./data/config.seed.json
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
