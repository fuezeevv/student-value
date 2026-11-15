# syntax=docker/dockerfile:1.7
FROM node:24.22.0-bookworm-slim@sha256:91acba91b842bec0bf7ea6f5e09c644c7ccad72c4996ed9616d861d1c7cd60d4 AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 PUPPETEER_SKIP_DOWNLOAD=true
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -r /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

FROM dependencies AS builder
COPY next.config.ts tsconfig.json postcss.config.mjs tailwind.config.ts ./
COPY src ./src
COPY public ./public
COPY scripts/production-build.mjs ./scripts/production-build.mjs
COPY scripts/lib/production-env.mjs ./scripts/lib/production-env.mjs
ENV SV_DEPLOYMENT_TARGET=container NODE_ENV=production APP_ORIGIN=https://studentvalue1984.eu.cc
# The persistent action key is a BuildKit secret, never a Docker ARG or copied env file.
RUN --mount=type=secret,id=action_key,required=true \
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/action_key)" node scripts/production-build.mjs

FROM dependencies AS migration
COPY prisma ./prisma
COPY ops/migrate.mjs ./ops/migrate.mjs
ENTRYPOINT ["node", "ops/migrate.mjs"]

FROM node:24.22.0-bookworm-slim@sha256:91acba91b842bec0bf7ea6f5e09c644c7ccad72c4996ed9616d861d1c7cd60d4 AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -r /var/lib/apt/lists/* \
    && groupadd --gid 10001 studentvalue && useradd --uid 10001 --gid 10001 --no-create-home studentvalue
ENV NODE_ENV=production SV_DEPLOYMENT_TARGET=container NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=10001:10001 /app/.next/standalone ./
COPY --from=builder --chown=10001:10001 /app/.next/static ./.next/static
COPY --from=builder --chown=10001:10001 /app/public ./public
COPY --chown=10001:10001 scripts/container-start.mjs ./scripts/container-start.mjs
COPY --chown=10001:10001 scripts/lib/production-env.mjs ./scripts/lib/production-env.mjs
USER 10001:10001
EXPOSE 3000
CMD ["node", "scripts/container-start.mjs"]
