# Developing Keyzori

```powershell
Copy-Item apps/server/.env.example apps/server/.env
bun run setup
bun run dev
```

PostgreSQL and Redis must match `DATABASE_URL` and `REDIS_URL`.

## Root development commands

```powershell
bun run dev                 # server watch mode
bun run dev:server:binary   # rebuild and run the standalone executable
bun run cli:help            # CLI usage
bun run cli -- list-users   # invoke a CLI command
bun run test:server         # focused server tests
bun run test:cli            # focused CLI tests
bun run test:sdk            # focused SDK tests
bun run test:flow           # cross-app in-memory flow
```

Root commands deliberately execute inside the owning app so Bun loads that app's `.env` file.

## Repository layout

```text
apps/
  server/   HTTP + CLI delivery, clean-architecture layers, migrations, Dockerfile
  sdk/      publishable application integration SDK
docs/       cross-application architecture and operations guides
tests/      cross-application product-flow tests
```

## Schema changes

1. Edit `apps/server/src/db/schema.ts`.
2. Run `bun run db:generate`.
3. Review and commit the generated SQL and snapshot under `apps/server/drizzle/`.
4. Run `bun run db:migrate` against a development database.

Use `db:push` only for disposable local prototyping.

## Verification

```powershell
bun run check
bun run build
bun run docker:build
```

`bun run test` includes a cross-app product-flow test using in-memory adapters. The opt-in test below covers the real PostgreSQL and Redis adapters and is intentionally excluded from the default suite.

With disposable/test PostgreSQL and Redis URLs configured in `apps/server/.env`, run the opt-in live lifecycle test with:

```powershell
$env:LIVE_TEST_ENABLED="true"
bun run test:live
```

It starts the compiled server on an isolated port, exercises CLI administration and SDK session behavior, then removes only its uniquely identified database and Redis records.

`bun run build:server` creates platform-specific `keyzori-server` and `keyzori-admin` executables plus migrations under `apps/server/dist/`. The Docker build compiles Linux executables and copies only those runtime artifacts into the final image.

Keep domain and application code independent of Drizzle, Redis, Elysia, and Commander. External-system implementations belong in infrastructure or delivery code.
