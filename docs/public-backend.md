# Public Backend

Pages Functions lives in `functions/` and uses the existing `DB` D1 binding to `alister-public`. Only `/api/*` invokes Functions (`public/_routes.json`, copied to `dist/` by Astro). Astro preview serves the frontend; it does not execute Pages Functions.

## API

- `GET /api/v1/health`: executes `SELECT 1`; returns 200 connected or 503 unavailable.
- `GET /api/v1/reactions/:slug`: `{ likes, dislikes, viewerReaction }`.
- `PUT /api/v1/reactions/:slug`: `{ "type": "like" | "dislike" | null }`; returns the updated counts. Repeating the same reaction is idempotent; null removes it.
- `GET /api/v1/comments/:slug`: array of published `{ id, authorName, content, createdAt }`, oldest first.
- `POST /api/v1/comments/:slug`: `{ authorName, content }`; returns the created comment with HTTP 201. Trimmed Unicode code-point limits: 1–32 and 1–1000.

Slugs must match `[a-zA-Z0-9_-]{1,200}`. Unsupported methods return JSON 405, invalid input JSON 400, internal failures generic JSON 500. Responses are not cached. A validated UUID visitor cookie is reused or generated with HttpOnly, Secure, SameSite=Lax, Path=/ and a one-year lifetime. No fingerprinting or visitor identifiers are returned in comment JSON.

Comments are plain text: any future UI must use text rendering, never `innerHTML`. Anonymous cookies are not authentication or abuse prevention. Phase 1 publishes comments immediately and has no rate limiting, moderation UI or frontend integration.

## Local validation

```bash
pnpm typecheck:functions
pnpm test:backend
pnpm exec astro check
pnpm build
pnpm test:release
pnpm test:e2e:smoke
```

Backend tests execute the actual handlers and migration against Node 22's in-memory SQLite through a small D1-method adapter. They do not contact Cloudflare; they do not prove remote D1 deployment. Pages bundling can be checked without deploying with `pnpm dlx --allow-build esbuild --allow-build workerd wrangler pages functions build --outdir=/tmp/alister-functions-build`.

## Migration and deployment

`migrations/0001_public_interactions.sql` is in Wrangler's default migration directory. No production Wrangler configuration or database ID is invented here. The existing dashboard binding remains authoritative. Do not apply this migration remotely as part of automated validation.

After code review, the owner must apply the SQL to the existing database (through D1 console or a Wrangler migration command with a verified database configuration). Merely binding DB does not create tables. Do not re-run raw CREATE TABLE SQL against tables that already exist. Then follow `dev → CI → PR → main` and verify deployed health and interaction routes. Cloudflare Pages Git Integration deploys Functions; GitHub Actions does not deploy them.

## Phase 2A: article views and Like

`GET /api/v1/views/:slug` returns `{ views }`; `POST` records a view then returns the total. `0002_post_views.sql` adds `post_views` and its slug index. The unique `(post_slug, visitor_id, view_bucket)` key and parameterized `INSERT OR IGNORE` deduplicate concurrent requests within each fixed 30-minute bucket (`floor(Date.now() / 1800000)`). This is a wall-clock bucket, not a rolling 30 minutes after first visit; crossing a bucket boundary can count again. No IP or fingerprint is stored. Remote application of 0002 requires separate authorization.

The local `molecules/PostMeta` override adds a small article-only interaction bar, using the stable content ID for alias/permalink URLs. Flat IDs matching the API slug rule are supported; unsupported nested IDs omit the bar. Views POST completes before reactions GET so first-visit requests share one HttpOnly cookie. There are exactly two initial API requests per article DOM insertion; no list-page requests or polling. Like uses the existing reaction API (`like` / `null`); `dislike` stays API-compatible and appears unselected.

A registered custom element follows DOM insertion/removal through Swup, aborts obsolete requests and removes click handlers on disconnect. Failed requests leave readable articles and retryable Like controls. Comments remain API-only. Browser interaction tests intercept only HTTP transport and run the real handlers against migrated SQLite; local Wrangler/D1 HTTP checks validate the Cloudflare runtime separately.
