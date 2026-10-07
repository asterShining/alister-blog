# Performance: Baseline, Method, and Accepted Optimizations

This document records how navigation and load performance are measured, what the
measurements showed, which optimizations were kept, and which were deliberately
rejected. Raw artifacts (JSON + screenshots) are written to `artifacts/perf/`,
which is gitignored.

> **Status: Production Validated.** All six optimizations are deployed and
> verified on the live origin.
>
> - Feature PR [#14](https://github.com/asterShining/alister-blog/pull/14) →
>   `dev` (squash `179cdee`), Production PR
>   [#15](https://github.com/asterShining/alister-blog/pull/15) → `main`
>   (squash `2fbdc31b23e805b3144a848848a5d418bf21f847`).
> - Production `main`: `2fbdc31b23e805b3144a848848a5d418bf21f847`; deployment
>   `b44076e6-dabb-4d56-9e73-398e2c21281e` (Cloudflare Pages Git Integration,
>   branch `main`, `COMMUNITY_ENABLE=true`).
> - Production before/after: navigation **2594–3897 ms → 746 ms**, `content:replace`
>   handlers constant at 10 over 32 navigations, 0 Community API requests per
>   ordinary navigation, 0 console errors. See section 6.2.

## 1. Measurement Tooling

All harnesses live in `scripts/perf/` and run with the repository's existing
`@playwright/test` dependency (no extra packages).

| File | Purpose |
| --- | --- |
| `instrument.mjs` | Injected into every measured page: records real Swup hooks via the `swup:any` event, patches `window.fetch`, and samples FCP/LCP/CLS/long tasks. |
| `bench.mjs` | Modes `cold`, `nav`, `ui`, `stress`. Writes `<label>-<mode>.json` plus a stdout summary. |
| `preview-server.mjs` | Serves `dist/` and mocks the public API with a configurable delay, because `astro preview` has no Pages Functions. |
| `stability.mjs` | Long-session probe: hook-handler counts, API request totals, wall time, heap. |
| `blur-ab.mjs` | Backdrop-filter A/B. |
| `bundle-audit.mjs` | Static `dist/` audit (HTML/JS/CSS/image/font totals, initial-load refs). |
| `screenshots.mjs` | Visual regression captures (2 skins x 390/1440 x 4 routes). |
| `net-baseline.sh` | curl-based CDN/edge baseline (RTT, TTFB, cache + encoding headers). |

### Running the benchmark

```bash
# Build both sides of the A/B. `dist/` is the only tree tsconfig excludes, so do
# NOT copy a second build inside the repo: `tsconfig.json` includes `**/*` and
# `astro check` will try to parse the copied minified JS and run out of memory.
COMMUNITY_ENABLE=1 node ./node_modules/astro/bin/astro.mjs build
node scripts/perf/preview-server.mjs --dir dist --port 4400 --api-delay 350 &

node scripts/perf/bench.mjs cold    --url http://127.0.0.1:4400 --label after --runs 5
node scripts/perf/bench.mjs nav     --url http://127.0.0.1:4400 --label after --rounds 5
node scripts/perf/bench.mjs ui      --url http://127.0.0.1:4400 --label after --rounds 10
node scripts/perf/bench.mjs stress  --url http://127.0.0.1:4400 --label after --loops 50
node scripts/perf/stability.mjs   http://127.0.0.1:4400 24
node scripts/perf/blur-ab.mjs     http://127.0.0.1:4400 5
node scripts/perf/screenshots.mjs http://127.0.0.1:4400 after
node scripts/perf/bundle-audit.mjs dist index.html

# Bandwidth-sensitive work can only be measured under a slow link.
node scripts/perf/bench.mjs cold --url http://127.0.0.1:4400 --label after-thr \
  --runs 4 --viewports 1440x900 --pages /,/posts/ --throttle 150x1600

# Production baseline (read-only).
bash scripts/perf/net-baseline.sh
node scripts/perf/bench.mjs cold --url https://alistereno.top --label baseline-prod --runs 5
```

### Method notes

- **Cold vs warm are never averaged together.** `cold` uses a fresh browser
  context per run (empty HTTP cache); `nav`/`ui`/`stress` reuse one session.
- **Report medians and p75**, with at least 5 runs for cold loads and 5 rounds
  (40 navigations) for the navigation loop.
- **Navigation phases come from real Swup hooks**, read through the catch-all
  `swup:any` DOM event rather than guessed hook names:
  `click -> visit:start -> fetch:request -> page:load -> content:replace ->
  page:view -> visit:end`, plus the first frame after `content:replace` and the
  point at which all finite animations have settled (`visualStable`; infinite
  ambient animations are excluded, otherwise it would never resolve).
- **`visit:end` and `visualStable` are different questions.** `visit:end` is when
  the router considers the visit finished. `visualStable` additionally waits for
  the content entrance animations, which currently run out to ~750 ms because
  staggered `onload-animation` delays replay on every visit.
- **`artifacts/perf/`, never `test-results/`, holds the results.** Playwright owns
  `test-results/` and deletes it at the start of every run, so benchmark output
  stored there is destroyed by the next `playwright test`.

### Local environment caveats

- `astro preview` has no Pages Functions or D1, so `/api/v1/*` 404s there and the
  Community UI falls into its error state. Front-end timing is therefore measured
  against `preview-server.mjs` with a 350 ms API delay, which matches the extra
  cost Production showed for `/api/v1/community/posts` over a static response.
  Real API latency is measured directly against Production, read-only.
- **Network emulation is required to judge byte reductions.** On localhost a
  saved byte costs nothing, so the wallpaper optimization below is invisible
  without `--throttle`.
- `playwright.config.ts` sets `ASTRO_PREVIEW_BACKGROUND=1`, which makes Astro
  background the preview server, so it can outlive a test run. If the process is
  later killed externally, `.astro/preview.json` goes stale and the next
  Playwright run fails with "Another astro preview server is already running".
  Delete that file (never `.astro/dev.json`, which belongs to the dev server).
- `pnpm` cannot run in a restricted sandbox here; call the CLIs directly:
  `node ./node_modules/astro/bin/astro.mjs`, `node ./node_modules/@playwright/test/cli.js`.

## 2. Production Baseline (2026-10-06, `main` `83e5cbe`)

Cold loads, medians of 5 runs per route:

| Route | Viewport | TTFB | FCP | LCP | Load | CLS | Requests | Transfer |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 1440 | 576 ms | 1068 ms | 1732 ms | 2160 ms | 0.048 | 78 | 1.58 MB |
| `/posts/` | 1440 | 562 ms | 968 ms | 1388 ms | 1772 ms | 0.000 | 77 | 1.58 MB |
| `/community/` | 1440 | 550 ms | 1012 ms | 1704 ms | 2057 ms | 0.025 | 77 | 1.42 MB |
| `/archive/` | 1440 | 553 ms | 1044 ms | 1756 ms | 2072 ms | 0.001 | 75 | 1.42 MB |
| `/posts/hello-alister-blog/` | 1440 | 582 ms | 1056 ms | 1688 ms | 2875 ms | 0.002 | 88 | 1.63 MB |
| `/` | 390 | 566 ms | 940 ms | 1416 ms | 1784 ms | **0.105** | 78 | 1.58 MB |
| `/posts/` | 390 | 566 ms | 932 ms | 1384 ms | 1741 ms | 0.022 | 75 | 1.22 MB |
| `/community/` | 390 | 571 ms | 920 ms | 1324 ms | 1730 ms | 0.034 | 74 | 1.06 MB |
| `/archive/` | 390 | 556 ms | 916 ms | 1232 ms | 1707 ms | 0.005 | 73 | 1.06 MB |
| `/posts/hello-alister-blog/` | 390 | 557 ms | 916 ms | 1260 ms | 2548 ms | 0.002 | 85 | 1.27 MB |

Where the bytes go on the homepage (desktop): CSS-initiated requests total
946 KB — the CJK subset font (373 KB), the dark Hero (231 KB), the light
wallpaper (224 KB), the light Hero (125 KB) and the dark wallpaper (104 KB) —
plus 307 KB of `<img>` content and 58 script requests totalling 217 KB.

### Cloudflare / edge conclusion

`alistereno.top` is **at the network floor**, not on an undersized plan:

- Warm-connection TTFB for static HTML: **286 ms**; on the same machine
  `example.com` measures **218 ms** and `github.com` **552 ms** while
  `alistereno.top` measures **552 ms** — i.e. indistinguishable from unrelated
  origins reached over the same path. TLS handshake costs ~280 ms on every host
  tested, including `example.com`.
- API TTFB on a warm connection: `health` 437 ms (vs 218 ms round trip, so
  ~220 ms of Function + D1 work) and `/api/v1/community/posts` roughly 1.0–1.1 s
  cold. Function latency, not static delivery, is the expensive part of the API.
- Compression is on: HTML 155 KB → 31 KB Brotli, JSON Brotli.
- HTML is served `public, max-age=0, must-revalidate` with
  `cf-cache-status: DYNAMIC`, and the API is `no-store` + `DYNAMIC`. Neither is a
  misconfiguration to fix tonight; changing edge caching for the API needs the
  Publisher consistency model analysed first.

**Cloudflare bottleneck: NO.** The measured costs are (a) client-side work in the
site, (b) the physical round trip, and (c) per-request Function/D1 latency.

## 3. Root Cause Ranking

1. **A `content:replace` handler leak made every navigation slower than the last — High.**
   `SiteStats.astro` shipped an inline script that fetched
   `/api/v1/community/posts?limit=1` and registered an `async` handler on Swup's
   `content:replace` hook. Swup's ScriptsPlugin defaults to `head: true, body:
   true`, which makes its scope the whole `document`, so it re-executes **every
   inline `<script>` in the page** on every navigation. Each visit therefore
   re-ran that inline script, which fired another API request *and* registered
   yet another `content:replace` handler. Swup awaits any hook handler that
   returns a thenable, so the requests were awaited sequentially inside the
   navigation.
   Evidence:
   - `content:replace` handlers grew `14 -> 33` over 19 navigations (other hooks
     stayed constant: `page:view` 3, `visit:start` 9, `visit:end` 5, `link:click` 1).
   - Local navigation `perceived` grew `1215 ms -> 14879 ms` over 40 navigations,
     adding ~350 ms (one API call) per navigation.
   - Production navigation blocked window (`page:load -> content:replace`):
     `1712 ms` rising to `8286 ms`, with 2 to 42 API requests per navigation.
   - Falsification: blocking `**/api/v1/community/**` on Production collapsed that
     window from `1712 ms` to `18 ms` and total perceived from `2594 ms` to
     `861 ms` (Posts → Archive: `2557 ms` to `14 ms`, `3462 ms` to `862 ms`).
2. **Bandwidth contention during the critical window — Medium.**
   The inactive skin's wallpaper and Hero are declared on always-rendered
   pseudo-elements and only hidden with `opacity: 0`. Browsers fetch
   `background-image` regardless of opacity, so ~350 KB of never-visible artwork
   competed with the font and scripts. Separately, the theme's banner `<img>`
   ships the light Hero with `fetchpriority="high"` while this theme hides that
   element with `visibility: hidden`, so another 125 KB is downloaded and never
   shown.
3. **Navigation transitions replay on every visit — Medium.**
   Swup awaits the container fade before reporting a visit finished, and the
   content wrapper is re-created on each visit so its first-paint entrance
   animation replays. Measured out-transition 206 ms, in-transition 178 ms.
4. **Initial bundle / script count — Low (not a root cause).**
   Initial-load JS is 45 KB raw across 9 chunks; total JS on disk is 4.8 MB but
   almost all of it is lazy (mermaid, cytoscape, KaTeX). 58 script requests is
   high but each is small and cached after the first load.
5. **`preloadInitialPage` duplicate fetch — Low.**
   `@swup/preload-plugin` defaults `preloadInitialPage: true`, so every page load
   also fetches its own URL into the Swup cache (~31 KB). `@swup/astro` gives no
   way to override it, and it does make returning to the entry page instant.

## 4. Accepted Optimizations

### 4.1 Community read cache, request de-duplication, and a non-blocking handler

- Files: `src/lib/community/read-cache.ts` (new), `src/lib/community/adapter.ts`,
  `src/components/molecules/SiteStats.astro`, `src/components/organisms/PostPage.astro`
- What changed:
  - A memory-only, 60 s TTL read cache with in-flight promise de-duplication.
    Errors are remembered for only 5 s so a failing endpoint is not hammered.
    Nothing is written to `localStorage`/`sessionStorage`, so a full page load
    always starts clean and published content can never be stale for long.
  - `ApiCommunityAdapter.listPosts`/`getPost` read through it, and any list
    response publishes its `total` so a consumer that only needs the count never
    issues its own request.
  - The trajectory total moved from an inline script to a **bundled module**.
    Re-inserting a `<script type="module">` cannot re-evaluate it (ES modules run
    once per document), so it is structurally immune to the handler accumulation
    above. Its `content:replace` handler returns `undefined` on purpose so Swup
    never awaits the read.
  - The homepage trajectory feed reads through the same cache.
- Evidence (local, mock API at 350 ms; raw JSON in `artifacts/perf/`):

  | | before | after |
  | --- | ---: | ---: |
  | API requests per navigation | 10–18 median, 2 → 42 growing | **0** |
  | `page:load -> content:replace` | 3734 ms median | **150 ms** |
  | navigation `visit:end` | 3952 ms median | **306 ms** |
  | navigation `perceived` | 3912–6379 ms median, 6729–9230 ms p75 | **747 ms** (p75 747) |
  | spread over a session | 1216 ms → 9230 ms over 24 navigations | **714 ms → 765 ms over 40** |
  | `content:replace` handlers | 14 → 33 over 19 navigations (diagnostic) | **10 → 10 over 24** |
  | API requests over 24 navigations | +2 per navigation, unbounded | **3 total** |

  The before column is not noise: navigation cost grew monotonically with the
  number of pages visited, by roughly one API call (~350 ms here, ~1 s on
  Production) per navigation.

- Risk: low. Read-only public GETs, memory-only cache, 60 s staleness bound.
  Covered by `tests/e2e/trajectory-ux.spec.mjs` ("SiteStats sidebar displays 轨迹
  and updates count") and `tests/e2e/community.spec.mjs` ("detail view fetches
  exactly once").

### 4.2 Shorter navigation transitions

- File: `src/styles/themes/starry.css`
- Both rules are gated on `html.swup-enabled`, which Swup only adds after the
  initial load finishes, so the first paint keeps the theme's original timing.
  - container fade `200 ms -> 140 ms`
  - content-wrapper entrance `300 ms -> 160 ms` (and `animation-delay` 0)
- Evidence: out-transition `206 -> 146 ms`, in-transition `178 -> 120 ms`
  (a precise 60 ms saving on each, matching the CSS change). Because the
  out-transition runs concurrently with the HTML fetch, its saving only shows
  once the request no longer dominates.
- Risk: low. Durations only; no layout, colour, or reduced-motion behaviour
  changes.

### 4.3 Defer the inactive skin's artwork

- Files: `astro.config.mjs` (adds `theme-art-ready` after `load` + idle),
  `src/styles/themes/starry.css` (suppresses the inactive layer's
  `background-image` until then)
- What changed: the inactive skin's wallpaper and Hero are no longer requested
  during the critical window; they are attached once the page is idle and are
  then in the HTTP cache, so switching theme still cross-fades.
- Evidence (150 ms RTT / 1.6 Mbit, `--throttle 150x1600`, medians of 4):

  | | before | after | delta |
  | --- | ---: | ---: | ---: |
  | `/` critical-path bytes | 2214 KB | 1896 KB | **-318 KB** |
  | `/` FCP | 3892 ms | 3284 ms | **-608 ms** |
  | `/` LCP | 11008 ms | 9820 ms | **-1188 ms** |
  | `/` load | 12337 ms | 10885 ms | **-1452 ms** |
  | `/posts/` LCP | 10880 ms | 9452 ms | **-1428 ms** |

  Total page weight is unchanged on a fast link — the images still load, just
  later — so this is a critical-path optimization, not a byte reduction. That is
  also why the localhost byte totals for "before" are unstable between runs: on a
  fast link the deferred images land inside or outside the sampling window
  depending on timing. The throttled critical-path numbers above are stable to
  the byte across repeated runs.
- Risk: medium-low. If a visitor switched theme before the page went idle they
  would briefly see the themed fallback colour instead of a photo. The class is
  added at the first idle after `load`, long before that is reachable in practice.

## 5. Rejected Experiments

| Experiment | Why rejected |
| --- | --- |
| `display: none` on the theme's hidden banner `<img>` (would save the 125 KB light Hero) | `BannerStage.astro` awaits `img.complete` while swapping carousel layers; images that are never fetched can leave those awaits unresolved and stall the layer loop. Needs an upstream/theme-level fix, not a CSS override. |
| Disabling all `backdrop-filter` | Measured with `blur-ab.mjs` on the fixed build: FCP 104 ms either way, LCP 140 → 136 ms, and an in-page filter switch 25.3 → 22.8 ms — all at or below the two-frame measurement floor. `html.is-animating` already drops blur during navigation, so the glass language was kept. |
| `preloadInitialPage: false` | Not reachable through `@swup/astro`'s options, and the plugin mounts during `new Swup(...)`, before any project script can touch it. It also caches the entry page, which makes returning to it instant. |
| Reducing the CJK font subset (373 KB) | `fontConfig.subsetting.includeI18n` scans all ten language dictionaries. Trimming it risks missing glyphs and changing the site's typography for a few hundred KB. Worth a separate, owner-approved pass. |
| Downscaling `avatar.webp` (640x640 / 25 KB rendered at 40x40) and the 1200x750 article cover (155 KB) | Real oversizing, but small absolute savings (~120 KB) against the risk of touching art direction and the article hero. Listed below instead. |
| Preloading the CJK font | It is the largest single resource, but `preload: false` is deliberate and the font already uses `display: swap`; preloading would move bytes back onto the critical path. |
| Consolidating the 58 script requests | Would require changing the theme's chunking (`viteBuildShared.rollupOptions` lives in the theme package) for a low measured benefit. |

## 6. Cloudflare Pages Preview and Production Validation

### 6.1 Preview

`COMMUNITY_ENABLE` is a **Production-only** build variable and the preview
environment has no usable `DB` binding (`/api/v1/health` 503,
`/api/v1/community/posts` 500). A preview build therefore renders no 轨迹 entry
and redirects `/community/` to `/404/`. That was not worked around: adding
preview-only environment variables is a Cloudflare setting change and outside the
scope of this work. Instead the preview validates everything that does not depend
on the flag, and the Community path is validated on the local enabled preview.

Measured on `https://perf-navigation-runtime.alister-blog.pages.dev`
(community-disabled routes, 5 rounds, `--skip-community`):

| Path | Production baseline (before) | Preview (after) |
| --- | ---: | ---: |
| Home → Posts | 2594 ms | **746 ms** |
| Posts → Archive | 3462 ms | **747 ms** |
| Archive → Home | 3897 ms | **747 ms** |

Phase split on the real edge: network 15–19 ms, out-transition 146 ms, DOM
replace window 149 ms, post-replace JS 0.8 ms, in-transition 118 ms. Community
API requests per navigation were 0, confirming the disabled-flag isolation still
holds, and a 24-navigation session drifted **-73 ms** with 0 console errors.

Production still ran the old build at the time of that preview run. The
API-blocked falsification above (2594 → 861 ms) was the estimate of what
Production would do after the fix, because it removes the API cost without
removing the round trip. Section 6.2 confirms the deployed result: the estimate
was conservative.

### 6.2 Production (deployed)

Measured against the live origin `https://alistereno.top` after the merge, with
the same harnesses and the same method as the baseline (`bench.mjs nav`, 5 rounds
per path, n=5 each; Chromium 1440×900, warm connection).

| Path | Baseline (2026-10-06) | Deployed | Delta |
| --- | ---: | ---: | ---: |
| Home → Posts | 2594 ms | **747 ms** | −1847 ms (−71 %) |
| Posts → Archive | 3462 ms | **747 ms** | −2715 ms (−78 %) |
| Archive → Home | 3897 ms | **746 ms** | −3151 ms (−81 %) |
| Home → Trajectory | — | **747 ms** | — |
| Trajectory → Posts | — | **746 ms** | — |
| Friends → About | — | **746 ms** | — |

Phase split on Production: out-transition 146 ms, DOM-replace window 149 ms,
post-replace JS 0.8–1.0 ms, in-transition 118–130 ms.

**Handler leak — the actual defect — is gone.** `stability.mjs` over 32
navigations on the live origin: `content:replace` handlers **10 → 10** (the
pre-fix build went 14 → 33 over 19 navigations), `page:view` 3 → 3,
`html` scripts 23 → 23, Community API resources 2 → 3 for the whole session, and
**0 console errors**. Wall time drifted **−693 ms** (first five navigations
1043 ms avg → last five 350 ms avg). A second probe over 32 navigations measured
perceived **747.3 ms (first 10) vs 746.7 ms (last 10)**, a drift of −0.6 ms.

**Community API requests.** Audited per navigation (`n=5` per path, request URLs
recorded inside the navigation window):

| Path | API requests | Community requests |
| --- | ---: | ---: |
| Home → Posts | 0 | 0 |
| Posts → Archive | 0 | 0 |
| Archive → Home | 0 | 0 |
| Home → Trajectory | 1 | 1 (`/api/v1/community/posts`) |
| Trajectory → Posts | 0 | 0 |
| Posts → Friends | 0 | 0 |
| Friends → About | 0 | 0 |
| About → Home | 0 | 0 |

Only entering `/community/` issues a request, and that single response also
supplies the sidebar total. Across 32 stress navigations the API requests per
navigation were median 0, p75 0, **max 1** — the pre-fix 2 → 42 growth is gone.
Per *page load* (not navigation) every route issues exactly one
`GET /api/v1/community/posts?limit=1` for the sidebar total, and the homepage
additionally issues `limit=50` for the feed: unchanged from the baseline.

**Cold load.** Absolute numbers moved between the baseline and this run because
this machine's download throughput fell from ~730 KB/s to ~250 KB/s
(control origin `example.com` TTFB 218 ms → 470 ms, load average 3.4), so the
pre-deploy and post-deploy figures are not directly comparable. Two controlled
comparisons were run instead:

1. **Deployed build vs itself** (`artifacts/perf/defer-ab.mjs`), interleaved, with
   the inactive-skin deferral disabled in one arm, under a fixed 150 ms /
   1.6 Mbit link so both arms get identical bandwidth: LCP **7436 → 9064 ms**
   (p75 7796 → 10804), load 8277 → 9687 ms, 255 KB fewer bytes in the window.
   The deferral is a clear win, not a regression.
2. **Shipped vs previous deployment** (`artifacts/perf/origin-ab.mjs`), the live
   pre-optimization build `091924d5` (`83e5cbe`) against the shipped `b44076e6`
   (`2fbdc31`), alternating in the same minute so network drift cancels: LCP
   **5876 → 2786 ms** (p75 8388 → 5076), load **7705 → 4552 ms** (p75 8854 →
   5351), FCP 1682 → 1520 ms, 242 KB fewer bytes in the window. The LCP element
   is the banner Hero of the *active* skin in both arms, which the deferral does
   not touch.

Absolute per-route Production cold numbers recorded during the rollout
(medians of 5, fresh context), 1440×900:

| Route | TTFB | FCP | LCP | Load | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 794 ms | 2180 ms | 5792 ms | 5854 ms | 0.048 |
| `/posts/` | 682 ms | 1680 ms | 6040 ms | 6024 ms | 0.000 |
| `/community/` | 558 ms | 1896 ms | 5568 ms | 5733 ms | 0.025 |
| `/archive/` | 1163 ms | 2384 ms | 4116 ms | 6103 ms | 0.001 |

Mobile 390×844 homepage CLS is **0.106** — unchanged from the 0.105 baseline, so
the known open item neither improved nor regressed (section 7).

**Functional and visual acceptance.** 29/29 checks passed on the live origin with
0 console errors: Home → Posts → 检索 → 文章 with Back/Forward, the 轨迹 entry and
active state, `/community/` feed and the `community-start` detail rendering its
Markdown, the homepage `全部 | 文章 | 轨迹` filter, the `/posts/` switcher, the
`/archive/` frosted-glass bar (`blur(14px) saturate(1.18)`), Summer and Starry
both rendering with both backdrop layers mounted, no horizontal overflow at 390 /
768 / 1440 on `/`, `/posts/`, `/community/` and `/archive/`, and — the risky part
of 4.3 — a theme switch immediately after first load still ends with both skins'
artwork attached, so a deferred layer can never leave a permanently empty
background.

## 7. Open Items (recommended follow-ups)
1. **Mobile CLS 0.105 on the homepage** is above the "good" 0.1 threshold.
   Re-measured on the deployed build: **0.106**, i.e. unchanged — the rollout
   neither fixed nor worsened it. The trajectory cards are inserted
   asynchronously after the feed response, which
   shifts the article list. Reserving space for the first card, or inserting
   below the fold, would fix it — but it changes layout, so it needs owner input.
2. **The hidden banner `<img>`** downloads 125 KB with `fetchpriority="high"` on
   every load and is never visible in this theme. Best fixed in the theme by not
   rendering the banner image layer at all when a CSS-layer Hero is used.
3. **Other inline scripts still re-execute on every navigation** because of
   ScriptsPlugin's document-wide default: `Announcement.astro` re-registers a
   `swup:content:replace` listener, and the pagination component re-registers a
   document click listener. Both are cheap today, but they grow without bound in
   a long session. Either mark them `data-swup-ignore-script` (project-owned ones)
   or scope the plugin's `head`/`body` options.
4. **Article cover / avatar sizes** — see the table above.
5. **Function + D1 latency** (~220 ms over round trip for `SELECT 1`, ~1 s cold
   for the community list) is now the largest remaining server-side cost. Worth a
   separate look at query plans, indexes, and whether the public list endpoint
   should be edge-cacheable.

## 8. Rules for Future Work

- Never register an `async` function directly on a Swup hook that runs inside a
  navigation (`content:replace`, `page:view`, `visit:*`): Swup awaits returned
  thenables and will put your I/O on the critical path. Fire and forget, or
  return `undefined` explicitly.
- Prefer a bundled module over an inline `<script>` for any logic that touches
  Swup hooks or the network. ScriptsPlugin re-executes inline scripts on every
  navigation; module scripts are evaluated once per document.
- Never `opacity: 0` an element that carries an image you do not want fetched.
  Use `display: none`, or attach the image later.
- Measure bytes under a throttled link, and remember that `artifacts/perf/`, not
  `test-results/`, is where benchmark output survives.
