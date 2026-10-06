import { expect, test } from "@playwright/test";

/**
 * 页面级 UI 归属 + Swup 导航回归。
 *
 * 冻结的归属关系（改动前先读这里）：
 * - 首页            → Homepage Content Type Filter（全部 | 文章 | 轨迹）
 * - /posts/         → Posts View Switcher（文章 | 检索）
 * - /community/     → 轨迹独立页（不带任何筛选栏）
 * - /archive/       → 归档页自己的“首页 | 归档 + 文章分类”栏
 * - /friends/ /about/ /tags/ /posts/<slug>/ → 不出现以上任何一种
 */

const CONTENT_TYPE_FILTER = "#content-type-filter-card";
const CONTENT_TYPE_BUTTONS = "#feed-filter-card .feed-filter-btn";
const CATEGORY_BAR_REGION = "#category-bar-region";
const POSTS_VIEW_SWITCH = "#posts-view-switch";
const POSTS_FEED_PANE = "#posts-feed-pane";
const POSTS_SEARCH_PANE = "#posts-search-pane";

const CTF_LABELS = ["全部", "文章", "轨迹"];

async function isCommunityEnabled(page) {
	await page.goto("/");
	return (
		(await page.locator('#post-page-config[data-community-enabled="true"]').count()) > 0
	);
}

async function waitForSwup(page) {
	await page.waitForFunction(() => Boolean(window.swup));
}

async function enterViaSwup(page, navKey) {
	await waitForSwup(page);
	const documentStart = await page.evaluate(() => performance.timeOrigin);
	await page.locator(`#navbar [data-nav-key="${navKey}"]`).first().click();
	return documentStart;
}

async function expectStillClientSide(page, documentStart) {
	expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart);
}

async function expectHomepageFilter(page) {
	const filter = page.locator(CONTENT_TYPE_FILTER);
	await expect(filter).toBeVisible();

	const buttons = filter.locator(".feed-filter-btn");
	await expect(buttons).toHaveCount(3);
	for (const [index, label] of CTF_LABELS.entries()) {
		await expect(buttons.nth(index)).toHaveText(label);
	}

	// 首页一级筛选里不得混入站点导航或文章分类
	await expect(filter.locator(".category-filter-btn")).toHaveCount(0);
	const text = await filter.innerText();
	for (const leaked of ["首页", "归档", "日常", "检索"]) {
		expect(text).not.toContain(leaked);
	}
}

async function expectNoPageChrome(page) {
	await expect(page.locator(CONTENT_TYPE_FILTER)).toHaveCount(0);
	await expect(page.locator(POSTS_VIEW_SWITCH)).toHaveCount(0);
	await expect(page.locator(CATEGORY_BAR_REGION)).not.toBeVisible();
}

async function expectNavActive(page, pageKey) {
	const link = page.locator(`#navbar [data-nav-key="${pageKey}"]`).first();
	await expect(link).toHaveClass(/top-app-bar__nav-link--active/);
	await expect(link).toHaveAttribute("aria-current", "page");

	for (const other of ["home", "posts", "community", "tags", "archive", "friends", "about"]) {
		if (other === pageKey) continue;
		// 功能关闭时对应入口会被导航裁剪，跳过即可
		const otherLink = page.locator(`#navbar [data-nav-key="${other}"]`);
		if ((await otherLink.count()) === 0) continue;
		await expect(otherLink.first()).not.toHaveClass(/top-app-bar__nav-link--active/);
	}
}

