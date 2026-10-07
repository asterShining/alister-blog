/**
 * Short-lived in-memory read cache for the public Community API.
 *
 * Why this exists
 * ---------------
 * Production measurements showed the same read-only data being requested again
 * and again during one browsing session:
 *
 *   - `SiteStats.astro` requested `/api/v1/community/posts?limit=1` on *every*
 *     Swup `content:replace`, purely to refresh a single total count;
 *   - the homepage feed requested `/api/v1/community/posts?limit=50` on every
 *     arrival at `/`;
 *   - `/community/` re-mounted its Svelte island on every arrival and requested
 *     the list again.
 *
 * With ~0.4–1.1 s of latency per API call (and `cache-control: no-store` on the
 * API itself), those repeats were the largest avoidable cost of an in-site
 * navigation.
 *
 * Design constraints
 * ------------------
 * - **Memory only.** Nothing is written to `localStorage`, `sessionStorage`, or
 *   any persistent store, so a full page load always starts clean and the cache
 *   can never outlive the tab. This keeps the "no stale content" guarantee that
 *   a build-time or storage-backed cache would break.
 * - **Short TTL.** 60 s bounds staleness well below a minute. Community content
 *   changes only through explicit Operator/Publisher reconciliation, so this is
 *   far shorter than any plausible publish interval.
 * - **Concurrent request de-duplication.** N callers that ask for the same key
 *   while a request is in flight share one promise and therefore one HTTP
 *   request.
 * - **Errors are cached only very briefly.** A failure is remembered for 5 s so
 *   rapid navigation cannot hammer a failing endpoint, but recovery is quick.
 * - **Read-only.** Only GET endpoints go through here. Nothing about the
 *   published/draft isolation changes: this cache stores exactly what the public
 *   API already returned to a public visitor.
 */

/** Staleness bound for a successful read. */
export const COMMUNITY_READ_TTL_MS = 60_000;
/** A failed read is remembered only this long, to avoid hammering on failure. */
export const COMMUNITY_READ_ERROR_TTL_MS = 5_000;

/** Cache key for the "how many public posts exist" total. */
export const COMMUNITY_TOTAL_KEY = "community:total";

interface SuccessEntry {
	kind: "value";
	value: unknown;
	expiresAt: number;
}

interface ErrorEntry {
	kind: "error";
	error: unknown;
	expiresAt: number;
}

type Entry = SuccessEntry | ErrorEntry;

const entries = new Map<string, Entry>();
const inFlight = new Map<string, Promise<unknown>>();

/** Test/benchmark hook: forget everything currently memoised. */
export function clearCommunityReadCache(): void {
	entries.clear();
	inFlight.clear();
}

/**
 * Read `key` from the cache, or run `loader` and memoise the result.
 *
 * Concurrent callers for the same key share a single `loader()` invocation.
 */
export function cachedCommunityRead<T>(
	key: string,
	loader: () => Promise<T>,
	ttlMs: number = COMMUNITY_READ_TTL_MS,
): Promise<T> {
	const now = Date.now();
	const hit = entries.get(key);
	if (hit) {
		if (hit.expiresAt > now) {
			return hit.kind === "value"
				? Promise.resolve(hit.value as T)
				: Promise.reject(hit.error);
		}
		entries.delete(key);
	}

	const pending = inFlight.get(key);
	if (pending) return pending as Promise<T>;

	const request = (async () => {
		try {
			const value = await loader();
			entries.set(key, { kind: "value", value, expiresAt: Date.now() + ttlMs });
			return value;
		} catch (error) {
			entries.set(key, {
				kind: "error",
				error,
				expiresAt: Date.now() + COMMUNITY_READ_ERROR_TTL_MS,
			});
			throw error;
		} finally {
			inFlight.delete(key);
		}
	})();

	inFlight.set(key, request);
	return request;
}

/**
 * Publish a total that was learned from any posts response, so a consumer that
 * only needs the count never has to issue its own request.
 */
export function publishCommunityTotal(total: number): void {
	if (!Number.isFinite(total)) return;
	entries.set(COMMUNITY_TOTAL_KEY, {
		kind: "value",
		value: total,
		expiresAt: Date.now() + COMMUNITY_READ_TTL_MS,
	});
}

/**
 * The public community post total, memoised.
 *
 * `loader` is only invoked when no fresh total is known — which includes the
 * case where a list request already published one.
 */
export function readCommunityTotal(
	loader: () => Promise<number>,
): Promise<number> {
	return cachedCommunityRead<number>(COMMUNITY_TOTAL_KEY, loader);
}
