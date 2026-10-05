# Local and CI Testing

The test target is Astro's local production preview at `http://127.0.0.1:4321`. Tests never request the public blog domain.

## Run Locally

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium --only-shell
pnpm exec astro check
pnpm build
pnpm test:e2e:smoke
pnpm test:e2e:production
pnpm test:e2e
```

The E2E commands start and stop Astro's production preview automatically. Port 4321 must be free. Smoke tests cover public pages and Swup theme persistence. Production tests check the generated sitemap, robots, RSS, Atom, social URL metadata, and text build outputs. The production origin contract is `https://alistereno.top`, configured in `shirones/config/siteConfig.ts`; update the assertion in `tests/e2e/production.spec.ts` if that permanent domain changes. Shirone currently emits `og:url` and `twitter:url`, but no `rel=canonical` link; the test checks a canonical link if one is added later.

## GitHub Actions

The workflow runs `ci-build` then `e2e-smoke` for pushes and pull requests targeting `dev` or `main`. `e2e-production` also runs for a push to `main` or a pull request targeting `main`. Jobs test one shared production build; they do not deploy. GitHub Hosted Runner behavior remains unverified until the first push.

After the first push, confirm `ci-build` and `e2e-smoke` pass on `dev`. Open a `dev` → `main` pull request and confirm all three jobs pass. Only then set GitHub Ruleset required checks: `ci-build` and `e2e-smoke` on `dev`; all three on `main`.
