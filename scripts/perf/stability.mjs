/**
 * Stability probe: does anything accumulate across Swup navigations?
 *
 * Reports the registered hook-handler count and resource totals after each
 * navigation. A growing `content:replace` count means a handler is being
 * registered once per visit, which Swup then awaits sequentially.
 *
 * Usage: node scripts/perf/stability.mjs [origin] [steps]
 */

import { chromium } from "@playwright/test";

const ORIGIN = process.argv[2] || "http://127.0.0.1:4400";
const STEPS = Number(process.argv[3] || 24);

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => {
	if (m.type() === "error") errors.push(m.text().slice(0, 140));
});
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 140)));

await page.goto(ORIGIN + "/", { waitUntil: "load", timeout: 60000 });
await page.waitForFunction(() => window.swup && document.documentElement.classList.contains("swup-enabled"), null, {
	timeout: 30000,
});

const probe = () =>
	page.evaluate(() => {
		const size = (n) => {
			try {
				return window.swup.hooks.get(n)?.size ?? -1;
			} catch {
				return -1;
			}
		};
		return {
			contentReplace: size("content:replace"),
			pageView: size("page:view"),
			visitStart: size("visit:start"),
			visitEnd: size("visit:end"),
			plugins: window.swup.plugins.length,
			cacheSize: window.swup.cache.size,
			apiResources: performance.getEntriesByType("resource").filter((r) => r.name.includes("/api/")).length,
			htmlScripts: document.querySelectorAll("script").length,
			used: performance.memory ? performance.memory.usedJSHeapSize : null,
		};
	});

const LOOP = [
	["/", '[data-nav-key="posts"]'],
	["/posts/", '[data-nav-key="archive"]'],
	["/archive/", '[data-nav-key="home"]'],
	["/", '[data-nav-key="community"]'],
	["/community/", '[data-nav-key="posts"]'],
	["/posts/", '[data-nav-key="friends"]'],
	["/friends/", '[data-nav-key="about"]'],
	["/about/", '[data-nav-key="home"]'],
];

const before = await probe();
console.log(`start: ${JSON.stringify(before)}`);
const rows = [];
let n = 0;
outer: for (let round = 0; round < 20; round += 1) {
	for (const [from, sel] of LOOP) {
		if (n >= STEPS) break outer;
		if (new URL(page.url()).pathname !== from) {
			await page.goto(ORIGIN + from, { waitUntil: "load" });
			await page.waitForFunction(() => window.swup, null, { timeout: 30000 });
		}
		const t0 = Date.now();
		await page.click(sel, { noWaitAfter: true });
		await page.waitForFunction(() => !document.documentElement.classList.contains("is-changing"), null, {
			timeout: 30000,
		});
		n += 1;
		const p = await probe();
		rows.push({ n, wall: Date.now() - t0, ...p });
		if (n % 8 === 0 || n <= 2) {
			console.log(
				`nav ${String(n).padStart(3)} wall=${String(Date.now() - t0).padStart(5)}ms cR=${p.contentReplace} pV=${p.pageView} api=${p.apiResources} cache=${p.cacheSize} scripts=${p.htmlScripts} heapMB=${p.used ? Math.round(p.used / 1048576) : "-"}`,
			);
		}
	}
}
const first = rows.slice(0, 5).reduce((a, r) => a + r.wall, 0) / Math.min(5, rows.length);
const last = rows.slice(-5).reduce((a, r) => a + r.wall, 0) / Math.min(5, rows.length);
console.log(`\nnavigations: ${rows.length}`);
console.log(`wall first5 avg: ${Math.round(first)}ms   last5 avg: ${Math.round(last)}ms   drift: ${Math.round(last - first)}ms`);
console.log(`content:replace handlers: start=${before.contentReplace} end=${rows.at(-1).contentReplace}`);
console.log(`api resources: start=${before.apiResources} end=${rows.at(-1).apiResources}`);
console.log(`console errors: ${errors.length}`);
for (const e of errors.slice(0, 5)) console.log("  - " + e);
await b.close();
