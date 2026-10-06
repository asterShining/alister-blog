# Alister Blog Agent Guide

## Project and Architecture

Alister Blog is a pnpm-managed Astro 7 site with Svelte 5 and the `shirones` 0.1.x npm theme package. Production runs on Cloudflare Pages at `https://alistereno.top`. Cloudflare Pages Functions provide public visitor APIs backed by the Cloudflare D1 database `alister-public`, bound as `DB`.

The private Admin/CMS backend is a separate JD Cloud service using Fastify and PostgreSQL. Keep its administrative responsibilities separate from public visitor traffic; do not route public APIs through JD Cloud. Never put secrets or credentials in repository documents.

`shirones/config/` is the blog configuration layer; `shirones/content/` is the Markdown/MDX content layer; `src/` contains Alister Blog styles, components, and extensions; `public/` contains static files (`_routes.json`, assets); `functions/` contains Cloudflare Pages Functions; `migrations/` contains D1 migrations. `node_modules/shirones/` is third-party source and must never be edited or patched.

Prefer changes in this order: configuration, CSS/design tokens, small project extensions, then targeted component/layout overrides. Preserve Shirone's structure and upgrade path; do not fork whole theme files for small changes.

## Branch and Release Workflow

`dev` is development and the default branch for ordinary work. `main` is production. Start by checking `git branch --show-current` and `git status`; preserve existing user changes. Develop and validate on `dev`, then use a `dev` → `main` pull request and squash merge. After the merge, sync `main` back into `dev` with a normal merge and push.

GitHub Actions is CI. Cloudflare Pages Git Integration is CD and deploys `main`; do not add a second Wrangler production deployment or manually override that integration. Production deployment must correspond to the merged `main` commit. Do not change production settings or perform external production operations without explicit authorization.

`package.json`'s `version` is the only Alister Blog version source and follows stable SemVer. Use `pnpm release:patch|minor|major` from a clean, synchronized `dev`. Tags and GitHub Releases are created from the resulting `main` production commit, never from `dev`; they are separate from Cloudflare deployment. Never force-push, hard-reset, rebase published history, delete unknown refs, or overwrite uncommitted work.

## Theme, Content, and Community

Light is Summer Blue and Dark is Starry Night. Both share Shirone's layout, components, routes, and content. Shirone's native `html.dark` class is the only mode authority. Use CSS variables, semantic tokens, and visual layers in `src/styles/themes/`; do not add another theme store or duplicate pages. Shirone's HCT Theme Color and persistence are the source of truth for accent colors. Keep environment surfaces and imagery separate from dynamic `--mc-*` accents.

Hero Banner and Page Background are separate visual layers. Keep the page backdrop mounted through Swup navigation, give `html` and `body` theme-matched fallback colors, and avoid white frames or replaying theme transitions during navigation. Keep SSR content usable and respect reduced-motion preferences.

Markdown/MDX under `shirones/content/posts/` is the article source of truth. Follow `src/content.config.ts`, `docs/content-guidelines.md`, and `docs/post-template.md`; use kebab-case post IDs and put post images under `public/images/posts/<slug>/`. Friends are configured in `shirones/config/data/friends.ts` and `shirones/config/friendsConfig.ts`. Articles support `comment: false` frontmatter to opt out of comments.

### Community System (`/community/`)

Community is an independent short-post dynamic square (status updates, debug logs, notes, multi-image posts) completely decoupled from `/posts/` articles:
- **Authoritative Source**: JD Cloud PostgreSQL (`alister-api`) is the single source of truth for management and writing.
- **Edge Delivery**: Cloudflare D1 (`alister-public`) serves as the read-only replica.
- **Feature Isolation**: Governed by `shirones/config/communityConfig.ts` with `enable: false` by default. When disabled, the navigation item is removed, `/community/*` redirects to `/404/`, and zero network requests are made.
- **Hybrid Delivery Architecture**: Static shells `/community/` and `/community/post/` are served from CDN cache (`public/_routes.json`). Dynamic path `/community/[slug]` is rewritten at the edge by `functions/community/[slug].ts` using `env.ASSETS.fetch()` to `/community/post/` without full-site SSR. Svelte 5 client components (`CommunityFeedApp.svelte`, `CommunityDetailApp.svelte`) fetch D1 public APIs at runtime.

## Public APIs, Privacy, and Migrations

Current Pages Functions endpoints are:

