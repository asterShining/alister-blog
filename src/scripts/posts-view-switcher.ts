/**
 * /posts/ 视图切换器（文章 | 检索）的唯一状态同步与交互实现。
 *
 * 背景：这段逻辑原先写在 `src/pages/posts/index.astro` 的 `<script is:inline>` 里。
 * Astro 会把 `is:inline` 脚本原样输出到文档末尾（`</body></html>` 之后，位于
 * `#swup-container` 之外），所以它只在整页加载时执行一次：站内导航（Swup）进入
 * /posts/ 时，新文档片段里根本没有这段脚本，`onclick` 从未绑定——切换器“看得见、
 * 点不动”。Swup 只替换 `main` 容器内容，页面级交互因此必须挂在常驻脚本上。
 *
 * 状态收敛成一条链路，避免 URL / CSS / JS / dataset 各说各话：
 *   URL（唯一状态源）→ resolvePostsView() → applyPostsView()（唯一 DOM 写入者）
 * 点击只改写 URL 并立刻按 URL 重算，首屏与每次 Swup 切换则由
 * `page-scoped-chrome.ts` 的同一个同步入口调用 `syncPostsView()`。
 */
const POSTS_ROUTE = "/posts";
const TAB_ATTRIBUTE = "data-posts-tab";
/** 按钮 active 视觉：沿用原实现的类名，不改动视觉语言。 */
const TAB_ACTIVE_CLASS = "posts-segment-btn--active";
const TAB_SELECTED_CLASS = "m3-chip--selected";
const FEED_BUTTON_ID = "tab-btn-feed";
const SEARCH_BUTTON_ID = "tab-btn-search";
const FEED_PANE_ID = "posts-feed-pane";
const SEARCH_PANE_ID = "posts-search-pane";
/** 检索视图对应的 URL 参数（沿用原实现的判定，未新增规则）。 */
const SEARCH_QUERY_KEYS = ["tab", "category", "tag", "uncategorized"] as const;

export type PostsView = "feed" | "search";

let clickBound = false;

function normalizePathname(pathname: string): string {
	const normalized = pathname.replace(/\/+$/, "");
	return normalized === "" ? "/" : normalized;
}

/** URL → 视图：`?tab=search` 或分类 / 标签筛选参数都落到检索视图。 */
export function resolvePostsView(url: URL): PostsView {
	const params = url.searchParams;
	const isSearch =
		params.get("tab") === "search" ||
		params.has("category") ||
		params.has("tag") ||
		params.has("uncategorized");
	return isSearch ? "search" : "feed";
}

/** 视图 → DOM：active 按钮、aria-selected 与两个面板的显隐必须一次性对齐。 */
function applyPostsView(view: PostsView): void {
	const feedButton = document.getElementById(FEED_BUTTON_ID);
	const searchButton = document.getElementById(SEARCH_BUTTON_ID);
	const feedPane = document.getElementById(FEED_PANE_ID);
	const searchPane = document.getElementById(SEARCH_PANE_ID);
	if (!feedButton || !searchButton || !feedPane || !searchPane) return;

	const isSearch = view === "search";
	feedButton.classList.toggle(TAB_ACTIVE_CLASS, !isSearch);
	feedButton.classList.toggle(TAB_SELECTED_CLASS, !isSearch);
	feedButton.setAttribute("aria-selected", isSearch ? "false" : "true");
	searchButton.classList.toggle(TAB_ACTIVE_CLASS, isSearch);
	searchButton.classList.toggle(TAB_SELECTED_CLASS, isSearch);
	searchButton.setAttribute("aria-selected", isSearch ? "true" : "false");
	feedPane.classList.toggle("hidden", isSearch);
	searchPane.classList.toggle("hidden", !isSearch);
}

/**
 * 首屏与每次 Swup 切换后调用（与其它页面级 chrome 共用同一个同步入口）。
 * 这个切换器只属于 /posts/：其余路由（含 /posts/<slug>/ 详情页）直接跳过。
 */
export function syncPostsView(url: URL = new URL(window.location.href)): void {
	if (normalizePathname(url.pathname) !== POSTS_ROUTE) return;
	applyPostsView(resolvePostsView(url));
}

/**
 * 绑定一次点击委托（document 级，Swup 换掉按钮节点也不会失效）。
 * 点击只改 URL，再按 URL 重算视图；写入 history 时保留 Swup 的 state
 * （`popstate` 依赖 `state.source === "swup"`，不能像旧实现那样清空），只更新 url。
 */
export function bindPostsViewSwitcher(): void {
	if (clickBound) return;
	clickBound = true;

	document.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const trigger = target.closest<HTMLElement>(`[${TAB_ATTRIBUTE}]`);
		if (!trigger) return;

		const view: PostsView =
			trigger.getAttribute(TAB_ATTRIBUTE) === "search" ? "search" : "feed";
		const nextUrl = new URL(window.location.href);
		if (view === "search") {
			nextUrl.searchParams.set("tab", "search");
		} else {
			SEARCH_QUERY_KEYS.forEach((key) => nextUrl.searchParams.delete(key));
		}
		// 文章视图回到裸路径（与原实现一致）。
		const nextHref = view === "feed" ? nextUrl.pathname : nextUrl.toString();
		window.history.replaceState(
			{ ...window.history.state, url: nextHref, source: "swup" },
			"",
			nextHref,
		);
		applyPostsView(view);
	});
}
