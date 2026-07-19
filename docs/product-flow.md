# How Keyzori works

## 1. Administrator provisions a license

1. An operator runs `keyzori-admin` inside the server container.
2. The CLI invokes `AdminService`, which validates the owner before Drizzle stores it in PostgreSQL.
3. The CLI invokes `AdminService` again to create a key for that user.
4. `AdminService` validates the key-type rules and generates the `sk_...` secret.
5. PostgreSQL stores its SHA-256 digest and display prefix.
6. The CLI returns the only full copy for secure delivery to the licensed application.

## 2. Application validates through the SDK

1. `LicenseClient` creates a SHA-256 host identifier.
2. The SDK sends it with the key to `POST /v1/handshake`; the server returns an unguessable session token.
3. Elysia validates the body and passes the actual client IP to `HandshakeService`.
4. PostgreSQL checks the license, whitelists, expiry, usage balance, and registered devices.
5. Redis atomically cleans stale entries, checks concurrency, and stores the server-issued token with a hashed IP/HWID binding and 45-second TTL.
6. PostgreSQL serializes device registration per license and enforces IP/HWID limits.
7. The SDK emits `ready`, returns custom fields, and schedules non-overlapping heartbeats.

## 3. Session ends or license changes

- `destroy()` calls `/v1/logout` with the bound HWID, immediately removing the Redis session from the original client context.
- `revoke-key` marks the key revoked in PostgreSQL.
- The next initialization or heartbeat receives `403`; the SDK emits the relevant fatal event and stops.
- If connectivity fails repeatedly, the SDK emits `network:offline` and stops after `maxRetries`.

Together, these components keep permanent license data in PostgreSQL while Redis handles short-lived sessions and concurrency. Applications receive only the license result and configured custom fields; administrative changes remain on the server side.
