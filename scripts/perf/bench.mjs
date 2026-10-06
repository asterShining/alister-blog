/**
 * Performance benchmark harness.
 *
 * Modes:
 *   cold   - fresh browser context per run (empty cache), Core Web Vitals + TTFB
 *   nav    - warm Swup navigation loop with per-phase breakdown
 *   ui     - in-page UI interactions that do not navigate (Posts 文章|检索)
 *   stress - long-session navigation loop for listener/request/heap stability
 *
 * Usage:
 *   node scripts/perf/bench.mjs <mode> [--url ORIGIN] [--label NAME] [options]
 *
 * Options:
 *   --runs N          cold: runs per route per viewport (default 5)
 *   --rounds N        nav/ui: rounds of the path loop (default 10)
 *   --loops N         stress: number of navigations (default 50)
 *   --viewports a,b   cold: WxH pairs (default "1440x900,390x844")
 *   --pages a,b,c     cold: route list override
 *
 * Results are written to test-results/perf/<label>-<mode>.json plus a
 * human-readable .md table.
 */

// `@playwright/test` is the direct dependency in this repo and re-exports the
// browser types, so the harness runs without adding a package.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { initScript, snapshot as snapFn } from "./instrument.mjs";

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const mode = argv[0];
const opt = (name, dflt) => {
	const i = argv.indexOf(`--${name}`);
	return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const ORIGIN = opt("url", "https://alistereno.top").replace(/\/$/, "");
const LABEL = opt("label", "run");
const RUNS = Number(opt("runs", 5));
const ROUNDS = Number(opt("rounds", 10));
const LOOPS = Number(opt("loops", 50));
const VIEWPORTS = opt("viewports", "1440x900,390x844")
	.split(",")
	.map((v) => {
		const [w, h] = v.split("x").map(Number);
		return { width: w, height: h, name: `${w}x${h}` };
	});
const COLD_PAGES = opt(
	"pages",
	"/,/posts/,/community/,/archive/,/posts/hello-alister-blog/",
).split(",");
// Optional network emulation, needed to measure bandwidth-sensitive work: on
// localhost a byte saved is worth nothing. Format "latencyMs x kbps", e.g.
// "--throttle 150x1600" for a 150 ms RTT / 1.6 Mbit link.
const THROTTLE = (() => {
	const raw = opt("throttle", "");
	const m = /^(\d+)x(\d+)$/.exec(raw);
	if (!m) return null;
	return { latency: Number(m[1]), kbps: Number(m[2]) };
})();

async function applyThrottle(context, page) {
	if (!THROTTLE) return;
	const cdp = await context.newCDPSession(page);
	await cdp.send("Network.enable");
	await cdp.send("Network.emulateNetworkConditions", {
		offline: false,
		latency: THROTTLE.latency,
		downloadThroughput: (THROTTLE.kbps * 1024) / 8,
		uploadThroughput: (THROTTLE.kbps * 1024) / 8 / 2,
	});
}

// Playwright owns `test-results/` and deletes it at the start of every run, so
// benchmark artifacts live in their own directory (gitignored, and small enough
// for tsc to ignore). Override with PERF_OUT.
const PERF_OUT = process.env.PERF_OUT || "artifacts/perf";
const OUT_DIR = PERF_OUT;
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// stats
// ---------------------------------------------------------------------------
const sorted = (a) => [...a].filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
function pct(values, p) {
	const s = sorted(values);
	if (!s.length) return null;
	const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
	return s[idx];
}
function stats(values) {
	const s = sorted(values);
	if (!s.length) return null;
	return {
		n: s.length,
		median: pct(s, 50),
		p75: pct(s, 75),
		min: s[0],
		max: s[s.length - 1],
		mean: Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10,
	};
}
const r1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);

// ---------------------------------------------------------------------------
// page helpers
// ---------------------------------------------------------------------------
async function newInstrumentedPage(context) {
	const page = await context.newPage();
	await page.addInitScript(initScript);
	return page;
}

async function waitSwupReady(page, timeout = 20000) {
	await page.waitForFunction(
		() => window.swup && document.documentElement.classList.contains("swup-enabled"),
		null,
		{ timeout },
	);
}

