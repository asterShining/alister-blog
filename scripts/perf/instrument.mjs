/**
 * Performance instrumentation injected into every measured page before any
 * site script runs.
 *
 * Design notes:
 * - We record real Swup hooks through the `swup:any` DOM event that Swup 4
 *   dispatches for *every* hook, instead of guessing individual hook names.
 * - `window.fetch` is patched so HTML navigations (Swup uses fetch) and
 *   community API calls are both captured with real start/end timestamps.
 * - `visualStable` skips infinite animations (ambient star fields and similar),
 *   whose `finished` promise never settles.
 *
 * These are plain functions because Playwright serialises them into the page:
 * they must not close over any module-scope binding.
 */

/** Passed to `page.addInitScript`. */
export function initScript() {
	if (window.__perf) return;
	const perf = {
		events: [],
		fetches: [],
		clicks: [],
		longtasks: [],
		lcp: [],
		cls: [],
	};
	window.__perf = perf;

	const now = () => performance.now();

	// ---- fetch instrumentation -------------------------------------------------
	const origFetch = window.fetch;
	window.fetch = function (input, _init) {
		let url = "";
		try {
			url = typeof input === "string" ? input : (input && input.url) || String(input);
		} catch {
			url = "<unresolvable>";
		}
		const rec = { url, t0: now(), t1: null, dur: null, status: null, bytes: null, ok: null };
		perf.fetches.push(rec);
		const p = origFetch.apply(this, arguments);
		p.then(
			(res) => {
				rec.t1 = now();
				rec.dur = rec.t1 - rec.t0;
				rec.status = res.status;
				rec.ok = res.ok;
				try {
					res.clone().text().then(
						(t) => {
							rec.bytes = t.length;
						},
						() => {},
					);
				} catch {
					/* body already consumed */
				}
			},
			(err) => {
				rec.t1 = now();
				rec.dur = rec.t1 - rec.t0;
				rec.error = String(err && err.message ? err.message : err);
			},
		);
		return p;
	};

	// ---- long tasks ------------------------------------------------------------
	try {
		new PerformanceObserver((list) => {
			for (const e of list.getEntries()) perf.longtasks.push({ start: e.startTime, dur: e.duration });
		}).observe({ type: "longtask", buffered: true });
	} catch {
		/* unsupported */
	}

	// ---- LCP / CLS -------------------------------------------------------------
	try {
		new PerformanceObserver((list) => {
			for (const e of list.getEntries()) {
				perf.lcp.push({
					t: e.startTime,
					size: e.size,
					url: e.url || "",
					tag: e.element ? e.element.tagName : "",
				});
			}
		}).observe({ type: "largest-contentful-paint", buffered: true });
	} catch {
		/* unsupported */
	}
	try {
		new PerformanceObserver((list) => {
			for (const e of list.getEntries()) if (!e.hadRecentInput) perf.cls.push({ t: e.startTime, value: e.value });
		}).observe({ type: "layout-shift", buffered: true });
	} catch {
		/* unsupported */
	}

	// ---- real Swup hooks via the catch-all event -------------------------------
	document.addEventListener("swup:any", (e) => {
		const d = e.detail || {};
		perf.events.push({ name: "swup:" + d.hook, t: now() });
	});

	// ---- click timestamps ------------------------------------------------------
	document.addEventListener(
		"click",
		(e) => {
			const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
			perf.clicks.push({
				t: now(),
				href: a ? a.getAttribute("href") : null,
				tag: e.target ? e.target.tagName : "",
			});
		},
		true,
	);

	// ---- public API ------------------------------------------------------------
	window.__perfNav = {
		begin() {
			perf.nav = { t0: now(), marks: {}, firstFrame: null, visualStable: null };
			return perf.nav;
		},
	};

	// After content:replace, record the first frame and the time at which all
	// finite animations have settled.
	document.addEventListener("swup:content:replace", () => {
		requestAnimationFrame(() => {
			if (!perf.nav) return;
			perf.nav.firstFrame = now();
			let anims = [];
			try {
				anims = (document.getAnimations ? document.getAnimations() : []).filter((a) => {
					try {
						const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : {};
						return t.iterations !== Infinity;
					} catch {
						return true;
					}
				});
			} catch {
				/* unsupported */
			}
			Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => {
				requestAnimationFrame(() => {
					if (perf.nav && perf.nav.visualStable === null) perf.nav.visualStable = now();
				});
			});
		});
	});
}

/** Passed to `page.evaluate` to read everything the instrument recorded. */
export function snapshot() {
	const p = window.__perf || {
		events: [],
		fetches: [],
		clicks: [],
		longtasks: [],
		lcp: [],
		cls: [],
	};
	const nav = performance.getEntriesByType("navigation")[0] || null;
	const paint = {};
	for (const e of performance.getEntriesByType("paint")) paint[e.name] = e.startTime;
	return {
		events: p.events,
		fetches: p.fetches,
		clicks: p.clicks,
		longtasks: p.longtasks,
		lcp: p.lcp,
		cls: p.cls,
		nav: nav
			? {
					responseStart: nav.responseStart,
					responseEnd: nav.responseEnd,
					domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
					loadEventEnd: nav.loadEventEnd,
					startTime: nav.startTime,
					transferSize: nav.transferSize,
					encodedBodySize: nav.encodedBodySize,
					decodedBodySize: nav.decodedBodySize,
				}
			: null,
		paint,
		navRec: p.nav || null,
		resources: performance.getEntriesByType("resource").map((r) => ({
			name: r.name,
			initiatorType: r.initiatorType,
			startTime: r.startTime,
			duration: r.duration,
			transferSize: r.transferSize,
			encodedBodySize: r.encodedBodySize,
			decodedBodySize: r.decodedBodySize,
		})),
	};
}
