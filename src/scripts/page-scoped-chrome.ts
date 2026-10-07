/**
 * 页面级公共 chrome 的单一同步入口（page-scoped chrome sync）。
 *
 * 背景：主题布局把「归档分类栏」静态渲染在 Swup 容器之外（见 CategoryBar.astro），
 * 页面切换时它不会自动重渲染；同时主题的导航高亮解析器不认识本站的 /posts/ 与
 * /community/ 两条路由。若各组件各写一段 pathname 判断，就会出现“组件 A 隐藏、
 * 组件 B 隐藏、组件 C 再切一刀”的碎片化状态。
 *
 * 因此这里收敛为一套逻辑 `syncPageScopedChrome()`：
 *   1. 归档分类栏只在 /archive/ 可见（其余页面一律不出现）；
 *   2. 顶部导航高亮补齐 /posts/ → 文章、/community/ → 轨迹（主题解析器其余部分照旧）；
 *   3. /posts/ 的「文章 | 检索」视图切换按 URL 复位（见 posts-view-switcher.ts：
 *      该页面的 `<script is:inline>` 位于 Swup 容器之外，站内导航进入时不会执行）。
 *
 * 执行时机：首屏一次 + 每次 Swup 页面切换（`swup:content:replace` / `swup:page:view`）
 * + 浏览器前进后退（`popstate`），全部走同一个函数。
 *
 * 注意：本模块由 `astro.config.mjs` 以 `injectScript("page", …)` 注入到每个页面。
 */
import { resolvePageKey } from "@utils/nav-utils";
import { bindPostsViewSwitcher, syncPostsView } from "./posts-view-switcher";
import "./friend-self-link";
import "./post-comments";

const CATEGORY_BAR_REGION_ID = "category-bar-region";
/** 归档分类栏唯一可见的页面（去尾斜杠形式）。 */
const CATEGORY_BAR_ROUTE = "/archive";
/** 主题解析器覆盖不到的站内一级路由 → pageKey（精确匹配，子页面维持主题行为）。 */
const EXTRA_ROUTE_KEYS: ReadonlyArray<readonly [string, string]> = [
	["/posts", "posts"],
	["/community", "community"],
	["/tags", "tags"],
];
/** 需要本模块补高亮的 pageKey（由路由表派生，避免两处清单走散）。 */
const EXTRA_NAV_KEYS: ReadonlySet<string> = new Set(
	EXTRA_ROUTE_KEYS.map(([, key]) => key),
);
/** 本模块自己写过的 active 标记，便于下一次同步先回到主题状态。 */
const PATCH_MARKER = "chromeNavActive";

function normalizePathname(pathname: string): string {
	const normalized = pathname.replace(/\/+$/, "");
	return normalized === "" ? "/" : normalized;
}

/**
 * 当前 URL → 导航高亮标识。
 * 主题解析器（首页 / 归档 / 友链 / 关于 / 标签筛选 / 分类筛选 / 相册 …）负责绝大部分，
 * 这里只补它不认识的 /posts/、/community/、/tags/ 三个一级页面。
 */
export function resolveChromePageKey(url: URL): string {
	const pathname = normalizePathname(url.pathname);
	for (const [route, key] of EXTRA_ROUTE_KEYS) {
		if (pathname === route) return key;
	}
	return resolvePageKey(url);
}

/** 归档分类栏（文章分类 / 归档 UI）：只有归档视图拥有它。 */
function syncCategoryBarRegion(pathname: string): void {
	const region = document.getElementById(CATEGORY_BAR_REGION_ID);
	if (!region) return;
	region.classList.toggle("hidden", pathname !== CATEGORY_BAR_ROUTE);
}

function clearPatchedActive(root: ParentNode, activeClass: string): void {
	root.querySelectorAll<HTMLElement>(`[data-${PATCH_MARKER}]`).forEach((el) => {
		el.classList.remove(activeClass);
		el.removeAttribute("aria-current");
		el.removeAttribute(`data-${PATCH_MARKER}`);
	});
}

function markActive(el: HTMLElement, activeClass: string): void {
	el.classList.add(activeClass);
	el.setAttribute("aria-current", "page");
	el.setAttribute(`data-${PATCH_MARKER}`, "true");
}

/** 顶部主导航（TopAppBar）：补齐主题解析器点不亮的入口。 */
function syncTopAppBarActive(pageKey: string): void {
	const bar = document.getElementById("navbar");
	if (!bar) return;
	clearPatchedActive(bar, "top-app-bar__nav-link--active");
	if (!EXTRA_NAV_KEYS.has(pageKey)) return;

	const link = bar.querySelector<HTMLElement>(`[data-nav-key="${pageKey}"]`);
	if (link) markActive(link, "top-app-bar__nav-link--active");
}

/**
 * 移动端导航抽屉：Svelte 岛由主题解析器驱动，这里只补同一批入口。
 * 用主导航链接的 href 反查抽屉条目，避免再维护一份路由表。
 */
function syncNavigationDrawerActive(pageKey: string): void {
	const drawer = document.querySelector<HTMLElement>(".site-drawer");
	if (!drawer) return;
	clearPatchedActive(drawer, "site-drawer__item--active");
	if (!EXTRA_NAV_KEYS.has(pageKey)) return;

	const navHref = document
		.querySelector<HTMLAnchorElement>(`#navbar [data-nav-key="${pageKey}"]`)
		?.getAttribute("href");
	if (!navHref) return;
	const target = normalizePathname(new URL(navHref, window.location.origin).pathname);

	const item = Array.from(
		drawer.querySelectorAll<HTMLAnchorElement>("a.site-drawer__item"),
	).find((anchor) => normalizePathname(new URL(anchor.href).pathname) === target);
	if (item) markActive(item, "site-drawer__item--active");
}

/** 页面级公共 chrome 的唯一同步函数：首屏与每次 Swup 切换都执行它。 */
export function syncPageScopedChrome(url: URL = new URL(window.location.href)): void {
	const pathname = normalizePathname(url.pathname);
	syncCategoryBarRegion(pathname);
	const pageKey = resolveChromePageKey(url);
	syncTopAppBarActive(pageKey);
	syncNavigationDrawerActive(pageKey);
	syncPostsView(url);
}

/**
 * 主题的 TopAppBar / 抽屉脚本在同一批 Swup 事件里同步（谁先注册不确定），
 * 因此立即执行一次之外，再在同一次事件循环末尾补执行一次，
 * 保证本模块的补充结论不会被主题脚本随后覆盖。
 */
function schedulePageScopedChrome(): void {
	syncPageScopedChrome();
	window.setTimeout(() => syncPageScopedChrome(), 0);
}

/** 点击委托只绑一次，Swup 之后换掉的按钮节点照样命中（事件委托在 document 上）。 */
bindPostsViewSwitcher();

schedulePageScopedChrome();
window.addEventListener("load", schedulePageScopedChrome);

document.addEventListener("swup:content:replace", schedulePageScopedChrome);
document.addEventListener("swup:page:view", schedulePageScopedChrome);
window.addEventListener("popstate", schedulePageScopedChrome);
