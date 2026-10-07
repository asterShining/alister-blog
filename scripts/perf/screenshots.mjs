/**
 * Visual regression screenshots for the performance work.
 *
 * Captures the pages whose rendering the optimisations could plausibly touch
 * (container fade, content entrance, themed wallpaper/Hero layers, the archive
 * category bar and the home feed filter) in both skins and at the two viewports
 * used throughout the audit.
 *
 * Usage: node scripts/perf/screenshots.mjs <origin> <outLabel>
 */

import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const ORIGIN = (process.argv[2] || "http://127.0.0.1:4400").replace(/\/$/, "");
const LABEL = process.argv[3] || "run";
const OUT = `artifacts/perf/shots-${LABEL}`;
mkdirSync(OUT, { recursive: true });

const ROUTES = ["/", "/posts/", "/community/", "/archive/"];
const VIEWPORTS = [
	{ width: 390, height: 844, name: "390" },
	{ width: 1440, height: 900, name: "1440" },
];

const browser = await chromium.launch();

for (const theme of ["dark", "light"]) {
	for (const vp of VIEWPORTS) {
		const ctx = await browser.newContext({
			viewport: { width: vp.width, height: vp.height },
			deviceScaleFactor: 1,
		});
		const page = await ctx.newPage();
		// Pin the theme before any site script runs so both builds render the
		// same skin deterministically (the site stores it in localStorage).
		await page.addInitScript((t) => {
			try {
				localStorage.setItem("theme", t);
			} catch {}
		}, theme);
		for (const route of ROUTES) {
			await page.goto(ORIGIN + route, { waitUntil: "load", timeout: 60000 });
			// Let the entrance animations settle so the shot is the steady state.
			await page.waitForTimeout(2500);
			const name = `${theme}-${vp.name}-${route.replace(/\//g, "_") || "_root"}.png`;
			await page.screenshot({ path: `${OUT}/${name}`, fullPage: false });
			// Structural facts that a pixel diff would not explain on its own.
			const facts = await page.evaluate(() => ({
				overflowX: document.documentElement.scrollWidth > window.innerWidth,
				scrollWidth: document.documentElement.scrollWidth,
				innerWidth: window.innerWidth,
				isDark: document.documentElement.classList.contains("dark"),
				artReady: document.documentElement.classList.contains("theme-art-ready"),
				containerOpacity: getComputedStyle(document.getElementById("swup-container") || document.body).opacity,
				contentOpacity: getComputedStyle(document.getElementById("content-wrapper") || document.body).opacity,
				wallpaperBefore: getComputedStyle(document.body, "::before").backgroundImage.slice(0, 60),
				wallpaperAfter: getComputedStyle(document.body, "::after").backgroundImage.slice(0, 60),
			}));
			console.log(
				`${name.padEnd(34)} dark=${facts.isDark ? "Y" : "n"} artReady=${facts.artReady ? "Y" : "n"} overflow=${facts.overflowX ? "YES" : "no"} (${facts.scrollWidth}/${facts.innerWidth}) main=${facts.containerOpacity} content=${facts.contentOpacity}`,
			);
		}
		await ctx.close();
	}
}

await browser.close();
console.log(`\nwritten to ${OUT}`);
