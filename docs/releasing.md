# Releasing Alister Blog

`package.json`'s `version` is the only version source for Alister Blog. It is independent of the `shirones` dependency version and does not publish an npm package (`private` remains enabled).

## Choose a release type

- **Patch** (`pnpm release:patch`): fixes, copy edits, small styling or performance changes.
- **Minor** (`pnpm release:minor`): new pages, components, or user-facing capabilities.
- **Major** (`pnpm release:major`): breaking changes or a major architecture/theme release.

Only stable `MAJOR.MINOR.PATCH` versions are supported. Preview the next version without changing repository or remote state with `pnpm release:patch -- --dry-run` (also `minor` or `major`).

## Release flow

Run a release command from a clean `dev` branch. The script checks GitHub CLI authentication and `origin`, fetches remote branches, verifies that `dev` includes `origin/main` and is not behind `origin/dev`, updates only `package.json`, runs `pnpm exec astro check`, `pnpm build`, and `pnpm test:e2e:smoke`, then commits `chore(release): vX.Y.Z` and pushes `dev`.

The script creates a `dev` → `main` pull request or reuses the existing open one. It requests auto squash-merge when GitHub allows it. If auto-merge is disabled, wait for `ci-build`, `e2e-smoke`, and `e2e-production` to pass, then merge the PR manually. Do not create a tag on `dev`.

After squash merge, the `main` push triggers `.github/workflows/release.yml`. It validates the stable SemVer value, skips an already-tagged version, or creates `vX.Y.Z` at that exact `main` commit and a GitHub Release with generated notes. This tag placement matters because the squash commit on `main` has a different SHA from the release commit on `dev`.

Cloudflare Pages Git Integration independently deploys updates from `main` to [alistereno.top](https://alistereno.top); GitHub Actions does not deploy through Wrangler. After the squash merge, synchronize development history:

```bash
git switch dev
git fetch origin
git merge origin/main
git push origin dev
```

If validation fails, the script stops before commit, push, or PR creation and leaves the updated `package.json` in place for an explicit fix or manual restore. It never stages other files, resets the tree, or rewrites published history.
