# CLI reference

`keyzori-admin` is the server runtime's local administration interface. It invokes `AdminService` through the server's PostgreSQL repositories and never uses HTTP or Redis.

## Installation and invocation

Run it inside the deployed server container:

```powershell
docker exec keyzori-license-server keyzori-admin --help
docker exec keyzori-license-server keyzori-admin list-users
```

Run the workspace source from this repository:

```powershell
bun run cli -- --help
bun run cli -- <command>
```

The compiled CLI is bundled with the server artifact and does not require Bun at runtime. Failed commands print a message to standard error, set exit code `1`, and does not print a success result.

## Global options

```text
keyzori-admin <command>
```

| Option | Description |
| --- | --- |
| `-V`, `--version` | Print CLI version. |
| `-h`, `--help` | Print global or command help. |

Commands require the server runtime's `DATABASE_URL`. Inside the container this is inherited automatically.

## `create-user`

Creates a license owner. Emails are trimmed and lowercased; names are trimmed.

```powershell
keyzori-admin create-user --email owner@example.com --name "Example Owner"
```

| Option | Required | Description |
| --- | --- | --- |
| `-e`, `--email <email>` | Yes | Valid email, maximum 254 characters. |
| `-n`, `--name <name>` | Yes | Non-empty name, maximum 200 characters after trimming. |

Success prints the created user as formatted JSON with `id`, `email`, `name`, an empty `customFields` object, and `createdAt`. Customer custom fields can be managed through the dashboard or admin HTTP API; the CLI does not currently accept them.

## `list-users`

Lists owners in newest-first order.

```powershell
keyzori-admin list-users
```

Output is a table containing `ID`, `Email`, and `Name`. An empty result prints an empty table.

## `create-key`

Creates a license for an existing user and prints the only full copy of its secret.

```powershell
keyzori-admin create-key `
  --user-id <USER_ID> `
  --type SUBSCRIPTION `
  --expires-at 2027-01-01T00:00:00Z `
  --limit-hwid 2 `
  --limit-concurrent 1 `
  --custom-fields '{"tier":"pro","features":["export"]}'
```

| Option | Required | Default | Description |
| --- | --- | --- | --- |
| `-u`, `--user-id <id>` | Yes | — | ID returned by `create-user` or `list-users`. |
| `-t`, `--type <type>` | No | `PERPETUAL` | `PERPETUAL`, `SUBSCRIPTION`, or `USAGE`. |
| `--limit-ip <number>` | No | `0` | Maximum distinct source IPs; `0` is unlimited. |
| `--limit-hwid <number>` | No | `0` | Maximum distinct hardware identifiers; `0` is unlimited. |
| `--limit-concurrent <number>` | No | `0` | Maximum active server-issued sessions; `0` is unlimited. |
| `--limit-usage <number>` | No | `0` | New-session balance. Must be positive for `USAGE`. |
| `--trial-duration-min <number>` | No | `0` | Minutes from first successful activation; `0` disables trial expiry. |
| `--custom-fields <json>` | No | `{}` | JSON object returned to the SDK after validation. Arrays and primitives are rejected. |
| `--expires-at <iso-date>` | Conditional | — | Required future timestamp for `SUBSCRIPTION`; forbidden for other types. |

Numeric options accept decimal digits only and must be non-negative integers. Success prints the created record as formatted JSON. Save its `key` immediately: it is hashed at rest and cannot be retrieved in full later.

## `list-keys`

Lists licenses in newest-first order.

```powershell
keyzori-admin list-keys
```

Output columns are `ID`, masked `Key`, `User`, `Type`, and `Revoked`. If there are no licenses, the CLI prints `No API keys found.` Full secrets are never returned by this command.

## `revoke-key`

Marks a license as revoked. The CLI does not expose restoration; the dashboard or `PUT /admin/keys/:id` can set `revoked` back to `false`.

```powershell
keyzori-admin revoke-key --id <KEY_ID>
```

| Option | Required | Description |
| --- | --- | --- |
| `-i`, `--id <id>` | Yes | Internal license ID from create or list output, not the `sk_...` secret. |

Success prints confirmation and the updated record with a masked key. Revocation is idempotent at the data level: revoking an already revoked record leaves it revoked. Active SDKs are rejected on their next heartbeat; their Redis entry expires or is removed during SDK cleanup.

## Common failures

| Message | Meaning |
| --- | --- |
| `DATABASE_URL must be configured` | Run inside the configured server container or set the server database URL. |
| `User not found` | `create-key` received an unknown user ID. |
| `ApiKey not found` | `revoke-key` received an unknown key ID. |
| `Expected a non-negative integer` | A numeric option contains signs, decimals, spaces, or other characters. |
| `Type must be ...` | `--type` is not one of the three uppercase values. |
| `Custom fields must be ...` | `--custom-fields` is invalid JSON or is not an object. |

See [troubleshooting](troubleshooting.md) for connectivity and server failures.