/** Real click on a nav link, then wait for the Swup visit to fully settle. */
async function swupClick(page, selector) {
	const before = await page.evaluate(() => ({
		origin: performance.timeOrigin,
		url: location.href,
	}));
	// One round trip to arm the measurement, one to read it back: the settle
	// promise is resolved in-page so we do not poll from the driver (which is
	// slow when a navigation legitimately takes seconds). Records are cleared
	// first so each navigation is measured in isolation — without this, a
	// degraded page that keeps issuing requests makes the phase extraction
	// compare timestamps from different visits.
	await page.evaluate(() => {
		window.__perf.events = [];
		window.__perf.fetches = [];
		window.__perf.clicks = [];
		window.__perf.longtasks = [];
		window.__perfNav.begin();
		window.__navSettled = new Promise((resolve) => {
			const finish = () => {
				requestAnimationFrame(() => {
					if (window.__perf?.nav && window.__perf.nav.visualStable !== null) resolve(true);
					else setTimeout(finish, 30);
				});
			};
			document.addEventListener(
				"swup:visit:end",
				() => {
					window.__navDone = true;
					setTimeout(finish, 0);
				},
				{ once: true },
			);
			setTimeout(() => resolve(false), 25000);
		});
	});
	await page.click(selector, { noWaitAfter: true });
	const settled = await page.evaluate(() => window.__navSettled);
	const snap = await page.evaluate(snapFn);
	const after = await page.evaluate(() => ({ origin: performance.timeOrigin, url: location.href }));
	snap.fullLoad = before.origin !== after.origin;
	snap.settled = settled;
	snap.fromUrl = before.url;
	snap.toUrl = after.url;
	return snap;
}

// ---------------------------------------------------------------------------
// nav phase extraction
// ---------------------------------------------------------------------------
const PHASE = {
	clickToVisitStart: ["click", "swup:visit:start"],
	network: ["swup:fetch:request", "swup:page:load"],
	outTransition: ["swup:animation:out:start", "swup:animation:out:end"],
	domReplace: ["swup:page:load", "swup:content:replace"],
	postReplaceJs: ["swup:content:replace", "swup:page:view"],
	inTransition: ["swup:animation:in:start", "swup:animation:in:end"],
	visitTotal: ["click", "swup:visit:end"],
	perceived: ["click", "@visualStable"],
};

function extractPhases(snap) {
	const ev = {};
	// last occurrence wins for repeated hooks within one navigation
	for (const e of snap.events) ev[e.name] = e.t;
	const click = snap.clicks.length ? snap.clicks[snap.clicks.length - 1].t : null;
	if (click !== null) ev.click = click;
	ev["@visualStable"] = snap.navRec?.visualStable ?? null;
	ev["@firstFrame"] = snap.navRec?.firstFrame ?? null;

	const out = {};
	for (const [name, [a, b]] of Object.entries(PHASE)) {
		const ta = ev[a];
		const tb = ev[b];
		if (Number.isFinite(ta) && Number.isFinite(tb) && tb >= ta) out[name] = r1(tb - ta);
	}
	out.contentReplaceToFirstFrame =
		Number.isFinite(ev["swup:content:replace"]) && Number.isFinite(ev["@firstFrame"])
			? r1(ev["@firstFrame"] - ev["swup:content:replace"])
			: null;
	out.pageViewToVisualStable =
		Number.isFinite(ev["swup:page:view"]) && Number.isFinite(ev["@visualStable"])
			? r1(ev["@visualStable"] - ev["swup:page:view"])
			: null;
	out.total = out.perceived;
	// Network requests issued during the navigation window.
	const t0 = ev.click ?? 0;
	const t1 = ev["@visualStable"] ?? Number.POSITIVE_INFINITY;
	out.requests = snap.fetches
		.filter((f) => f.t0 >= t0 - 5 && f.t0 <= t1)
		.map((f) => ({
			url: f.url.replace(ORIGIN, ""),
			dur: r1(f.dur),
			status: f.status,
			bytes: f.bytes,
		}));
	return out;
}

