/**
 * Static bundle audit for a built `dist/`.
 *
 * Reports what the browser actually has to pull, grouped by kind, plus the
 * initial-load JS/CSS referenced by a given HTML entry. Sizes are raw bytes on
 * disk; Production serves Brotli, so compare like with like (raw vs raw).
 *
 * Usage: node scripts/perf/bundle-audit.mjs [distDir] [entryHtml]
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const DIR = process.argv[2] || "dist";
const ENTRY = process.argv[3] || "index.html";

function walk(dir, out = []) {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		const st = statSync(p);
		if (st.isDirectory()) walk(p, out);
		else out.push({ path: p, size: st.size });
	}
	return out;
}

const files = walk(DIR);
const kb = (n) => Math.round((n / 1024) * 10) / 10;
const group = (exts) => files.filter((f) => exts.includes(extname(f.path).toLowerCase()));
const sum = (list) => list.reduce((a, f) => a + f.size, 0);

const html = group([".html"]);
const js = group([".js", ".mjs"]);
const css = group([".css"]);
const img = group([".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".avif"]);
const font = group([".woff", ".woff2", ".ttf", ".otf"]);

console.log(`dist: ${DIR}  (${files.length} files, ${kb(sum(files))} KB total)\n`);

const table = (name, list, top = 5) => {
	const total = sum(list);
	console.log(`${name.padEnd(10)} count=${String(list.length).padStart(4)}  total=${String(kb(total)).padStart(9)} KB`);
	for (const f of [...list].sort((a, b) => b.size - a.size).slice(0, top)) {
		console.log(`  ${String(kb(f.size)).padStart(9)} KB  ${relative(DIR, f.path)}`);
	}
};

table("html", html);
table("js", js);
table("css", css);
table("images", img);
table("fonts", font);

// Initial-load assets for the entry document.
const entryPath = join(DIR, ENTRY);
let initialJs = [];
let initialCss = [];
try {
	const src = readFileSync(entryPath, "utf8");
	const grab = (re) => {
		const out = new Set();
		let m;
		while ((m = re.exec(src))) out.add(m[1]);
		return [...out];
	};
	const refs = [
		...grab(/<script[^>]+src="([^"]+)"/g),
		...grab(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g),
	];
	const cssRefs = grab(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g);
	const lookup = new Map(files.map((f) => ["/" + relative(DIR, f.path).replace(/\\/g, "/"), f]));
	initialJs = refs.map((r) => lookup.get(r)).filter(Boolean);
	initialCss = cssRefs.map((r) => lookup.get(r)).filter(Boolean);
	console.log(`\ninitial load for ${ENTRY}`);
	console.log(`  js  refs=${refs.length}  total=${kb(sum(initialJs))} KB`);
	console.log(`  css refs=${cssRefs.length}  total=${kb(sum(initialCss))} KB`);
	console.log(`  inline <script> blocks=${(src.match(/<script(?![^>]*src=)/g) || []).length}`);
	console.log(`  html bytes=${src.length} (${kb(src.length)} KB)`);
} catch (e) {
	console.log(`\n(no entry ${ENTRY}: ${e.message})`);
}

const largestHtml = [...html].sort((a, b) => b.size - a.size)[0];
console.log(`\nlargest html: ${largestHtml ? `${relative(DIR, largestHtml.path)} ${kb(largestHtml.size)} KB` : "-"}`);
const largestJs = [...js].sort((a, b) => b.size - a.size)[0];
console.log(`largest js chunk: ${largestJs ? `${relative(DIR, largestJs.path)} ${kb(largestJs.size)} KB` : "-"}`);
const largestCss = [...css].sort((a, b) => b.size - a.size)[0];
console.log(`largest css: ${largestCss ? `${relative(DIR, largestCss.path)} ${kb(largestCss.size)} KB` : "-"}`);
const largestImg = [...img].sort((a, b) => b.size - a.size)[0];
console.log(`largest image: ${largestImg ? `${relative(DIR, largestImg.path)} ${kb(largestImg.size)} KB` : "-"}`);
