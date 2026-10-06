# Alister Blog Agent Guide

## Project and Architecture

Alister Blog is a pnpm-managed Astro 7 site with Svelte 5 and the `shirones` 0.1.x npm theme package. Production runs on Cloudflare Pages at `https://alistereno.top`. Cloudflare Pages Functions provide public visitor APIs backed by the Cloudflare D1 database `alister-public`, bound as `DB`.

The private Admin/CMS backend is a separate JD Cloud service using Fastify and PostgreSQL. Keep its administrative responsibilities separate from public visitor traffic; do not route public APIs through JD Cloud. Never put secrets or credentials in repository documents.

`shirones/config/` is the blog configuration layer; `shirones/content/` is the Markdown/MDX content layer; `src/` contains Alister Blog styles, components, and extensions; `public/` contains static files; `functions/` contains Cloudflare Pages Functions; `migrations/` contains D1 migrations. `node_modules/shirones/` is third-party source and must never be edited or patched.

Prefer changes in this order: configuration, CSS/design tokens, small project extensions, then targeted component/layout overrides. Preserve Shirone's structure and upgrade path; do not fork whole theme files for small changes.

## Branch and Release Workflow

`dev` is development and the default branch for ordinary work. `main` is production. Start by checking `git branch --show-current` and `git status`; preserve existing user changes. Develop and validate on `dev`, then use a `dev` → `main` pull request and squash merge. After the merge, sync `main` back into `dev` with a normal merge and push.

GitHub Actions is CI. Cloudflare Pages Git Integration is CD and deploys `main`; do not add a second Wrangler production deployment or manually override that integration. Production deployment must correspond to the merged `main` commit. Do not change production settings or perform external production operations without explicit authorization.

`package.json`'s `version` is the only Alister Blog version source and follows stable SemVer. Use `pnpm release:patch|minor|major` from a clean, synchronized `dev`. Tags and GitHub Releases are created from the resulting `main` production commit, never from `dev`; they are separate from Cloudflare deployment. Never force-push, hard-reset, rebase published history, delete unknown refs, or overwrite uncommitted work.

## Theme and Content

Light is Summer Blue and Dark is Starry Night. Both share Shirone's layout, components, routes, and content. Shirone's native `html.dark` class is the only mode authority. Use CSS variables, semantic tokens, and visual layers in `src/styles/themes/`; do not add another theme store or duplicate pages. Shirone's HCT Theme Color and persistence are the source of truth for accent colors. Keep environment surfaces and imagery separate from dynamic `--mc-*` accents.

Hero Banner and Page Background are separate visual layers. Keep the page backdrop mounted through Swup navigation, give `html` and `body` theme-matched fallback colors, and avoid white frames or replaying theme transitions during navigation. Keep SSR content usable and respect reduced-motion preferences.

Markdown/MDX under `shirones/content/posts/` is the article source of truth. Follow `src/content.config.ts`, `docs/content-guidelines.md`, and `docs/post-template.md`; use kebab-case post IDs and put post images under `public/images/posts/<slug>/`. Friends are configured in `shirones/config/data/friends.ts` and `shirones/config/friendsConfig.ts`. A future CMS edits these files; do not add a database for content without a specific requirement.

## Public APIs, Privacy, and Migrations

Current Pages Functions endpoints are:

- `GET /api/v1/health`
- `GET` and `PUT /api/v1/reactions/:slug`
- `GET` and `POST /api/v1/views/:slug`
- `GET` and `POST /api/v1/comments/:slug`

Article UI uses Views and Like only. Comments API exists, but Comments UI is not enabled. Do not add Comments UI unless requested. Before exposing comments, plan Turnstile or equivalent abuse controls, rate limiting, and moderation. Render comment content as plain text; never use `innerHTML` for user content.

The anonymous `alister_visitor_id` UUID cookie is HttpOnly, Secure, SameSite=Lax, and is not login or authentication. Do not add IP tracking, User-Agent/device fingerprinting, or return visitor IDs to public responses. Views count at most once per visitor/post/fixed 30-minute wall-clock bucket (`floor(Date.now() / 1800000)`); this is not a rolling 30-minute window. Preserve the existing reaction API's `like`, `dislike`, and `null` compatibility even though the current UI only exposes Like.

Never edit a migration that has been applied to production. Add a new migration for schema changes. Local migrations are permitted for development tests. Remote migrations are never automatic: only run `wrangler d1 migrations apply ... --remote` after explicit user authorization, verify the target is `alister-public` before applying, then inspect schema and migration metadata. Do not drop production tables, run unscoped deletes, or rewrite production schema directly.

`pnpm dev` runs only Astro's frontend server; it does not run Cloudflare Pages Functions or D1. A failing dynamic API under `pnpm dev` does not establish a Production API failure. Use the repository's local Wrangler/Pages workflow for Functions runtime checks. Preview environments may have different D1 bindings from Production; verify the environment binding before attributing Preview API failures to code.

## Validation and Performance

Check `package.json` and `docs/testing.md` for available scripts. For code/build changes run `pnpm exec astro check` and `pnpm build`. Backend changes also require `pnpm typecheck:functions` and `pnpm test:backend`; release tooling changes require `pnpm test:release`. Use `pnpm test:e2e:smoke` for general page checks and interaction or full E2E coverage for UI, API integration, Swup, or navigation changes. CI jobs are `ci-build`, `e2e-smoke`, and `e2e-production`; verify actual GitHub results rather than inferring them from local commands. E2E tests target local production preview and must not depend on public internet availability.

Use appropriately sized WebP assets. Avoid large-area strong `backdrop-filter`, full-screen animated blur/filter, gratuitous `will-change` or `translateZ(0)`, and canvas wallpaper animation. Theme transitions should be short, non-blocking, and reduced-motion aware. Do not infer Production performance from `pnpm dev` alone.

## Git and Completion

Use descriptive Conventional Commits. Keep diffs focused and reviewable; do not add dependencies without need. Finish with changed files and purpose, validation commands and results, current branch and `git status`, known limitations, and the next useful step. For visual work include tested viewports; for performance work report any dev versus preview difference.