- `GET /api/v1/health`: database connectivity verification (`SELECT 1`).
- `GET` and `PUT /api/v1/reactions/:slug`: Likes and reactions (`like`, `dislike`, `null`).
- `GET` and `POST /api/v1/views/:slug`: Deduplicated views per 30-minute wall-clock bucket (`floor(Date.now() / 1800000)`).
- `GET` and `POST /api/v1/comments/:slug`: Comments list and submission with Turnstile bot verification and visitor rate limiting.
- `GET /api/v1/community/posts`: Paginated public community posts (`limit` default 20, max 50, `offset`, `visibility = 'public'`).
- `GET /api/v1/community/posts/:slug`: Community post detail (`public` and `unlisted`).
- `functions/community/[slug].ts`: Dynamic asset proxy to `/community/post/` static shell.

### Comments UI and Rate Limiting (Phase 2B Live)

- Article pages include Views, Like, and Comments UI (`CommentSection.astro` + `src/scripts/post-comments.ts`).
- **Cloudflare Turnstile**: `POST /api/v1/comments/:slug` requires `cf-turnstile-response` validated server-side against Cloudflare `siteverify` without sending client IP (`remoteip`). Secret (`TURNSTILE_SECRET`) is encrypted on Cloudflare Pages and never logged, returned, or committed.
- **Visitor Rate Limiting**: Enforced via D1 query on `idx_comments_visitor_created`: 30-second interval cooldown and 10-minute cap of 5 comments per anonymous visitor ID. Violations return HTTP 429 with a user-friendly cooldown message.
- **XSS Prevention**: Comment content is rendered strictly as plain text (`textContent` / Astro text escaping) — never use `innerHTML` for user content.
- **Privacy & Anonymity**: The anonymous `alister_visitor_id` UUID cookie is HttpOnly, Secure, SameSite=Lax, and is not authentication. Do not add IP tracking, device fingerprinting, or return visitor IDs to public responses.

### D1 Database and Migrations

- Target database: `alister-public`, bound as `DB`.
- **Applied to Production**:
  - `0001_public_interactions.sql`: `reactions`, `comments`
  - `0002_post_views.sql`: `post_views` (deduplicated by fixed 30-min bucket)
  - `0003_comment_rate_limit.sql`: rate limiting index `idx_comments_visitor_created` on `comments(visitor_id, created_at)`
- **Local Development Only**:
  - `0004_community_public.sql`: `community_posts`, `community_post_images` (Public Read Replica)
- **Migration Rules**:
  - Never edit a migration that has been applied to production. Add a new migration for schema changes.
  - Local migrations are permitted for development tests.
  - Remote migrations are never automatic: only run `wrangler d1 migrations apply ... --remote` after explicit user authorization, verify the target is `alister-public` before applying, then inspect schema and migration metadata.
  - Do not drop production tables, run unscoped deletes, or rewrite production schema directly.

`pnpm dev` runs only Astro's frontend server; it does not run Cloudflare Pages Functions or D1. Use the repository's local Wrangler/Pages workflow for Functions runtime checks.

## Validation and Performance

Available test and validation commands:

- `pnpm exec astro check`: Astro component and TypeScript diagnostics.
- `pnpm typecheck:functions`: Cloudflare Pages Functions TypeScript check (`functions/tsconfig.json`).
- `pnpm test:backend`: Node 22 in-memory SQLite unit tests for health, reactions, views, comments, Turnstile, and rate limits (`tests/backend.test.mjs`).
- `pnpm test:community`: In-memory SQLite tests for Community D1 queries + adapter & markdown rendering tests (`tests/community.test.mjs`, `tests/community-backend.test.mjs`).
- `pnpm test:release`: Release workflow tests.
- `pnpm build`: Astro static production build.
- `pnpm test:e2e:smoke`: Playwright smoke test suite (12 tests) covering main pages, Swup theme persistence, Views, Like, Comments, and Turnstile integration.
- `pnpm exec playwright test tests/e2e/community.spec.mjs`: Community feature toggle isolation, 404 redirects, and fixture tests.

Use appropriately sized WebP assets. Avoid large-area strong `backdrop-filter`, full-screen animated blur/filter, gratuitous `will-change` or `translateZ(0)`, and canvas wallpaper animation. Theme transitions should be short, non-blocking, and reduced-motion aware.

## Git and Completion

Use descriptive Conventional Commits. Keep diffs focused and reviewable; do not add dependencies without need. Finish with changed files and purpose, validation commands and results, current branch and `git status`, known limitations, and the next useful step. For visual work include tested viewports; for performance work report any dev versus preview difference.
