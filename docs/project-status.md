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
- D1 migrations `0001_public_interactions.sql`, `0002_post_views.sql`, `0003_comment_rate_limit.sql`, and `0004_community_public.sql` (all applied to production `alister-public`).
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
- Community Frontend Foundation (Phase 1):
  - Independent content model for short posts, status updates, and multi-image posts at `/community/` and `/community/[slug]/`, separate from the `/posts/` markdown collection.
  - Feature flag `shirones/config/communityConfig.ts` with `enable: false` by default.
  - Feature isolation: when disabled, automatically pruned from the navigation bar, route accesses redirect to `/404/`, and zero community network requests are fired.
  - Safe Markdown renderer (`src/lib/community/markdown.ts`) with HTML entity escaping and URL protocol sanitization.
  - Responsive image grid (`CommunityImageGrid.astro`) supporting 0, 1, 2, 3, 4, and >4 image layouts on mobile (390px) and desktop (1440px).
  - Theme integration aligned with Summer Blue and Starry Night tokens, friendly empty state (`CommunityEmptyState.astro`), feed card (`CommunityPostCard.astro`), and detail view (`CommunityPostView.astro`).
- Community Public Delivery Foundation (Phase 2):
  - D1 migration `migrations/0004_community_public.sql` (`community_posts`, `community_post_images`) applied to Production and schema verified.
  - Public Edge APIs: `GET /api/v1/community/posts` (pagination, visibility=public filter, published_at DESC, total count, image grouping) and `GET /api/v1/community/posts/:slug` (supports public & unlisted, sanitized 404/500).
  - Cloudflare dynamic route shell `functions/community/[slug].ts` dispatching to `/community/post/` pre-rendered shell via `env.ASSETS.fetch()`, maintaining static CDN performance without full-site SSR.
  - Client-side runtime fetch with Svelte 5 (`CommunityFeedApp.svelte`, `CommunityDetailApp.svelte`).
  - Strict DTO alignment (`src/lib/community/types.ts`) with required `title`, `contentFormat`, `images`, and fixed author identity.
  - Production adapter `ApiCommunityAdapter` (`src/lib/community/adapter.ts`) querying `/api/v1/community/posts`; `MockCommunityAdapter` restricted to local dev/test fixtures.
  - `public/_routes.json` configured for `/community/*` Functions handling while preserving static caching for `/community/` and `/community/post/`.
  - Comprehensive verification: unit tests (`tests/community.test.mjs`), D1 backend tests (`tests/community-backend.test.mjs`), Playwright E2E coverage (`tests/e2e/community.spec.mjs`), and smoke tests.

## Community First Real Post Production & Frontend Enablement — PASS (2026-10-07)

