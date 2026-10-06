/**
 * Compare two screenshot sets produced by `screenshots.mjs`.
 *
 * Reports the mean absolute error and the share of pixels that differ beyond a
 * small tolerance, per file. Animation timing and font rasterisation can move a
 * few pixels between runs, so treat a tiny MAE as "identical" and inspect any
 * file with a large differing-pixel share by eye.
 *
 * Usage: node scripts/perf/shots-diff.mjs <dirA> <dirB> [tolerance]
 */

import { readdirSync, readFileSync } from "node:fs";
import sharp from "sharp";

const [dirA, dirB, tolArg] = process.argv.slice(2);
const TOL = Number(tolArg || 8);

const files = readdirSync(dirA).filter((f) => f.endsWith(".png")).sort();
let worst = { name: "-", pct: 0 };
let totalPct = 0;
let compared = 0;

for (const name of files) {
	let a;
	let b;
	try {
		a = await sharp(`${dirA}/${name}`).raw().toBuffer({ resolveWithObject: true });
		b = await sharp(`${dirB}/${name}`).raw().toBuffer({ resolveWithObject: true });
	} catch (e) {
		console.log(`  ${name.padEnd(30)} MISSING/UNREADABLE (${e.message})`);
		continue;
	}
	if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
		console.log(`  ${name.padEnd(30)} SIZE MISMATCH ${a.info.width}x${a.info.height} vs ${b.info.width}x${b.info.height}`);
		continue;
	}
	const n = a.info.width * a.info.height;
	const ch = a.info.channels;
	let sum = 0;
	let differing = 0;
	for (let i = 0; i < a.data.length; i += ch) {
		let d = 0;
		for (let c = 0; c < 3; c += 1) d = Math.max(d, Math.abs(a.data[i + c] - b.data[i + c]));
		sum += d;
		if (d > TOL) differing += 1;
	}
	const mae = Math.round((sum / n) * 100) / 100;
	const pct = Math.round((differing / n) * 10000) / 100;
	totalPct += pct;
	compared += 1;
	if (pct > worst.pct) worst = { name, pct };
	console.log(`  ${name.padEnd(30)} MAE=${String(mae).padStart(6)}  pixels>${TOL}=${String(pct).padStart(6)}%`);
	// touch the buffers so nothing is optimised away
	if (readFileSync(`${dirA}/${name}`).length === 0) console.log("empty");
}

console.log(
	`\n${compared} files compared; mean differing-pixel share ${Math.round((totalPct / Math.max(1, compared)) * 100) / 100}%; worst ${worst.name} at ${worst.pct}%`,
);
