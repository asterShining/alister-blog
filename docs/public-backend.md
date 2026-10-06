# Public Backend

Pages Functions lives in `functions/` and uses the existing `DB` D1 binding to `alister-public`. `/api/*` and dynamic `/community/*` invoke Functions; `/community/`, `/community/index.html`, and `/community/post/*` are excluded to serve static shells (`public/_routes.json`, copied to `dist/` by Astro). Astro preview serves the frontend; it does not execute Pages Functions.

## API

- `GET /api/v1/health`: executes `SELECT 1`; returns 200 connected or 503 unavailable.
- `GET /api/v1/reactions/:slug`: `{ likes, dislikes, viewerReaction }`.
- `PUT /api/v1/reactions/:slug`: `{ "type": "like" | "dislike" | null }`; returns the updated counts. Repeating the same reaction is idempotent; null removes it.
- `GET /api/v1/views/:slug`: `{ views }` total for the post.
- `POST /api/v1/views/:slug`: records this visitor's view for the current fixed 30-minute wall-clock bucket, then returns `{ views }`.
- `GET /api/v1/comments/:slug`: array of published `{ id, authorName, content, createdAt }`, oldest first.
- `POST /api/v1/comments/:slug`: `{ authorName, content, turnstileToken }`; returns the created comment with HTTP 201. Trimmed Unicode code-point limits: 1–32 and 1–1000. Requires valid Turnstile token verified via Cloudflare siteverify (`functions/_lib/turnstile.ts`). Enforces anonymous visitor rate limiting: minimum 30 seconds interval and maximum 5 comments per 10 minutes per visitor, returning HTTP 429 when exceeded.
- `GET /api/v1/community/posts`: paginated public community posts (`limit` default 20, max 50, `offset`, `visibility = 'public'`).
- `GET /api/v1/community/posts/:slug`: community post detail (`public` and `unlisted`).
- `GET /community/[slug]`: edge dynamic asset proxy to `/community/post/` static shell via `env.ASSETS.fetch()`.

Slugs must match `[a-zA-Z0-9_-]{1,200}`. Unsupported methods return JSON 405, invalid input JSON 400, internal failures generic JSON 500. Responses are not cached. A validated UUID visitor cookie is reused or generated with HttpOnly, Secure, SameSite=Lax, Path=/ and a one-year lifetime. No fingerprinting, IP tracking, or visitor identifiers are returned in comment JSON.

Comments are rendered strictly as plain text (`textContent` / Astro text escaping) and never through `innerHTML`. Anonymous cookies are not authentication. Comments default to `published` status.

## Local validation

```bash
pnpm typecheck:functions
pnpm test:backend
pnpm test:community
pnpm exec astro check
pnpm build
pnpm test:release
pnpm test:e2e:smoke
pnpm test:e2e
```

Backend tests execute the actual handlers and migrations against Node 22's in-memory SQLite through a small D1-method adapter. They use mock fetch for Turnstile siteverify without internet dependency. Pages bundling can be checked without deploying with `pnpm dlx --allow-build esbuild --allow-build workerd wrangler pages functions build --outdir=/tmp/alister-functions-build`.

## Migration and deployment

- `migrations/0001_public_interactions.sql`: creates reactions/comments tables and indexes.
- `migrations/0002_post_views.sql`: creates `post_views` table with unique constraint and index.
- `migrations/0003_comment_rate_limit.sql`: creates `idx_comments_visitor_created` on `comments(visitor_id, created_at)` for rate limiting queries.
- `migrations/0004_community_public.sql`: creates `community_posts` and `community_post_images` for Community read replica.

Migrations 0001–0004 are applied to Production `alister-public`. Do not modify an applied migration; create a new migration for schema changes. Do not apply remote migrations without explicit user authorization, a confirmed target of `alister-public`, and post-apply schema checks.

The dashboard binding remains authoritative; binding `DB` does not create tables. Follow `dev → CI → PR → main` and verify deployed health, interaction, and comment routes. Cloudflare Pages Git Integration deploys Functions; GitHub Actions does not deploy them.

## Phase 2A: article views and Like

The unique key and parameterized `INSERT OR IGNORE` deduplicate concurrent requests within each fixed 30-minute bucket (`floor(Date.now() / 1800000)`). This is a wall-clock bucket, not a rolling 30 minutes after first visit; crossing a bucket boundary can count again. No IP or fingerprint is stored.

The local `molecules/PostMeta` override adds a small article-only interaction bar, using the stable content ID for alias/permalink URLs. Views POST completes before reactions GET so first-visit requests share one HttpOnly cookie.

## Phase 2B: Comments UI, Turnstile, and Rate Limiting

- **Server Turnstile Verification**: `functions/_lib/turnstile.ts` validates tokens with Cloudflare's `siteverify` endpoint without sending client IP addresses (`remoteip`). Enforces `action = comment_submit` and `hostname = alistereno.top` in production while allowing local test origins during development. Secrets (`TURNSTILE_SECRET`) are read exclusively from environment variables and never returned to clients or logged.
- **Anonymous Visitor Rate Limiting**: Queries `comments` table via `idx_comments_visitor_created` to enforce a 30-second cooldown between comments and a 10-minute cap of 5 comments per `alister_visitor_id`. Returns HTTP 429 (`{ "error": "Too many comments" }`) on violation without leaking visitor IDs.
- **Frontend Comments UI**: `src/components/organisms/comment/CommentSection.astro` overrides Shirone's default comment section, presenting comment count, plain-text comment list, first-letter avatar placeholder, and submission form. Styled using Summer Blue Light and Starry Night Dark design tokens with lightweight glass/surface containers.
- **Client Lifecycle & Swup**: `src/scripts/post-comments.ts` manages custom element `alister-post-comments`. The Turnstile explicit API script is loaded at most once; widgets are rendered per DOM mount and cleaned up on unmount. Nicknames are optionally remembered in `localStorage` under `alister_comment_author`. Form submissions clear comment content, reset Turnstile tokens, and append new comments immediately.
- **Feature Inactivity**: If an article frontmatter defines `comment: false`, the comments section, comments GET request, and Turnstile script are completely omitted.
- **Performance**: Article page loads add at most 1 × comments GET request. No polling is used.

## Community Production publishing

Community is enabled in Production through plain-text build-time `COMMUNITY_ENABLE=true`. The first real post is `community-start`; delivery is read-only and has no Community interaction writes.

Private `alister-api` Operator CLI creates PostgreSQL drafts and explicitly publishes them. The manual Publisher is the only PostgreSQL → D1 write path; verify dry-run diffs, run with `--confirm-production`, then verify idempotency and the checkpoint. D1 batches are not one cross-batch transaction: a later failure leaves successful earlier batches intact, does not advance the checkpoint, and requires full reconciliation to converge.

No images, media base, R2, or automatic sync schedule are enabled. See `docs/project-status.md` for the dated deployment and acceptance record.