test.describe("Homepage Content Type Filter (全部 | 文章 | 轨迹)", () => {
	test("homepage owns exactly 全部/文章/轨迹 with 全部 active", async ({ page }) => {
		await page.goto("/");
		await expectHomepageFilter(page);
		await expect(page.locator(CONTENT_TYPE_BUTTONS).nth(0)).toHaveClass(/m3-chip--selected/);
		await expect(page.locator(CONTENT_TYPE_BUTTONS).nth(0)).toHaveAttribute(
			"aria-selected",
			"true",
		);
		// 归档分类栏不属于首页
		await expect(page.locator(CATEGORY_BAR_REGION)).not.toBeVisible();
	});

	test("ordinary pages own no homepage filter and no category bar", async ({ page }) => {
		for (const route of ["/friends/", "/about/", "/tags/", "/posts/hello-alister-blog/"]) {
			await page.goto(route);
			await expect(page.locator(CONTENT_TYPE_FILTER)).toHaveCount(0);
			await expect(page.locator(CATEGORY_BAR_REGION)).not.toBeVisible();
			await expect(page.locator(POSTS_VIEW_SWITCH)).toHaveCount(0);
		}
	});

	test("archive owns the article category bar only", async ({ page }) => {
		await page.goto("/archive/");
		await expect(page.locator(CONTENT_TYPE_FILTER)).toHaveCount(0);
		await expect(page.locator(POSTS_VIEW_SWITCH)).toHaveCount(0);

		const region = page.locator(CATEGORY_BAR_REGION);
		await expect(region).toBeVisible();
		await expect(region.locator('a[href$="/archive/"]')).toBeVisible();
		await expect(region.locator("#category-bar-categories a").first()).toBeVisible();
	});

	// 磨砂玻璃辅助条：只断言稳定结构语义（容器 / 间距 / active / 计数 badge），不做像素级比较。
	test("archive category bar keeps its frosted-glass structure", async ({ page }) => {
		await page.goto("/archive/");

		const bar = page.locator("#category-bar");
		await expect(bar).toBeVisible();

		const glass = await bar.evaluate((el) => {
			const s = getComputedStyle(el);
			return {
				background: s.backgroundColor,
				blur: s.backdropFilter || s.webkitBackdropFilter,
				borderWidth: s.borderTopWidth,
				shadow: s.boxShadow,
				radius: s.borderRadius,
			};
		});
		expect(glass.background).not.toBe("rgba(0, 0, 0, 0)");
		expect(glass.blur).not.toBe("none");
		expect(glass.borderWidth).toBe("1px");
		expect(glass.shadow).not.toBe("none");
		expect(glass.radius).not.toBe("0px");

		// 条目由 flex gap 分隔（不是零散 margin），且 active 有非颜色语义
		const gap = await bar
			.locator(".category-bar-links")
			.evaluate((el) => getComputedStyle(el).gap);
		expect(Number.parseFloat(gap)).toBeGreaterThan(0);

		const activeItem = bar.locator(".category-bar__item--active");
		await expect(activeItem).toHaveCount(1);
		await expect(activeItem).toHaveText("归档");
		await expect(activeItem).toHaveAttribute("aria-current", "page");
		await expect(bar.locator(".category-bar__item").first()).toHaveClass(
			/category-bar__item/,
		);

		// 计数 badge：独立节点、真实 count、与标签有明确间距
		const badge = bar.locator(".category-bar__count").first();
		await expect(badge).toBeVisible();
		await expect(badge).toHaveText(/^\d+$/);
		const badgeGap = await badge.evaluate((el) => {
			const label = el.previousElementSibling;
			return label
				? el.getBoundingClientRect().left - label.getBoundingClientRect().right
				: 0;
		});
		expect(badgeGap).toBeGreaterThanOrEqual(4);
	});

	test("/posts/ owns the 文章 | 检索 segmented control only", async ({ page }) => {
		await page.goto("/posts/");
		await expect(page.locator(CONTENT_TYPE_FILTER)).toHaveCount(0);
		await expect(page.locator(CATEGORY_BAR_REGION)).not.toBeVisible();

		const switcher = page.locator(POSTS_VIEW_SWITCH);
		await expect(switcher).toBeVisible();
		const feedTab = page.locator("#tab-btn-feed");
		const searchTab = page.locator("#tab-btn-search");
		await expect(feedTab).toHaveClass(/posts-segment-btn--active/);
		await expect(page.locator(POSTS_FEED_PANE)).toBeVisible();

		await searchTab.click();
		await expect(searchTab).toHaveClass(/posts-segment-btn--active/);
		await expect(feedTab).not.toHaveClass(/posts-segment-btn--active/);
		await expect(page.locator(POSTS_SEARCH_PANE)).toBeVisible();
		await expect(page.locator(POSTS_FEED_PANE)).not.toBeVisible();
	});
});

