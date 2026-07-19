# Release and compatibility policy

Keyzori follows Semantic Versioning. Stable releases use matching `vMAJOR.MINOR.PATCH` tags and SDK package versions.

## Compatibility

- HTTP routes below `/v1` remain backward compatible throughout a major release. Breaking payload or behavior changes require `/v2` or a new major release.
- The `keyzori` npm package's public exports follow Semantic Versioning. New optional fields and events are minor changes; removals and required configuration changes are major changes.
- `keyzori-server` and `keyzori-admin` are built and released together. Operators should use the CLI from the same container image as the server.
- Database migrations are forward-only and are tested from the previous stable schema. A downgrade that crosses a migration requires restoring the pre-deployment backup.

## Support

The latest stable release receives security and correctness fixes. The previous minor release receives critical migration guidance until the next minor release is published. Pre-release versions may change without backward compatibility.

## Release artifacts

A stable release requires:

1. a reviewed changelog and version;
2. `bun install --frozen-lockfile`, `bun run check`, `bun run build`, `bun run smoke:packages`, and `bun run db:check`;
3. the live PostgreSQL/Redis flow and Docker build in CI;
4. a published npm SDK package and checksummed server/CLI release archive tied to the source tag;
5. a tested backup, migration, health-check, and rollback plan for the target deployment.

## Publishing

The repository publishes `keyzori` to npm and attaches the matching checksummed Linux server/CLI archive to a GitHub Release from `.github/workflows/release.yml`. A granular npm token with publish access must be stored as the repository secret `NPM_TOKEN`.

After the version and changelog are aligned, push the matching tag (for example, `v1.0.0`). The release workflow verifies, builds, integration-tests, and smoke-tests both artifacts before publishing. To repair an existing tag, run the workflow manually and enter that tag. Re-running the same tag is safe when npm already received that version.

Security fixes follow [SECURITY.md](../SECURITY.md). Deprecations are documented in the changelog for at least one minor release before removal when practical.
