# Current Project Status

## Production

- Production site: <https://alistereno.top>
- `main` is Production; `dev` is Development.
- Cloudflare Pages Git Integration deploys `main`.
- Public Pages Functions use D1 database `alister-public`, bound as `DB`.
- Current repository package version: `1.0.0` (`package.json`).

## Completed

- Shared Shirone layout with Summer Blue Light and Starry Night Dark skins.
- Formal Alister content and removal of Shirone demo posts.
- GitHub Actions CI, SemVer release commands, and main-based GitHub Release workflow.
- Public Cloudflare Pages Functions for health, reactions, views, and comments.
- D1 migrations `0001_public_interactions.sql`, `0002_post_views.sql`, and `0003_comment_rate_limit.sql` (0001 and 0002 applied to production; 0003 local-only).
- Article page Views and Like UI; current UI intentionally exposes Like only.
- Article page Comments UI (Phase 2B):
  - Cloudflare Turnstile bot protection with server-side siteverify (`functions/_lib/turnstile.ts`).
  - Anonymous visitor rate limiting (30s interval cooldown, 10-minute 5-comment cap).
  - Clean personal blog UI with first-letter avatar placeholders, light glass / surface container styling.
  - Strict plain-text comment rendering preventing any XSS execution.
  - Swup SPA lifecycle compatibility with single-load Turnstile script and per-mount widget rendering/cleanup.
  - Nickname persistence via `localStorage` (`alister_comment_author`).
  - Optional disabling via `comment: false` post frontmatter.
- Empty Series collection warning compensation while preserving schema validation.
- Friend page populated with two configured links in `shirones/config/data/friends.ts`.

## Public Backend

- `GET /api/v1/health`
- `GET` / `PUT /api/v1/reactions/:slug`
- `GET` / `POST /api/v1/views/:slug`
- `GET` / `POST /api/v1/comments/:slug` (POST requires Turnstile token, enforces rate limiting, returns 201)

Production D1 has migrations 0001 and 0002 applied. Article pages make at most one Views `POST`, one reactions `GET`, and one comments `GET` per DOM insertion; list pages do not request interaction or comment data.

## Database and Visitor Semantics

- D1 database: `alister-public`; Functions binding: `DB`.
- Views deduplicate by post, anonymous visitor, and fixed 30-minute wall-clock bucket. It is not a rolling 30-minute window.
- Reactions retain backend `like`, `dislike`, and removal (`null`) support.
- Comments rate-limited by `alister_visitor_id` (30s cooldown and 5 per 10min).
- Visitor identity uses the anonymous `alister_visitor_id` cookie. It is not authentication; no IP or device fingerprint is used or stored.

## Private Backend

The separate JD Cloud private/Admin backend uses Fastify and PostgreSQL and has a base environment. It is not part of this repository's public visitor API and must not receive public visitor traffic. No secrets or credentials belong in this file.

## Known Issues and Environment Caveats

- `shirones/content/moments/` is empty while Moments is enabled; the empty collection can still produce an Astro warning. The Series warning has a narrow project-level filter; schema/frontmatter errors remain visible.
- Earlier Pages Preview validation found the Preview environment lacked the `DB` D1 binding, while Production binding worked. Cloudflare environment settings are outside this repository; verify the current Preview binding before testing Preview Functions.
- Migration `0003_comment_rate_limit.sql` has NOT been applied to remote production yet. It requires explicit user authorization before running `wrangler d1 migrations apply ... --remote`.
- Production Cloudflare Pages Functions require `TURNSTILE_SECRET` and frontend build requires `PUBLIC_TURNSTILE_SITE_KEY` once real Turnstile credentials are provisioned in Cloudflare dashboard.
- Astro `dev` and `astro preview` serve the frontend but do not provide the deployed Pages Functions + D1 runtime. Use local Wrangler/Pages testing for Functions behavior.

## Next Reasonable Directions

- Apply migration 0003 to remote production D1 upon user authorization.
- Configure production Cloudflare Turnstile credentials in Cloudflare dashboard (`PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET`).
- Add personal articles and continue maintaining the existing friend list.
- Build the private Admin/CMS workflow on the separate JD Cloud service for comment moderation.