/** /posts/ 当前视图：active 按钮、aria-selected、两个面板的显隐必须完全一致。 */
async function expectPostsView(page, view) {
	const isSearch = view === "search";
	const feedTab = page.locator("#tab-btn-feed");
	const searchTab = page.locator("#tab-btn-search");

	if (isSearch) {
		await expect(searchTab).toHaveClass(/posts-segment-btn--active/);
		await expect(feedTab).not.toHaveClass(/posts-segment-btn--active/);
		await expect(searchTab).toHaveAttribute("aria-selected", "true");
		await expect(feedTab).toHaveAttribute("aria-selected", "false");
		await expect(page.locator(POSTS_SEARCH_PANE)).toBeVisible();
		await expect(page.locator(POSTS_FEED_PANE)).not.toBeVisible();
	} else {
		await expect(feedTab).toHaveClass(/posts-segment-btn--active/);
		await expect(searchTab).not.toHaveClass(/posts-segment-btn--active/);
		await expect(feedTab).toHaveAttribute("aria-selected", "true");
		await expect(searchTab).toHaveAttribute("aria-selected", "false");
		await expect(page.locator(POSTS_FEED_PANE)).toBeVisible();
		await expect(page.locator(POSTS_SEARCH_PANE)).not.toBeVisible();
	}
}

/**
 * 切换器交互回归。
 *
 * 曾经的 BUG：切换逻辑写在 posts 页面的 `<script is:inline>` 里，Astro 把它输出到
 * 文档末尾（Swup 容器之外），站内导航进入 /posts/ 时这段脚本不会执行，按钮因此
 * “看得见、点不动”——所以这里的断言一律要求 click 前/后 active 与面板显隐同时变化，
 * 不允许只断言“检索文字存在”。
 */
test.describe("Posts view switcher interaction (文章 | 检索)", () => {
	test("Case 1/2: direct /posts/ switches both ways and keeps the URL in sync", async ({
		page,
	}) => {
		await page.goto("/posts/");
		await expect(page).toHaveURL(/\/posts\/$/);
		await expectPostsView(page, "feed");

		await page.locator("#tab-btn-search").click();
		await expectPostsView(page, "search");
		await expect(page).toHaveURL(/\/posts\/\?tab=search$/);

		await page.locator("#tab-btn-feed").click();
		await expectPostsView(page, "feed");
		await expect(page).toHaveURL(/\/posts\/$/);
	});

	test("Case 3: entering /posts/ through Swup keeps the switcher interactive", async ({
		page,
	}) => {
		await page.goto("/");
		const start = await enterViaSwup(page, "posts");
		await expect(page).toHaveURL(/\/posts\/$/);
		await expectStillClientSide(page, start);
		await expectPostsView(page, "feed");

		await page.locator("#tab-btn-search").click();
		await expectPostsView(page, "search");
		await expect(page).toHaveURL(/\/posts\/\?tab=search$/);
	});

	test("Case 4/6: 检索 → 友链 → Back restores 检索, Forward returns to 友链", async ({
		page,
	}) => {
		await page.goto("/posts/");
		await page.locator("#tab-btn-search").click();
		await expectPostsView(page, "search");

		await enterViaSwup(page, "friends");
		await expect(page).toHaveURL(/\/friends\/$/);

		await page.goBack();
		await expect(page).toHaveURL(/\/posts\/\?tab=search$/);
		await expectPostsView(page, "search");

		await page.goForward();
		await expect(page).toHaveURL(/\/friends\/$/);
	});

	test("Case 5: ?tab=search and ?tag= open the search view directly", async ({ page }) => {
		await page.goto("/posts/?tab=search");
		await expectPostsView(page, "search");

		await page.goto("/posts/?tag=e2e");
		await expectPostsView(page, "search");
	});

	test("Case 10: ArchivePanel 的按年份 / 按分类 / 按标签 都能切换", async ({ page }) => {
		await page.goto("/posts/");
		await page.locator("#tab-btn-search").click();

		const panel = page.locator(`${POSTS_SEARCH_PANE} .archive-panel`);
		await expect(panel).toBeVisible();
		await expect(panel.locator(".m3-blog-archive__group-title").first()).toBeVisible();

		const checked = page.locator(".archive-panel .m3-segmented__input:checked");
		expect(await checked.inputValue()).toBe("year");

		await panel.locator('.m3-segmented__segment:has(input[value="category"])').click();
		expect(await checked.inputValue()).toBe("category");

		await panel.locator('.m3-segmented__segment:has(input[value="tag"])').click();
		expect(await checked.inputValue()).toBe("tag");
		await expect(panel.locator(".m3-blog-archive__group-title").first()).toContainText("#");

		await panel.locator('.m3-segmented__segment:has(input[value="year"])').click();
		expect(await checked.inputValue()).toBe("year");
	});

	test("Case 10b: Swup 进入后检索面板内部依然可用", async ({ page }) => {
		await page.goto("/");
		await enterViaSwup(page, "posts");
		await page.locator("#tab-btn-search").click();

		const panel = page.locator(`${POSTS_SEARCH_PANE} .archive-panel`);
		await expect(panel).toBeVisible();
		await panel.locator('.m3-segmented__segment:has(input[value="category"])').click();
		expect(await page.locator(".archive-panel .m3-segmented__input:checked").inputValue()).toBe(
			"category",
		);
		await expect(panel.locator(".m3-blog-archive__group-title").first()).toBeVisible();
	});

	test("keyboard: both segments are focusable and activate with Enter / Space", async ({
		page,
	}) => {
		await page.goto("/posts/");

		await page.locator("#tab-btn-search").focus();
		await page.keyboard.press("Enter");
		await expectPostsView(page, "search");

		await page.locator("#tab-btn-feed").focus();
		await page.keyboard.press("Space");
		await expectPostsView(page, "feed");
	});
});

