# Local and CI Testing

The test target is Astro's local production preview at `http://127.0.0.1:4321`. Tests never request the public blog domain.

## Run Locally

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium --only-shell
pnpm exec astro check
pnpm typecheck:functions
pnpm test:backend
pnpm test:release
pnpm build
pnpm test:e2e:smoke
pnpm test:e2e:production
pnpm test:e2e
```

The E2E commands start and stop Astro's production preview automatically. Port 4321 must be free. Smoke tests cover public pages and Swup theme persistence. Production tests check the generated sitemap, robots, RSS, Atom, social URL metadata, and text build outputs. The production origin contract is `https://alistereno.top`, configured in `shirones/config/siteConfig.ts`; update the assertion in `tests/e2e/production.spec.ts` if that permanent domain changes. Shirone currently emits `og:url` and `twitter:url`, but no `rel=canonical` link; the test checks a canonical link if one is added later.

## GitHub Actions

The workflow runs `ci-build` then `e2e-smoke` for pushes and pull requests targeting `dev` or `main`. `e2e-production` also runs for a push to `main` or a pull request targeting `main`. Jobs test one shared production build; they do not deploy. These checks have run successfully on GitHub Actions; check the current run for each change rather than relying on an earlier result.

Cloudflare Pages Git Integration handles deployment from `main`; GitHub Actions does not deploy. Local E2E uses Astro's production preview, not the public domain, and does not exercise Pages Functions or D1. Use the separate local Wrangler/Pages workflow described in `docs/public-backend.md` when validating Functions runtime behavior.
