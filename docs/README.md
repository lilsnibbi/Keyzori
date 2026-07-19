<div align="center">

# Keyzori Documentation

Set up Keyzori, create licenses, integrate applications, and solve common problems.

[`Quick start`](../README.md#quick-start) · [`API`](api-reference.md) · [`CLI`](cli-reference.md) · [`SDK`](sdk-reference.md) · [`Troubleshooting`](troubleshooting.md)

</div>

## Start here

| Goal | Recommended guide |
| --- | --- |
| Understand what Keyzori does | [How Keyzori works](product-flow.md) |
| Choose a license type | [Licensing models](licensing-model.md) |
| Start a server | [Deploying Keyzori](deployment.md) |
| Configure the server | [Configuration reference](configuration.md) |
| Create and revoke licenses | [Admin CLI reference](cli-reference.md) |
| Add licensing to an application | [SDK reference](sdk-reference.md) |
| Call Keyzori without the SDK | [HTTP API reference](api-reference.md) |
| Fix a problem | [Troubleshooting](troubleshooting.md) |

## Build a complete Keyzori flow

1. [Deploy Keyzori](deployment.md) with PostgreSQL and Redis.
2. [Configure](configuration.md) the server and administrator credential.
3. Use the [admin CLI](cli-reference.md) to create an owner and license key.
4. Add the [Keyzori SDK](sdk-reference.md) to the licensed application.
5. Read [how validation works](handshake-flow.md) to understand sessions, heartbeats, limits, and revocation.
6. Use the [operations guide](operations.md) for backups, upgrades, monitoring, and recovery.

## References

| Reference | Includes |
| --- | --- |
| [HTTP API](api-reference.md) | Authentication, routes, payloads, responses, status codes, and curl examples |
| [Admin CLI](cli-reference.md) | Commands, options, examples, output, and database configuration |
| [TypeScript SDK](sdk-reference.md) | Installation, configuration, methods, events, lifecycle, and example code |
| [Configuration](configuration.md) | Required variables, defaults, proxy settings, limits, and credential rotation |

## Learn how Keyzori works

| Guide | Focus |
| --- | --- |
| [How Keyzori works](product-flow.md) | How the CLI, server, PostgreSQL, Redis, and SDK work together |
| [Licensing models](licensing-model.md) | Perpetual, subscription, usage, trial, device, IP, and concurrency behavior |
| [License validation](handshake-flow.md) | Handshake order, session admission, heartbeats, logout, and rejection |
| [Keyzori architecture](architecture.md) | Component boundaries and data flow for advanced integrations |

## Run Keyzori

| Guide | Focus |
| --- | --- |
| [Deployment](deployment.md) | Docker Compose, standalone containers, binaries, migrations, and probes |
| [Operations](operations.md) | Backups, upgrades, rollback, monitoring, secret rotation, and recovery |
| [Troubleshooting](troubleshooting.md) | Server, CLI, SDK, PostgreSQL, Redis, proxy, and licensing errors |

> [!TIP]
> A running Keyzori server also provides interactive API documentation at `/docs` and its OpenAPI document at `/docs/openapi.json` when `OPENAPI_ENABLED=true`.

For contributing and project policy information, see [CONTRIBUTING.md](../CONTRIBUTING.md), [SECURITY.md](../SECURITY.md), and [SUPPORT.md](../SUPPORT.md).