test.describe("Top navigation active state", () => {
	test("direct visits light the matching entry", async ({ page }) => {
		const routes = [
			["/", "home"],
			["/posts/", "posts"],
			["/archive/", "archive"],
			["/friends/", "friends"],
			["/about/", "about"],
			["/tags/", "tags"],
		];
		for (const [route, key] of routes) {
			await page.goto(route);
			await expectNavActive(page, key);
		}
	});

	test("active state follows Swup navigation", async ({ page }) => {
		await page.goto("/");
		await expectNavActive(page, "home");

		let start = await enterViaSwup(page, "archive");
		await expect(page).toHaveURL(/\/archive\/$/);
		await expectNavActive(page, "archive");
		await expectStillClientSide(page, start);

		start = await enterViaSwup(page, "posts");
		await expect(page).toHaveURL(/\/posts\/$/);
		await expectNavActive(page, "posts");
		await expectStillClientSide(page, start);

		start = await enterViaSwup(page, "friends");
		await expect(page).toHaveURL(/\/friends\/$/);
		await expectNavActive(page, "friends");
		await expectStillClientSide(page, start);

		start = await enterViaSwup(page, "home");
		await expect(page).toHaveURL(/\/$/);
		await expectNavActive(page, "home");
		await expectStillClientSide(page, start);
	});

	test("mobile drawer mirrors the top navigation and highlights correctly (390px)", async ({
		page,
	}) => {
		const community = await isCommunityEnabled(page);
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto("/posts/");

		await page.locator("#nav-drawer-switch").click();
		const items = page.locator("a.site-drawer__item");
		// hydration 不得裁剪构建期已启用的入口（曾出现：SSR 有轨迹、水合后消失）
		expect(await items.allInnerTexts()).toEqual(
			community
				? ["首页", "文章", "轨迹", "标签", "归档", "友链", "关于"]
				: ["首页", "文章", "标签", "归档", "友链", "关于"],
		);

		const activeItem = page.locator("a.site-drawer__item.site-drawer__item--active");
		await expect(activeItem).toHaveCount(1);
		await expect(activeItem).toHaveText(/文章/);
		await expect(activeItem).toHaveAttribute("aria-current", "page");

		if (community) {
			await items.filter({ hasText: "轨迹" }).click();
			await expect(page).toHaveURL(/\/community\/$/);
			await page.locator("#nav-drawer-switch").click();
			const trajectoryItem = page.locator(
				'a.site-drawer__item.site-drawer__item--active',
			);
			await expect(trajectoryItem).toHaveCount(1);
			await expect(trajectoryItem).toHaveText(/轨迹/);
		}
	});
});

