# Configuration reference

Keyzori uses Bun's native `.env` loading. Do not add `dotenv`. The HTTP server and CLI are both owned by `apps/server` and use `apps/server/.env` during source development.

## Server variables

| Variable | Required | Default | Accepted values | Purpose |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Yes | — | PostgreSQL URL | Drizzle connection and runtime migrations. |
| `REDIS_URL` | Yes | — | Redis URL | Concurrent-session state and request rate limiting. |
| `ADMIN_API_KEY` | Yes | — | Random secret, at least 32 characters | Primary credential accepted by `/admin/*`. Known placeholder prefixes are rejected. |
| `ADMIN_API_KEYS` | No | Empty | Comma-separated secrets, each at least 32 characters | Additional credentials used during zero-downtime rotation. |
| `HOST` | No | `0.0.0.0` | Bind hostname or address | Network interface used by the HTTP server. |
| `PORT` | No | `3000` | Integer `1`–`65535` | HTTP listen port and compiled health-check target. |
| `TRUST_PROXY_HEADERS` | No | `false` | `true` or `false` | Enables trusted proxy IP headers. Never enable for directly reachable servers. |
| `TRUSTED_PROXY_CIDRS` | When proxy trust is enabled | — | Comma-separated IPv4/IPv6 CIDRs | Immediate proxy networks allowed to supply forwarded client IPs. |
| `OPENAPI_ENABLED` | No | `true` | `true` or `false` | Exposes `/docs` and `/docs/openapi.json` when enabled. |
| `RATE_LIMIT_PER_MINUTE` | No | `60` | Integer `1`–`100000` | Per-client budget for license and admin routes. Health and readiness probes are excluded. |
| `MAX_REQUEST_BODY_BYTES` | No | `65536` | Integer `1024`–`10485760` | Maximum request body accepted by Bun. |
| `DRIZZLE_MIGRATIONS_PATH` | No | Auto-discovered | Directory path | Overrides the committed migration directory. |

The server exits before listening when required values are missing, typed settings are invalid, the admin secret is weak, migrations fail, or Redis cannot connect.

### Proxy IP behavior

With `TRUST_PROXY_HEADERS=false`, Keyzori uses the TCP peer address and ignores forwarded headers. With it enabled, the TCP peer must first match `TRUSTED_PROXY_CIDRS`; only then does `CF-Connecting-IP` take precedence over the first value in `X-Forwarded-For`. Forwarded values must be valid IP addresses or Keyzori falls back to the peer address.

Only enable proxy trust when direct access to Keyzori is blocked and your proxy removes untrusted inbound forwarding headers.

### Admin credential rotation

1. Generate a new random value with at least 32 characters.
2. Set the new value as `ADMIN_API_KEY`.
3. Put the previous value in `ADMIN_API_KEYS` and deploy.
4. Update every CLI or administrative client.
5. Remove the previous value from `ADMIN_API_KEYS` and deploy again.

Every value in `ADMIN_API_KEYS` must meet the same validation rules as the primary key.

## CLI configuration

CLI commands use `DATABASE_URL` from the server runtime. They do not use `SERVER_URL`, Redis, or an admin API credential. Help and version work without database configuration.

## Example server configuration

```dotenv
HOST=0.0.0.0
PORT=3000
DATABASE_URL=postgresql://keyzori:password@postgres.internal:5432/keyzori
REDIS_URL=redis://redis.internal:6379
ADMIN_API_KEY=replace_with_a_generated_secret_of_32_or_more_characters
TRUST_PROXY_HEADERS=false
# TRUSTED_PROXY_CIDRS=10.0.0.0/8
OPENAPI_ENABLED=false
RATE_LIMIT_PER_MINUTE=60
MAX_REQUEST_BODY_BYTES=65536
```

The placeholder shown above is intentionally rejected. Replace it before starting the server.