// ---------------------------------------------------------------------------
// modes
// ---------------------------------------------------------------------------
async function runCold(browser) {
	const results = {};
	for (const vp of VIEWPORTS) {
		results[vp.name] = {};
		for (const route of COLD_PAGES) {
			const samples = [];
			const resourceSets = [];
			for (let i = 0; i < RUNS; i += 1) {
				// Fresh context => empty HTTP cache => genuinely cold.
				const context = await browser.newContext({
					viewport: { width: vp.width, height: vp.height },
					deviceScaleFactor: 1,
				});
				const page = await newInstrumentedPage(context);
				await applyThrottle(context, page);
				try {
					await page.goto(ORIGIN + route, { waitUntil: "load", timeout: 90000 });
					// Let LCP/CLS observers settle.
					await page.waitForTimeout(1200);
					const snap = await page.evaluate(snapFn);
					const nav = snap.nav || {};
					const lcp = snap.lcp.length ? snap.lcp[snap.lcp.length - 1].t : null;
					const cls = snap.cls.reduce((a, c) => a + c.value, 0);
					const transfers = snap.resources.filter((r) => r.transferSize > 0);
					samples.push({
						ttfb: r1(nav.responseStart),
						fcp: r1(snap.paint["first-contentful-paint"]),
						lcp: r1(lcp),
						dcl: r1(nav.domContentLoadedEventEnd),
						load: r1(nav.loadEventEnd),
						cls: Math.round(cls * 1000) / 1000,
						transferBytes: transfers.reduce((a, r) => a + r.transferSize, 0),
						requestCount: snap.resources.length,
						longtaskTotal: r1(snap.longtasks.reduce((a, t) => a + t.dur, 0)),
						longtaskMax: snap.longtasks.length ? r1(Math.max(...snap.longtasks.map((t) => t.dur))) : 0,
					});
					resourceSets.push(
						snap.resources.map((r) => ({
							name: r.name.replace(ORIGIN, ""),
							initiatorType: r.initiatorType,
							startTime: r.startTime,
							transferSize: r.transferSize,
							encodedBodySize: r.encodedBodySize,
							decodedBodySize: r.decodedBodySize,
							duration: r1(r.duration),
						})),
					);
				} catch (e) {
					samples.push({ error: String(e).slice(0, 200) });
				}
				await context.close();
			}
			const ok = samples.filter((s) => !s.error);
			const keys = ["ttfb", "fcp", "lcp", "dcl", "load", "cls", "transferBytes", "requestCount", "longtaskTotal", "longtaskMax"];
			const agg = {};
			for (const k of keys) agg[k] = stats(ok.map((s) => s[k]));
			results[vp.name][route] = {
				stats: agg,
				samples,
				resources: resourceSets[0] || [],
				raw: ok,
			};
		}
	}
	return results;
}

const NAV_LOOP = [
	{ from: "/", to: "/posts/", sel: '[data-nav-key="posts"]', key: "Home → Posts" },
	{ from: "/posts/", to: "/archive/", sel: '[data-nav-key="archive"]', key: "Posts → Archive" },
	{ from: "/archive/", to: "/", sel: '[data-nav-key="home"]', key: "Archive → Home" },
	{ from: "/", to: "/community/", sel: '[data-nav-key="community"]', key: "Home → Trajectory" },
	{ from: "/community/", to: "/posts/", sel: '[data-nav-key="posts"]', key: "Trajectory → Posts" },
	{ from: "/posts/", to: "/friends/", sel: '[data-nav-key="friends"]', key: "Posts → Friends" },
	{ from: "/friends/", to: "/about/", sel: '[data-nav-key="about"]', key: "Friends → About" },
	{ from: "/about/", to: "/", sel: '[data-nav-key="home"]', key: "About → Home" },
];