test.describe("Swup page scope regression chains", () => {
	test("A: archive → home keeps the homepage filter", async ({ page }) => {
		await page.goto("/archive/");
		await expect(page.locator(CATEGORY_BAR_REGION)).toBeVisible();

		const start = await enterViaSwup(page, "home");
		await expect(page).toHaveURL(/\/$/);
		await expectStillClientSide(page, start);

		await expectHomepageFilter(page);
		await expect(page.locator(CONTENT_TYPE_BUTTONS).nth(0)).toHaveClass(/m3-chip--selected/);
		await expect(page.locator(CATEGORY_BAR_REGION)).not.toBeVisible();
	});

	test("B/C: home → friends → home leaks nothing and comes back clean", async ({ page }) => {
		await page.goto("/");
		await expectHomepageFilter(page);

		let start = await enterViaSwup(page, "friends");
		await expect(page).toHaveURL(/\/friends\/$/);
		await expectStillClientSide(page, start);
		await expectNoPageChrome(page);

		start = await enterViaSwup(page, "home");
		await expect(page).toHaveURL(/\/$/);
		await expectStillClientSide(page, start);
		await expectHomepageFilter(page);
		await expect(page.locator(CONTENT_TYPE_BUTTONS).nth(0)).toHaveClass(/m3-chip--selected/);
	});

	test("D: home → about → home stays correct", async ({ page }) => {
		await page.goto("/");
		let start = await enterViaSwup(page, "about");
		await expect(page).toHaveURL(/\/about\/$/);
		await expectStillClientSide(page, start);
		await expectNoPageChrome(page);

		start = await enterViaSwup(page, "home");
		await expect(page).toHaveURL(/\/$/);
		await expectStillClientSide(page, start);
		await expectHomepageFilter(page);
	});

	test("E: home → posts → trajectory → friends → home keeps every page honest", async ({
		page,
	}) => {
		const community = await isCommunityEnabled(page);
		const start = await enterViaSwup(page, "posts");
		await expect(page).toHaveURL(/\/posts\/$/);
		await expectStillClientSide(page, start);
		await expect(page.locator(POSTS_VIEW_SWITCH)).toBeVisible();
		await expect(page.locator(CONTENT_TYPE_FILTER)).toHaveCount(0);
		await expectNavActive(page, "posts");

		if (community) {
			const toTrajectory = await enterViaSwup(page, "community");
			await expect(page).toHaveURL(/\/community\/$/);
			await expectStillClientSide(page, toTrajectory);
			await expect(page.locator(".community-page h1")).toContainText("轨迹");
			await expect(page.locator(CONTENT_TYPE_FILTER)).toHaveCount(0);
			await expect(page.locator(POSTS_VIEW_SWITCH)).toHaveCount(0);
			await expectNavActive(page, "community");
		}

		const toFriends = await enterViaSwup(page, "friends");
		await expect(page).toHaveURL(/\/friends\/$/);
		await expectStillClientSide(page, toFriends);
		await expectNoPageChrome(page);
		await expectNavActive(page, "friends");

		const toHome = await enterViaSwup(page, "home");
		await expect(page).toHaveURL(/\/$/);
		await expectStillClientSide(page, toHome);
		await expectHomepageFilter(page);
		await expectNavActive(page, "home");
	});
});

test.describe("Trajectory page (/community/)", () => {
	test("is an independent page without homepage or posts chrome", async ({ page }) => {
		test.skip(!(await isCommunityEnabled(page)), "community is disabled in this build");

		await page.goto("/community/");
		await expect(page.locator(".community-page h1")).toContainText("轨迹");
		await expect(page.locator(CONTENT_TYPE_FILTER)).toHaveCount(0);
		await expect(page.locator(POSTS_VIEW_SWITCH)).toHaveCount(0);
		await expect(page.locator(CATEGORY_BAR_REGION)).not.toBeVisible();
		await expectNavActive(page, "community");
	});
});

