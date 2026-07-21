FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS builder
WORKDIR /app

COPY package.json bun.lock tsconfig.json bunfig.toml LICENSE NOTICE ./
COPY apps/server/package.json ./apps/server/
COPY apps/sdk/package.json ./apps/sdk/

RUN bun install --frozen-lockfile --ignore-scripts

COPY apps/server ./apps/server
RUN bun run build:server

FROM gcr.io/distroless/cc-debian12:nonroot@sha256:fccdbb0a547c14e23fcf4ce8ad62ca5d43b4faae8d22cd292f490fef9946c96e AS runtime
LABEL org.opencontainers.image.title="Keyzori License Server" \
	org.opencontainers.image.description="Self-hosted software license management server" \
	org.opencontainers.image.licenses="Apache-2.0"
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV PATH=/app

COPY --from=builder --chown=nonroot:nonroot /app/apps/server/dist/ /app/

EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
	CMD ["/app/keyzori-server", "--healthcheck"]

ENTRYPOINT ["/app/keyzori-server"]
STOPSIGNAL SIGTERM