async function runNav(browser) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await newInstrumentedPage(context);
	await applyThrottle(context, page);
	const perPath = {};
	for (const step of NAV_LOOP) perPath[step.key] = [];
	const raw = [];

	await page.goto(`${ORIGIN}/`, { waitUntil: "load", timeout: 60000 });
	await waitSwupReady(page);

	for (let round = 0; round < ROUNDS; round += 1) {
		for (const step of NAV_LOOP) {
			// Guard: after a failed navigation the loop must resync rather than
			// silently measuring the wrong transition.
			const live = new URL(page.url()).pathname;
			if (live !== step.from) {
				raw.push({ round, key: step.key, skipped: true, reason: `at ${live}, expected ${step.from}` });
				continue;
			}
			try {
				const snap = await swupClick(page, step.sel);
				const phases = extractPhases(snap);
				perPath[step.key].push(phases);
				raw.push({ round, key: step.key, ...phases, fullLoad: snap.fullLoad, settled: snap.settled });
				console.error(
					`  [nav] r${round} ${step.key} perceived=${phases.perceived} net=${phases.network} load2replace=${phases.domReplace} in=${phases.inTransition} reqs=${phases.requests.length} api=${phases.requests.filter((r) => r.url.startsWith("/api/")).length}`,
				);
			} catch (e) {
				raw.push({ round, key: step.key, error: String(e).slice(0, 200) });
				await page.goto(ORIGIN + step.to, { waitUntil: "load" }).catch(() => {});
				await waitSwupReady(page).catch(() => {});
			}
		}
	}
	await context.close();

	const summary = {};
	for (const [key, list] of Object.entries(perPath)) {
		if (!list.length) continue;
		summary[key] = {
			perceived: stats(list.map((p) => p.perceived)),
			network: stats(list.map((p) => p.network)),
			outTransition: stats(list.map((p) => p.outTransition)),
			domReplace: stats(list.map((p) => p.domReplace)),
			postReplaceJs: stats(list.map((p) => p.postReplaceJs)),
			inTransition: stats(list.map((p) => p.inTransition)),
			visitTotal: stats(list.map((p) => p.visitTotal)),
			pageViewToVisualStable: stats(list.map((p) => p.pageViewToVisualStable)),
			contentReplaceToFirstFrame: stats(list.map((p) => p.contentReplaceToFirstFrame)),
			requestsPerNav: stats(list.map((p) => p.requests.length)),
			apiRequests: stats(list.map((p) => p.requests.filter((r) => r.url.startsWith("/api/")).length)),
			htmlRequests: stats(list.map((p) => p.requests.filter((r) => !r.url.startsWith("/api/")).length)),
		};
	}
	return { summary, raw };
}

/**
 * Homepage content-type filter (全部 | 文章 | 轨迹). Measures what the visitor
 * waits for when switching the filter: the synchronous handler cost plus the
 * two animation frames that follow it (style recalc + layout + paint).
 */
async function runHomeFilter(page, rounds) {
	const buckets = {};
	const order = ["article", "trajectory", "all"];
	for (let i = 0; i < rounds; i += 1) {
		for (const want of order) {
			const r = await page.evaluate((target) => {
				const btn = document.querySelector(`[data-feed-filter="${target}"]`);
				if (!btn) return Promise.resolve({ error: "missing button " + target });
				const list = document.getElementById("post-list");
				const t0 = performance.now();
				btn.click();
				// Force pending style/layout work to complete before stopping the clock.
				if (list) void list.offsetHeight;
				const sync = performance.now() - t0;
				return new Promise((resolve) => {
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							resolve({
								sync: Math.round(sync * 10) / 10,
								frame: Math.round((performance.now() - t0) * 10) / 10,
								cards: list ? list.children.length : 0,
								active: document
									.querySelector(".feed-filter-btn.m3-chip--selected")
									?.getAttribute("data-feed-filter"),
							});
						});
					});
				});
			}, want);
			buckets[`home:${want}`] = buckets[`home:${want}`] || [];
			buckets[`home:${want}`].push(r.frame);
		}
	}
	const summary = {};
	for (const [k, v] of Object.entries(buckets)) summary[k] = stats(v);
	return summary;
}

