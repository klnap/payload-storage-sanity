# Contributing

Bug reports and focused pull requests are welcome. For substantial changes, open an issue first.

## Setup and checks

Use Bun 1.4.5 and Node `^22.23.5 || ^24.22.3 || >=26.13.1`.

```sh
bun install --frozen-lockfile
bun run check
bun run check:release
```

`bun run check` runs formatting, lint, typechecking, Knip, dependency-boundary checks, unit tests, PostgreSQL integration tests, the package build, and distribution checks. `bun run check:release` additionally installs and tests the packed package in every consumer fixture. PostgreSQL integration tests use `PAYLOAD_STORAGE_SANITY_TEST_DATABASE_URL`, or start a disposable container when Docker is available. The consumer matrix requires Docker to test its PostgreSQL fixture. Changes in behavior should include regression tests.

The `happy-dom` and `esbuild` overrides fix security advisories in development dependencies. Both override their parents' version ranges. Remove them when Payload's dependencies use fixed versions.

## Optional local code graph

With Graphify installed locally, run `GRAPHIFY_BACKEND=none graphify extract . --code-only` and `graphify hook install`. Check the effective Git hooks path first; do not modify shared hooks. The installer also adds a Graphify merge driver and a `.gitattributes` entry; remove only those entries it introduced, because `graphify-out/` is not tracked.

After the first commit, run `GRAPHIFY_BACKEND=none graphify update .`. If a deletion or rename leaves stale nodes, use `GRAPHIFY_BACKEND=none graphify update . --force`. Hooks skip linked worktrees.

## Releases

Only maintainers publish releases.

Add a Changeset for each consumer-visible change with `bun run changeset`; choose `patch` for compatible changes, `minor` for breaking changes before `1.0.0`, and `major` for breaking changes from `1.0.0` onward. Merging a Changesets release PR triggers the release workflow. It builds and verifies one packed artifact, publishes that exact artifact through npm Trusted Publishing, then creates the matching GitHub Release and tag. Do not create release tags manually.

The npm trusted publisher must match this repository, `.github/workflows/release.yml`, the `npm` environment, and allow `npm publish`. Release jobs use npm CLI `12.2.3` and OIDC; do not add an `NPM_TOKEN` or other persistent publication credential.
