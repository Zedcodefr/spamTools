# syntax=docker/dockerfile:1.7
# Image de production de spamTools : l'API Node sert aussi le front compilé.
# Build : docker compose build   (ou docker build -t spamtools .)
ARG NODE_IMAGE=node:26.11.1-slim

# --- Compilation -------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
# Node 26 ne fournit plus corepack : pnpm est installé à la version du projet (package.json).
RUN npm install --global --no-fund --no-audit pnpm@12.6.0
WORKDIR /repo

# Dépendances d'abord : cette couche reste en cache tant que les package.json ne changent pas.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared-kernel/package.json packages/shared-kernel/
COPY packages/database/package.json packages/database/
COPY packages/card-catalog/package.json packages/card-catalog/
COPY packages/deck/package.json packages/deck/
COPY packages/collection/package.json packages/collection/
COPY packages/identity/package.json packages/identity/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec tsc -b && pnpm --filter @spamtools/web build

# Ne garder que l'exécution : dépendances de production, code compilé (sans les tests), front compilé.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --prod --frozen-lockfile --offline \
  && mv apps/web/dist /repo/web \
  && rm -rf apps/web packages/*/src apps/api/src packages/*/tsconfig.json apps/api/tsconfig.json \
  && find . -path ./node_modules -prune -o \( -name '*.test.js' -o -name '*.test.js.map' -o -name '*.test.d.ts' -o -name '*.test.d.ts.map' -o -name '*.tsbuildinfo' \) -print | xargs rm -f \
  && rm -rf packages/*/dist/test-support

# --- Exécution ---------------------------------------------------------------------------------
FROM ${NODE_IMAGE}
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    SPAMTOOLS_DATA_DIR=/data \
    SPAMTOOLS_WEB_DIR=/app/web
WORKDIR /app
COPY --from=build --chown=node:node /repo ./
COPY --chmod=755 deploy/entrypoint.sh /usr/local/bin/spamtools
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
ENTRYPOINT ["spamtools"]
CMD ["serve"]