- Community backend Production: **PASS**; first post: `community-start` — “社区，也从这里开始”.
- Community frontend Production: **ENABLED** (verified on live origin and canonical deployment `a8f940b0-8c6b-4073-a95d-eeb98e58e609`).
- Authoritative: JD PostgreSQL; Public Replica: Cloudflare D1 `alister-public`.
- Publishing: **manual private Operator CLI + manual Publisher sync**. Create is draft-first; Production writes require `--confirm-production`. There is no automatic scheduler.
- API PR [#3](https://github.com/asterShining/alister-api/pull/3), operator commit `5542c18488118ed2fe783b5eae2655924dc1821a`; API main/JD deployed HEAD `4a6f48e6a8ee7b2feee48db3c208a471805be914`.
- Blog delivery PR [#11](https://github.com/asterShining/alister-blog/pull/11), Production main `7f68d17a72d4597fca4fc0127356cc7e32ccca58`.
- Canonical deployment `a8f940b0-8c6b-4073-a95d-eeb98e58e609` (rebuilt from main `7f68d17`) deployed with `COMMUNITY_ENABLE=true` (plain text build variable); build and deploy success.
- Production Empty Pipeline completed previously. This phase verified draft isolation, 1-insert dry-run/live sync, second dry-run 0 diff, and one valid advanced checkpoint.
- PostgreSQL Community posts: 0 → 1, published/public/Markdown. D1 Community posts: 0 → 1; images: 0 → 0. No extra Community content was created.
- Public API feed total=1, detail correct, missing detail 404; no internal field leakage.
- Production UI verified from public internet via Chromium:
  - Homepage desktop navbar and mobile drawer both display “社区” entry.
  - `/community/` returns 200, renders feed card with first post “社区，也从这里开始”.
  - `/community/community-start/` returns 200, renders detail view with full content.
- Article Views/Like, Comments GET/UI, Turnstile widget, Friends, About, and theme persistence verified.
- Images/R2/media base, Community Likes/Comments, multi-user posting, Admin UI, and automatic cron sync remain **not enabled**. Further capabilities require a separately defined and authorized phase.

## Trajectory + Article UX Production Release — PASS (2026-10-07)

- Naming: user-visible Community → **轨迹**; internal naming preserved (`communityConfig`, `/community/*`, `Community*` components). Route stays `/community/` (no URL migration).
- Top navigation (frozen order): `首页 · 文章 · 轨迹 · 标签 · 归档 · 友链 · 关于`, with 轨迹 immediately after 文章. `i18nConfig` now maps `archive` → 归档, and `/posts/` provides the 文章 entry; the previous `追番` (`/anime/`) top-nav entry is no longer listed (the `/anime/` page itself is unchanged).
- Homepage: `ContentTypeFilter` (`全部 | 文章 | 轨迹`, default 全部) inside `src/components/organisms/ContentTypeFilter.astro`; the 全部 feed merges articles and trajectories by publish time.
- `/posts/`: article visual card feed by default plus an `文章 | 检索` view switcher (URL `?tab=search`, unchanged design). Fixed the Swup defect where the switcher was dead after in-site navigation (the page-level `is:inline` script lived outside the Swup container and never executed on client-side visits).
- `/archive/`: CategoryBar (首页 / 归档 + article category chips) kept, restyled as a frosted-glass auxiliary bar driven by `--theme-aux-*` tokens (Starry and Summer). Note: the theme's chip classes are scoped to the theme's own chip component, so this bar now styles its own items with shared `.m3-state-layer` feedback.
- Page-level chrome unified into one Swup sync entry (`src/scripts/page-scoped-chrome.ts`) plus the `/posts/` view state module (`src/scripts/posts-view-switcher.ts`); view state has a single source (URL) and a single DOM writer.
- Release: feature PR [#12](https://github.com/asterShining/alister-blog/pull/12) → `dev`, Production PR [#13](https://github.com/asterShining/alister-blog/pull/13) → `main`. Production `main` `83e5cbea2f161c78de8ceebe43b089f4120a0a31`; canonical deployment `091924d5-5fc6-496d-b370-2cf274521988` built with `COMMUNITY_ENABLE=true`.
- Production acceptance (public internet, Chromium, real clicks): navigation order and 轨迹 entry; homepage 全部/文章/轨迹 with `community-start` in 全部 and 轨迹 and excluded from 文章; `/posts/` switcher on direct load **and** after in-site (Swup) navigation; search panel By Year / By Category / By Tag; trajectory feed + detail (title, author, date, Markdown, back link); archive glass bar (surface, blur, border, spacing, active, count badge); friends/about isolation; full Swup chain 首页→文章→检索→轨迹→归档→友链→关于→首页 with no full reload; Summer/Starry persistence; 390/768/1440 without horizontal overflow; SiteStats 轨迹 = 1 from the public API.
- Unchanged: Public API contract/feed (total=1, detail 200, missing 404 `POST_NOT_FOUND`, no internal leakage), Views/Like UI, Comments + Turnstile, Health, publishing backend (JD PostgreSQL authoritative, D1 read replica, manual Operator CLI + Publisher sync), no R2/media base.

## Recent Handoff (2026-10-07)

### Last completed

- Community Production Enable Verification: **PASS**.
  - Root cause of previous discrepancy: When PR #11 merged to `main`, the first automated deployment (`745892c0`, 15:33 UTC) built before `COMMUNITY_ENABLE=true` was configured on Pages Production. Rebuild deployment `a7c6546c` (16:14 UTC) had the variable, and subsequent fresh deployment `a8f940b0` (16:45 UTC) verified canonical activation and public accessibility.
  - Local build reproduction confirmed that without `COMMUNITY_ENABLE` the site redirects `/community/` to `/404/` and omits navigation; with `COMMUNITY_ENABLE=true` it builds the complete Community shell and navigation link.
  - Live public internet verification confirmed desktop/mobile navigation, feed rendering, and detail view.
- Community backend & first real post (`community-start`): **PASS**.
- Public APIs (`GET /api/v1/community/posts`, `GET /api/v1/community/posts/:slug`): **PASS**.

### Current state

- Blog Production `main`: `83e5cbea2f161c78de8ceebe43b089f4120a0a31` (active deployment `091924d5-5fc6-496d-b370-2cf274521988`).
- Development `dev`: clean, tracking `origin/dev`.
- Community feature state: **Production ENABLED** (user-visible name 轨迹).

### Next Potential Directions

1. **Community Media & Images Pipeline**: Setup R2 / Cloudflare Images / media CDN, configure `COMMUNITY_MEDIA_BASE_URL`, and support image post delivery.
2. **Community Interactions**: Design and implement Community Reactions (Likes) and Visitor Comments (with Turnstile and rate limiting).
3. **Private Admin UI**: Develop the web-based Fastify + PostgreSQL admin interface for Alister Blog content authoring.
4. **Regular Content**: Author new blog articles and status updates.

## Public Backend

- `GET /api/v1/health`
- `GET` / `PUT /api/v1/reactions/:slug`
- `GET` / `POST /api/v1/views/:slug`
- `GET` / `POST /api/v1/comments/:slug` (POST requires Turnstile token, enforces rate limiting, returns 201)
- `GET /api/v1/community/posts` (Edge read replica query)
- `GET /api/v1/community/posts/:slug` (Edge read replica query for public/unlisted)

Production D1 has migrations 0001–0004 applied. Community backend feed/detail APIs are live and read-only; frontend enable state is **ENABLED**. Article pages make at most one Views `POST`, one reactions `GET`, and one comments `GET` per DOM insertion; list pages do not request interaction or comment data. Community pages perform client-side runtime fetch only when enabled.

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
- Astro `dev` and `astro preview` serve the frontend but do not provide the deployed Pages Functions + D1 runtime. Use local Wrangler/Pages testing for Functions behavior.

## Next Reasonable Directions

- Add personal articles and continue maintaining the existing friend list.
- Build the private Admin/CMS workflow on the separate JD Cloud service for comment moderation.