async function runUi(browser) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await newInstrumentedPage(context);
	const out = { search: [], article: [] };

	// Homepage filter tabs first: this is the first thing a visitor interacts with.
	await page.goto(`${ORIGIN}/`, { waitUntil: "load", timeout: 60000 });
	await waitSwupReady(page);
	const homeFilter = await runHomeFilter(page, ROUNDS);

	await page.goto(`${ORIGIN}/posts/`, { waitUntil: "load", timeout: 60000 });
	await waitSwupReady(page);

	for (let i = 0; i < ROUNDS; i += 1) {
		const t = await page.evaluate(() => {
			const target = document.querySelector('[data-posts-view="search"]');
			if (!target) return Promise.resolve({ error: "no search button" });
			const t0 = performance.now();
			return new Promise((resolve) => {
				target.click();
				const check = () => {
					const feed = document.getElementById("feed-filter-card");
					const panel = document.getElementById("search-filter-card");
					const feedHidden = !feed || getComputedStyle(feed).display === "none";
					const panelShown = panel && getComputedStyle(panel).display !== "none";
					if ((feedHidden && panelShown) || performance.now() - t0 > 2000) {
						requestAnimationFrame(() => resolve({ ms: performance.now() - t0, feedHidden, panelShown }));
					} else {
						requestAnimationFrame(check);
					}
				};
				check();
			});
		});
		out.search.push(t);
		const back = await page.evaluate(() => {
			const target = document.querySelector('[data-posts-view="article"]');
			if (!target) return Promise.resolve({ error: "no article button" });
			const t0 = performance.now();
			return new Promise((resolve) => {
				target.click();
				const check = () => {
					const feed = document.getElementById("feed-filter-card");
					const shown = feed && getComputedStyle(feed).display !== "none";
					if (shown || performance.now() - t0 > 2000) {
						requestAnimationFrame(() => resolve({ ms: performance.now() - t0 }));
					} else {
						requestAnimationFrame(check);
					}
				};
				check();
			});
		});
		out.article.push(back);
	}
	await context.close();
	return {
		search: stats(out.search.map((s) => s.ms)),
		article: stats(out.article.map((s) => s.ms)),
		homeFilter,
		raw: out,
	};
}

async function runStress(browser) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await newInstrumentedPage(context);
	await page.goto(`${ORIGIN}/`, { waitUntil: "load", timeout: 60000 });
	await waitSwupReady(page);

	const seq = [];
	// Cycle through every path in NAV_LOOP, repeated until LOOPS navigations.
	while (seq.length < LOOPS) seq.push(...NAV_LOOP);

	const heap = [];
	const timings = [];
	const requests = [];
	const errors = [];
	page.on("console", (m) => {
		if (m.type() === "error") errors.push(m.text().slice(0, 160));
	});
	page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)));

	async function snapshotWindow() {
		const r = await page.evaluate(() => {
			const m = performance.memory;
			return {
				used: m ? m.usedJSHeapSize : null,
				total: m ? m.totalJSHeapSize : null,
				listeners: window.__listenerProbe ? window.__listenerProbe() : null,
			};
		});
		return r;
	}

	heap.push({ nav: 0, ...(await snapshotWindow()) });

	let count = 0;
	for (const step of seq) {
		const live = new URL(page.url()).pathname;
		if (live !== step.from) {
			await page.goto(ORIGIN + step.from, { waitUntil: "load" }).catch(() => {});
			await waitSwupReady(page).catch(() => {});
		}
		try {
			const snap = await swupClick(page, step.sel);
			const phases = extractPhases(snap);
			count += 1;
			timings.push({ n: count, key: step.key, perceived: phases.perceived, network: phases.network });
			requests.push({
				n: count,
				total: phases.requests.length,
				api: phases.requests.filter((r) => r.url.startsWith("/api/")).length,
			});
			if (count % 10 === 0) heap.push({ nav: count, ...(await snapshotWindow()) });
		} catch (e) {
			errors.push(`nav ${count} failed: ${String(e).slice(0, 120)}`);
			await page.goto(ORIGIN + step.to, { waitUntil: "load" }).catch(() => {});
			await waitSwupReady(page).catch(() => {});
		}
	}
	heap.push({ nav: count, ...(await snapshotWindow()) });
	await context.close();

	const first10 = timings.slice(0, 10).map((t) => t.perceived);
	const last10 = timings.slice(-10).map((t) => t.perceived);
	return {
		navigations: count,
		perceivedFirst10: stats(first10),
		perceivedLast10: stats(last10),
		apiRequestsPerNav: stats(requests.map((r) => r.api)),
		totalRequestsPerNav: stats(requests.map((r) => r.total)),
		heap,
		consoleErrors: errors,
		timings,
	};
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const browser = await chromium.launch({ args: ["--enable-precise-memory-info"] });
let result;
try {
	if (mode === "cold") result = await runCold(browser);
	else if (mode === "nav") result = await runNav(browser);
	else if (mode === "ui") result = await runUi(browser);
	else if (mode === "stress") result = await runStress(browser);
	else {
		console.error("usage: bench.mjs <cold|nav|ui|stress> [--url ORIGIN] [--label NAME]");
		process.exit(2);
	}
} finally {
	await browser.close();
}

