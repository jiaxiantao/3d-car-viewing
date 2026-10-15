FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml ./
COPY scripts/apply-fiber-patch.mjs ./scripts/apply-fiber-patch.mjs
COPY patches ./patches
RUN pnpm install --frozen-lockfile

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /pnpm /pnpm
COPY . .

RUN pnpm build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
