# Contributing

Bug reports and focused pull requests are welcome. For substantial changes, open an issue first.

## Setup and checks

Use Bun 1.4.4 and Node `^24.22.3 || >=26.13.1`.

```sh
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun test src tests
bun run test:int
bun run build
bun run check:release
```

Integration tests use `PAYLOAD_STORAGE_SANITY_TEST_DATABASE_URL`, or start a disposable PostgreSQL container when Docker is available. Run `bun run check:release-matrix` manually for all consumers; set `PSS_POSTGRES_CONSUMER_DATABASE_URL` to include PostgreSQL. Changes in behavior should include regression tests.

The `happy-dom` and `esbuild` overrides fix security advisories in development dependencies. Both override their parents' version ranges. Remove them when Payload's dependencies use fixed versions.

## Optional local code graph

With Graphify installed locally, run `GRAPHIFY_BACKEND=none graphify extract . --code-only` and `graphify hook install`. Check the effective Git hooks path first; do not modify shared hooks. The installer also adds a Graphify merge driver and a `.gitattributes` entry; remove only those entries it introduced, because `graphify-out/` is not tracked.

After the first commit, run `GRAPHIFY_BACKEND=none graphify update .`. If a deletion or rename leaves stale nodes, use `GRAPHIFY_BACKEND=none graphify update . --force`. Hooks skip linked worktrees.

## Releases

Only maintainers publish releases.

Releases use a version tag matching `package.json`, such as `v0.1.0`. The GitHub Actions release workflow validates the package and its packed artifact before publishing through npm trusted publishing. The npm trusted publisher must allow `npm publish` and match the `release.yml` workflow and `npm` environment.

For a new npm package, publish a temporary `0.0.0-stage` version with the `stage` dist-tag before configuring trusted publishing. It is a bootstrap version, not npm's separate staged-publishing approval flow. Do not publish it with the `latest` tag.
