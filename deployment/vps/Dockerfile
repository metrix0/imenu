# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
ENV NEXT_TELEMETRY_DISABLED=1 PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 xdg-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN mkdir -p /app/.next/cache && chown -R node:node /app
USER node
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --include=dev
COPY --chown=node:node . .
ARG BUILD_PUBLIC_CONFIG_SHA256
RUN --mount=type=secret,id=build_env,required=true,uid=1000 \
    --mount=type=cache,target=/app/.next/cache/turbopack,uid=1000,gid=1000 \
    --mount=type=cache,target=/app/.next/cache/webpack,uid=1000,gid=1000 \
    test -n "$BUILD_PUBLIC_CONFIG_SHA256" && bash -c 'set -a; source /run/secrets/build_env; set +a; npx jest lib/ia-vendas/__tests__ --runInBand && npx tsc --noEmit && npx next build'
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
