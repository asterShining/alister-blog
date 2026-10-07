/**
 * Backdrop-filter A/B (glass surfaces).
 *
 * The theme uses frosted glass on the profile card, article cards, the archive
 * category bar and the auxiliary bar. `html.is-animating` already drops blur
 * while a Swup transition is in flight, so this measures what is left: the cost
 * of the blur during a cold load and during an in-page filter switch.
 *
 * Mode B removes every `backdrop-filter` via an injected stylesheet. This is a
 * measurement only — nothing here is ever committed as a product change.
 *
 * Usage: node scripts/perf/blur-ab.mjs [origin] [runs]
 */

import { chromium } from "@playwright/test";
import { initScript, snapshot as snapFn } from "./instrument.mjs";

const ORIGIN = (process.argv[2] || "http://127.0.0.1:4400").replace(/\/$/, "");
const RUNS = Number(process.argv[3] || 5);

const disableBlur = () => {
	const style = document.createElement("style");
	style.textContent = "*, *::before, *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }";
	document.documentElement.appendChild(style);
};

const browser = await chromium.launch();

function stats(values) {
	const s = [...values].filter(Number.isFinite).sort((a, b) => a - b);
	if (!s.length) return null;
	const p = (q) => s[Math.min(s.length - 1, Math.max(0, Math.ceil((q / 100) * s.length) - 1))];
	return { median: Math.round(p(50) * 10) / 10, p75: Math.round(p(75) * 10) / 10, min: s[0], max: s.at(-1) };
}

async function measureGlass(on) {
	const fcp = [];
	const lcp = [];
	const filterSwitch = [];
	const paintish = [];
	for (let i = 0; i < RUNS; i += 1) {
		const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
		const page = await ctx.newPage();
		await page.addInitScript(initScript);
		if (on) await page.addInitScript(disableBlur);
		await page.goto(`${ORIGIN}/`, { waitUntil: "load", timeout: 60000 });
		await page.waitForTimeout(1500);
		const snap = await page.evaluate(snapFn);
		fcp.push(snap.paint["first-contentful-paint"]);
		lcp.push(snap.lcp.length ? snap.lcp.at(-1).t : NaN);
		// Cost of a filter switch with blur active vs removed: the container
		// fade also disables blur, so this is plain style/layout/paint work.
		const t = await page.evaluate(() => {
			const btn = document.querySelector('[data-feed-filter="trajectory"]');
			const list = document.getElementById("post-list");
			const t0 = performance.now();
			btn.click();
			if (list) void list.offsetHeight;
			const sync = performance.now() - t0;
			return new Promise((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve({ sync, total: performance.now() - t0 }))),
			);
		});
		filterSwitch.push(t.total);
		paintish.push(t.sync);
		await ctx.close();
	}
	return {
		fcp: stats(fcp),
		lcp: stats(lcp),
		filterSwitch: stats(filterSwitch),
		filterSync: stats(paintish),
	};
}

const withBlur = await measureGlass(false);
const withoutBlur = await measureGlass(true);

const line = (label, a, b) => {
	const d = a && b ? Math.round((b.median - a.median) * 10) / 10 : null;
	console.log(
		`  ${label.padEnd(24)} glass=${String(a?.median).padStart(8)} (p75 ${String(a?.p75).padStart(8)})  noBlur=${String(b?.median).padStart(8)} (p75 ${String(b?.p75).padStart(8)})  delta=${d}`,
	);
};
console.log(`\nbackdrop-filter A/B on ${ORIGIN}  (${RUNS} runs each, desktop 1440)`);
line("FCP (ms)", withBlur.fcp, withoutBlur.fcp);
line("LCP (ms)", withBlur.lcp, withoutBlur.lcp);
line("filter switch total (ms)", withBlur.filterSwitch, withoutBlur.filterSwitch);
line("filter switch sync (ms)", withBlur.filterSync, withoutBlur.filterSync);
console.log("\nA positive delta means removing blur made it faster.");

await browser.close();
