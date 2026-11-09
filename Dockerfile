FROM node:26-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY . .
RUN npm run build \
  && npm exec -w @jobpilot/api -- prisma generate --schema=prisma/schema.postgres.prisma
ENV NODE_ENV=production
ENV PORT=4000
ENV WEB_DIST=/app/apps/web/dist
EXPOSE 4000
WORKDIR /app/apps/api
CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.postgres.prisma && node dist/index.js"]
