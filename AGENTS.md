# Package agent policy

Applies to work in this repository. Preserve existing package-specific engineering and security requirements in `CONTRIBUTING.md`, `README.md`, tests, scripts, and configuration.

## Ownership and authorization

The maintainer authorizes agents to complete the package development and release lifecycle without repeated approval for routine steps. This includes task branches, implementation and verification, Conventional Commits, pushes, pull requests, eligible workflow-run approvals, verified merges, Changesets, generated Release PRs, npm Trusted Publishing through GitHub Actions, publication verification, and safe local branch synchronization and cleanup.

The active user request overrides this standing authorization. Respect explicit requests for local-only work, push-only, no merge, no release, or no publication for that task.

## Working model

- Use GitHub Flow: start from current `origin/main`, create a short-lived task branch, and merge through a pull request.
- Keep `main` protected. Use the configured merge strategy and required checks. Never push directly to `main`, force-push, bypass protections, or discard unrelated user work.
- Before changing files, inspect repository guidance, worktree state, existing branches and PRs, and pending Changesets. Reuse the active task branch or PR when continuing work.
- Keep changes within requested scope. Run focused tests and package validation relevant to changed files; do not repeat successful checks without a relevant change.
- Review the complete diff before commit. Use Conventional Commits and stage only task files.

## End-to-end implementation and release

For a completed consumer-visible implementation that warrants a package release:

1. Inspect repository state, callers, implementation, tests, documentation, and pending Changesets.
2. Implement the smallest complete change; preserve unrelated work.
3. Run focused tests and independent review, then relevant package validation.
4. Update documentation and verify it against the actual API and supported configuration.
5. Add an appropriate Changeset based on SemVer and consumer impact.
6. Commit and push the task branch.
7. Create or update the PR; wait for required checks and resolve material findings.
8. Verify the latest head, review threads, mergeability, branch protections, and release conditions before merging.
9. Merge the task PR with the configured strategy.
10. Monitor main-branch CI, CodeQL, and the Changesets workflow.
11. Locate the generated Release PR; review its full diff, version, changelog, and release scope.
12. Approve only relevant, reviewed workflow runs when GitHub requires approval.
13. Wait for all required Release PR checks, then merge it when authorized.
14. Monitor artifact verification and npm Trusted Publishing through the protected GitHub Actions environment.
15. Independently verify the expected version in the npm registry before reporting publication.
16. Verify the npm dist-tag, provenance where supported, Git tag, and GitHub Release.
17. Synchronize local `main` safely and clean up only completed task branches.

Do not stop halfway through an authorized lifecycle solely because another PR or workflow approval is required. Stop when a genuine blocker prevents safe progress.

## Changesets and publication

- Changesets is the only package versioning and release-management mechanism. Never bump `package.json` manually or create release tags manually.
- Never publish from a local machine or add long-lived npm publishing tokens. Publish only through the configured GitHub Actions Trusted Publisher.
- Inspect pending Changesets and generated release contents before publication. Do not create unnecessary releases for infrastructure-only changes.
- Preserve the repository's build-once, verify-the-artifact, publish-that-artifact architecture.
- Use `~/code/packages/npm-package-template` as the source of truth for shared engineering and release infrastructure. Do not modify the template or other repositories unless explicitly asked.
- Report a release as successful only after independently confirming the published version in npm.

## Stop conditions

Stop and report the blocker when any of these prevents safe completion:

- Required permissions or interactive authentication are unavailable.
- A required check fails or a material security issue remains unresolved.
- Unrelated user changes conflict with the task.
- Release contents differ from the requested scope.
- A genuine architectural decision needs maintainer input.
- A platform restriction would require bypassing security controls.

Research, investigation, design discussions, and unfinished implementations do not trigger a release by default.