test.describe("Trajectory + Article feed (when community is enabled)", () => {
	test.beforeEach(async ({ page }) => {
		test.skip(!(await isCommunityEnabled(page)), "community is disabled in this build");
	});

	test("homepage filter defaults to 全部 and switches article / trajectory", async ({ page }) => {
		await page.route("**/api/v1/community/posts*", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					code: 0,
					data: {
						total: 2,
						posts: [
							{
								id: "traj-1",
								slug: "traj-test-1",
								title: "轨迹测试记录一",
								content: "这是**第一条**动态轨迹内容。",
								author: { name: "Alister", avatar: "/images/profile/avatar.webp" },
								createdAt: "2026-10-06T15:00:00Z",
								images: [],
							},
							{
								id: "traj-2",
								slug: "traj-test-2",
								title: "轨迹测试记录二",
								content: "这是带有图片的动态轨迹。",
								author: { name: "Alister", avatar: "/images/profile/avatar.webp" },
								createdAt: "2026-10-04T10:00:00Z",
								images: [{ url: "/images/moments/scenery/scene-1.webp", alt: "风景" }],
							},
						],
					},
				}),
			});
		});

		await page.goto("/");
		await expectHomepageFilter(page);

		const btnAll = page.locator("#filter-btn-all");
		const btnArticle = page.locator("#filter-btn-article");
		const btnTrajectory = page.locator("#filter-btn-trajectory");
		await expect(btnAll).toHaveClass(/m3-chip--selected/);

		const articleCards = page.locator('#post-list [data-card-type="article"]');
		const trajectoryCards = page.locator('#post-list [data-card-type="trajectory"]');
		await expect(articleCards.first()).toBeVisible();
		await expect(trajectoryCards.first()).toBeVisible();

		await expect(articleCards.first().locator(".m3-content-badge--article")).toHaveText("文章");
		await expect(trajectoryCards.first().locator(".m3-content-badge--trajectory")).toHaveText(
			"轨迹",
		);
		await expect(trajectoryCards.first().locator(".community-post-card__more-link")).toHaveAttribute(
			"href",
			"/community/traj-test-1/",
		);

		await btnArticle.click();
		await expect(btnArticle).toHaveClass(/m3-chip--selected/);
		await expect(btnAll).not.toHaveClass(/m3-chip--selected/);
		await expect(articleCards.first()).toBeVisible();
		await expect(trajectoryCards.first()).not.toBeVisible();

		await btnTrajectory.click();
		await expect(btnTrajectory).toHaveClass(/m3-chip--selected/);
		await expect(trajectoryCards.first()).toBeVisible();
		await expect(articleCards.first()).not.toBeVisible();

		await btnAll.click();
		await expect(btnAll).toHaveClass(/m3-chip--selected/);
		await expect(articleCards.first()).toBeVisible();
		await expect(trajectoryCards.first()).toBeVisible();
	});

	test("API error degrades gracefully without breaking article feed", async ({ page }) => {
		await page.route("**/api/v1/community/posts*", async (route) => {
			await route.fulfill({
				status: 500,
				contentType: "application/json",
				body: JSON.stringify({ code: 500, message: "Internal server error" }),
			});
		});

		await page.goto("/");
		const articleCards = page.locator('#post-list [data-card-type="article"]');
		await expect(articleCards.first()).toBeVisible();

		await page.locator("#filter-btn-trajectory").click();
		const notice = page.locator("#trajectory-status-notice");
		await expect(notice).toBeVisible();
		await expect(notice).toContainText("暂无法获取轨迹数据");
	});

	test("SiteStats sidebar displays 轨迹 and updates count", async ({ page }) => {
		await page.route("**/api/v1/community/posts*", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ code: 0, data: { total: 3, posts: [] } }),
			});
		});

		await page.goto("/");
		const statItem = page.locator("[data-stat-trajectory]");
		await expect(statItem).toBeVisible();
		await expect(statItem).toHaveText("3");
	});
});

test.describe("Responsive page scope", () => {
	for (const [width, height] of [
		[390, 844],
		[768, 1024],
		[1440, 900],
	]) {
		test(`no horizontal overflow at ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height });
			for (const route of ["/", "/posts/", "/archive/", "/friends/"]) {
				await page.goto(route);
				const overflowing = await page.evaluate(
					() => document.documentElement.scrollWidth > window.innerWidth,
				);
				expect(overflowing, `${route} overflows at ${width}px`).toBe(false);
			}
		});
	}
});