const meta = { mode, origin: ORIGIN, label: LABEL, runs: RUNS, rounds: ROUNDS, loops: LOOPS, throttle: THROTTLE, viewports: VIEWPORTS.map((v) => v.name), at: new Date().toISOString() };
const outFile = `${OUT_DIR}/${LABEL}-${mode}.json`;
writeFileSync(outFile, JSON.stringify({ meta, result }, null, 1));

// ---- compact stdout summary -------------------------------------------------
function table(title, rows) {
	console.log(`\n== ${title}`);
	for (const [k, v] of rows) console.log(`  ${k.padEnd(22)} ${v}`);
}

if (mode === "cold") {
	for (const vp of Object.keys(result)) {
		console.log(`\n### viewport ${vp}`);
		for (const [route, data] of Object.entries(result[vp])) {
			const s = data.stats;
			console.log(
				`  ${route.padEnd(32)} ttfb=${String(s.ttfb?.median).padStart(7)} fcp=${String(s.fcp?.median).padStart(7)} lcp=${String(s.lcp?.median).padStart(7)} load=${String(s.load?.median).padStart(7)} cls=${s.cls?.median} req=${s.requestCount?.median} bytes=${s.transferBytes?.median} ltMax=${s.longtaskMax?.median}`,
			);
		}
	}
} else if (mode === "nav") {
	console.log(`\n### nav mode (${ROUNDS} rounds, n=${ROUNDS} per path)`);
	console.log(
		"  path".padEnd(24) +
			["percMed", "percP75", "netMed", "outMed", "domMed", "jsMed", "inMed", "visMed", "reqMed", "apiMed"].map((h) => h.padStart(9)).join(""),
	);
	for (const [k, v] of Object.entries(result.summary)) {
		const cells = [
			v.perceived?.median,
			v.perceived?.p75,
			v.network?.median,
			v.outTransition?.median,
			v.domReplace?.median,
			v.postReplaceJs?.median,
			v.inTransition?.median,
			v.pageViewToVisualStable?.median,
			v.requestsPerNav?.median,
			v.apiRequests?.median,
		];
		console.log("  " + k.padEnd(22) + cells.map((c) => String(c ?? "-").padStart(9)).join(""));
	}
} else if (mode === "ui") {
	table("Posts switcher UI response (ms)", [
		["文章 → 检索", `median=${result.search?.median} p75=${result.search?.p75} min=${result.search?.min} max=${result.search?.max}`],
		["检索 → 文章", `median=${result.article?.median} p75=${result.article?.p75} min=${result.article?.min} max=${result.article?.max}`],
	]);
	table(
		"Homepage filter switch (ms, click → 2 frames)",
		Object.entries(result.homeFilter || {}).map(([k, v]) => [k, `median=${v?.median} p75=${v?.p75} min=${v?.min} max=${v?.max}`]),
	);
} else if (mode === "stress") {
	console.log("\n### stress mode");
	console.log(`  navigations: ${result.navigations}`);
	console.log(`  perceived first10: ${JSON.stringify(result.perceivedFirst10)}`);
	console.log(`  perceived last10 : ${JSON.stringify(result.perceivedLast10)}`);
	console.log(`  api req/nav: ${JSON.stringify(result.apiRequestsPerNav)}`);
	console.log(`  total req/nav: ${JSON.stringify(result.totalRequestsPerNav)}`);
	console.log("  heap:");
	for (const h of result.heap) console.log(`    nav=${String(h.nav).padStart(3)} used=${h.used} total=${h.total}`);
	console.log(`  console errors: ${result.consoleErrors.length}`);
	for (const e of result.consoleErrors.slice(0, 10)) console.log(`    - ${e}`);
}

console.log(`\nwritten: ${outFile}`);
