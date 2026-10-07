/**
 * Local production-like preview server for performance benchmarking.
 *
 * `astro preview` serves static files only: it has no Cloudflare Pages
 * Functions, so `/api/v1/community/*` returns 404 there and the Community UI
 * degrades into its error state. That makes it useless for measuring the real
 * navigation cost, and it also makes API request counts meaningless.
 *
 * This server exists purely as a benchmark harness. It serves `dist/` exactly
 * like `astro preview` and adds a mock of the public read-only API whose
 * latency matches what Production actually showed (see the network baseline in
 * `test-results/perf/net-baseline-*.txt`: a static HTML response costs about one
 * round trip, while `/api/v1/community/posts` costs roughly 0.35-0.55 s more).
 *
 * It is NOT part of the site build and is never deployed. Production API
 * behaviour is measured directly against `https://alistereno.top`.
 *
 * Usage:
 *   node scripts/perf/preview-server.mjs [--dir dist] [--port 4400] [--api-delay 350]
 *                                        [--gzip] [--log test-results/perf/api-requests.log]
 */

import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync, appendFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { gzipSync } from "node:zlib";

const argv = process.argv.slice(2);
const opt = (name, dflt) => {
	const i = argv.indexOf(`--${name}`);
	return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const DIR = opt("dir", "dist");
const PORT = Number(opt("port", 4400));
const API_DELAY = Number(opt("api-delay", 350));
const USE_GZIP = argv.includes("--gzip");
const LOG = opt("log", "");

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".webp": "image/webp",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".ico": "image/x-icon",
	".woff2": "font/woff2",
	".woff": "font/woff",
	".ttf": "font/ttf",
	".xml": "application/xml; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".mp3": "audio/mpeg",
	".mp4": "video/mp4",
};
const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".xml", ".txt"]);

const POSTS = [
	{
		id: "community-start",
		slug: "community-start",
		title: "社区，也从这里开始",
		content:
			"这里是 **轨迹** 的第一条记录。\n\n## 为什么会有轨迹\n\n文章太长，日常太碎。轨迹用来放下那些不足以写成文章、又不该被丢掉的东西。\n\n- 状态更新\n- 调试记录\n- 随手笔记\n\n> 先把地方留出来，内容慢慢长。\n\n```js\nconsole.log(\"hello trajectory\");\n```\n\n更多内容见 [关于](/about/)。",
		contentFormat: "markdown",
		author: { name: "Alister", avatar: "/images/profile/avatar.webp" },
		createdAt: "2026-10-06T00:00:00.000Z",
		publishedAt: "2026-10-06T00:00:00.000Z",
		updatedAt: "2026-10-06T00:00:00.000Z",
		images: [],
	},
];

