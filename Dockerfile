# Venom Services — production container (Next.js + mini-services via instrumentation)
FROM oven/bun:1 AS base
WORKDIR /app

# deps
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx prisma generate && bun run build

# runtime
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/mini-services ./mini-services
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/bcryptjs ./node_modules/bcryptjs
RUN mkdir -p /data/hosting && \
    (cd mini-services/chat-service && echo '{"name":"venom-chat-service","dependencies":{}}' > package.json) || true

EXPOSE 3000
CMD ["bun", "server.js"]
