# How Keyzori works

## 1. Administrator provisions a license

1. An operator uses the standalone dashboard, authenticated HTTP API, or `keyzori-admin` inside the server container.
2. The selected delivery adapter invokes `AdminService`, which validates the customer before Drizzle stores it in PostgreSQL.
3. `AdminService` loads the selected customer and validates the license policy and key-type rules.
4. `AdminService` generates the `sk_...` secret.
5. PostgreSQL stores its SHA-256 digest and display prefix.
6. The delivery adapter returns the only full copy for secure delivery to the licensed application. The dashboard can keep it blurred and copyable only in the current tab; a reload loses it.

## 2. Application validates through the SDK

1. `LicenseClient` creates a SHA-256 host identifier.
2. The SDK sends it with the key to `POST /v1/handshake`; the server returns an unguessable session token.
3. Elysia validates the body and passes the actual client IP to `HandshakeService`.
4. PostgreSQL checks the license, whitelists, expiry, usage balance, and registered devices.
5. Redis atomically cleans stale entries, checks concurrency, and stores the server-issued token with a hashed IP/HWID binding and 45-second TTL.
6. PostgreSQL serializes device registration per license and enforces IP/HWID limits.
7. The SDK emits `ready`, returns license-level custom fields, and schedules non-overlapping heartbeats. Customer-level custom fields remain administrative-only.

## 3. Session ends or license changes

- `destroy()` calls `/v1/logout` with the bound HWID, immediately removing the Redis session from the original client context.
- The dashboard, API, or `revoke-key` CLI command marks the key revoked in PostgreSQL.
- The next initialization or heartbeat receives `403`; the SDK emits the relevant fatal event and stops.
- If connectivity fails repeatedly, the SDK emits `network:offline` and stops after `maxRetries`.

Together, these components keep permanent license data in PostgreSQL while Redis handles short-lived sessions and concurrency. Applications receive only the license result and configured custom fields; administrative changes remain on the server side.