let apiRequests = 0;
function logRequest(line) {
	apiRequests += 1;
	const entry = `${new Date().toISOString()} ${line}\n`;
	if (LOG) {
		try {
			appendFileSync(LOG, entry);
		} catch {
			/* benchmark log is best-effort */
		}
	}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sendJson(res, body, status = 200) {
	const text = JSON.stringify(body);
	const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
	const buf = Buffer.from(text);
	if (USE_GZIP) {
		const gz = gzipSync(buf);
		res.writeHead(status, { ...headers, "content-encoding": "gzip", "content-length": gz.length });
		res.end(gz);
		return;
	}
	res.writeHead(status, { ...headers, "content-length": buf.length });
	res.end(buf);
}

/** Static file resolution mirroring the Pages behaviour this site relies on. */
function resolveStatic(pathname) {
	const candidates = [];
	let p = decodeURIComponent(pathname);
	if (p.endsWith("/")) {
		candidates.push(join(DIR, p, "index.html"));
	} else {
		candidates.push(join(DIR, p));
		if (!extname(p)) {
			candidates.push(join(DIR, p, "index.html"));
			candidates.push(join(DIR, `${p}.html`));
		}
	}
	// `/community/<slug>/` is rewritten to the static shell by
	// functions/community/[slug].ts in Production; mirror it here.
	const m = /^\/community\/([^/]+)\/?$/.exec(p);
	if (m && m[1] !== "post" && !extname(m[1])) {
		candidates.push(join(DIR, "community", "post", "index.html"));
	}
	for (const c of candidates) {
		const abs = normalize(c);
		if (!abs.startsWith(DIR)) continue;
		if (existsSync(abs) && statSync(abs).isFile()) return abs;
	}
	return null;
}

const server = createServer(async (req, res) => {
	const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
	const path = url.pathname;
	const started = Date.now();

	// ---- mock public API -----------------------------------------------------
	if (path.startsWith("/api/")) {
		await sleep(API_DELAY);
		logRequest(`${req.method} ${path}${url.search}`);

		const listMatch = path === "/api/v1/community/posts";
		const detailMatch = /^\/api\/v1\/community\/posts\/([^/]+)$/.exec(path);

		if (listMatch) {
			const limit = Math.min(Number(url.searchParams.get("limit") ?? 20) || 20, 50);
			const offset = Number(url.searchParams.get("offset") ?? 0) || 0;
			sendJson(res, {
				code: 0,
				message: "ok",
				data: { posts: POSTS.slice(offset, offset + limit), total: POSTS.length },
			});
			return;
		}
		if (detailMatch) {
			const post = POSTS.find((p) => p.slug === detailMatch[1]);
			if (!post) {
				sendJson(res, { code: 404, message: "POST_NOT_FOUND" }, 404);
				return;
			}
			sendJson(res, { code: 0, message: "ok", data: post });
			return;
		}
		if (path === "/api/v1/health") {
			sendJson(res, { status: "ok", database: "connected" });
			return;
		}
		if (path.startsWith("/api/v1/views/")) {
			sendJson(res, { code: 0, data: { slug: path.split("/").pop(), views: 41 } });
			return;
		}
		if (path.startsWith("/api/v1/reactions/")) {
			sendJson(res, { code: 0, data: { slug: path.split("/").pop(), reaction: null, likes: 0, dislikes: 0 } });
			return;
		}
		if (path.startsWith("/api/v1/comments/")) {
			if (req.method === "POST") {
				sendJson(res, { code: 1, message: "benchmark server is read-only" }, 403);
				return;
			}
			sendJson(res, { code: 0, data: { comments: [] } });
			return;
		}
		sendJson(res, { code: 404, message: "NOT_FOUND" }, 404);
		return;
	}

	// ---- static --------------------------------------------------------------
	const file = resolveStatic(path);
	if (!file) {
		const notFound = join(DIR, "404.html");
		if (existsSync(notFound)) {
			res.writeHead(404, { "content-type": MIME[".html"] });
			createReadStream(notFound).pipe(res);
			return;
		}
		res.writeHead(404, { "content-type": "text/plain" });
		res.end("not found");
		return;
	}

	const ext = extname(file).toLowerCase();
	const type = MIME[ext] || "application/octet-stream";
	const headers = {
		"content-type": type,
		// Production serves HTML as max-age=0, must-revalidate and hashed assets
		// immutably; keep that distinction so cache behaviour is comparable.
		"cache-control": ext === ".html" ? "public, max-age=0, must-revalidate" : "public, max-age=31536000, immutable",
	};
	if (USE_GZIP && COMPRESSIBLE.has(ext)) {
		const { readFileSync } = await import("node:fs");
		const gz = gzipSync(readFileSync(file));
		res.writeHead(200, { ...headers, "content-encoding": "gzip", "content-length": gz.length });
		res.end(gz);
		return;
	}
	const size = statSync(file).size;
	res.writeHead(200, { ...headers, "content-length": size });
	createReadStream(file).pipe(res);
	void started;
});

server.listen(PORT, "127.0.0.1", () => {
	if (LOG) {
		mkdirSync(LOG.split("/").slice(0, -1).join("/") || ".", { recursive: true });
		writeFileSync(LOG, `# preview API request log ${new Date().toISOString()}\n`);
	}
	console.log(
		`preview server on http://127.0.0.1:${PORT} dir=${DIR} api-delay=${API_DELAY}ms gzip=${USE_GZIP} log=${LOG || "(none)"}`,
	);
});
