# Alister Blog

Alister's personal blog built with Astro, Svelte, and the Shirone theme.

**Production:** [https://alistereno.top](https://alistereno.top)

## Stack

Astro 7 · Svelte 5 · Shirone 0.1.x · pnpm 12

## Local development

```bash
pnpm install --frozen-lockfile
pnpm dev                  # http://localhost:4321
pnpm exec astro check     # validate Astro and TypeScript
pnpm build                # create dist/
pnpm preview              # preview the production build
pnpm test:e2e:smoke       # run the smoke browser tests
pnpm test:e2e             # run the full Playwright suite
```

Production E2E tests run against the local production preview; see
[`docs/testing.md`](docs/testing.md) for details.

## Branches and release

- `dev` is the development branch; `main` is production.
- Develop on `dev`, validate changes, then open a pull request from `dev` to `main`.
- GitHub Actions provides CI. Cloudflare Pages Git Integration handles deployment from `main` to production; development branches use previews.

## Project structure

- `shirones/config/` — site configuration
- `shirones/content/` — Markdown/MDX posts and other content
- `src/` — Alister Blog styles and overrides
- `public/` — static assets
