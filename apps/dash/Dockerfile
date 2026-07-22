FROM oven/bun:1.3.14-alpine

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/server/package.json ./apps/server/
COPY apps/sdk/package.json ./apps/sdk/
COPY apps/dash/package.json ./apps/dash/
RUN bun install --frozen-lockfile --production

COPY apps/dash/src ./apps/dash/src

WORKDIR /app/apps/dash

ENV HOST=0.0.0.0
ENV PORT=3100

USER bun
EXPOSE 3100

CMD ["bun", "run", "src/index.ts"]
