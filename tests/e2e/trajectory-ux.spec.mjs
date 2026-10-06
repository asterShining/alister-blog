import { expect, test } from "@playwright/test";

test.describe("Trajectory + Article UX (when community is enabled)", () => {
  test.beforeEach(async ({ page }) => {
    // Check if community is enabled
    await page.goto("/");
    const filterCard = page.locator("#feed-filter-card");
    const count = await filterCard.count();
    if (count === 0) {
      test.skip(true, "Skipping tests because community is disabled in current build");
    }
  });

  test("homepage displays filter [全部 | 文章 | 轨迹] with default '全部' showing mixed cards", async ({
    page,
  }) => {
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

    // Verify filter buttons
    const btnAll = page.locator("#filter-btn-all");
    const btnArticle = page.locator("#filter-btn-article");
    const btnTrajectory = page.locator("#filter-btn-trajectory");

    await expect(btnAll).toBeVisible();
    await expect(btnArticle).toBeVisible();
    await expect(btnTrajectory).toBeVisible();
    await expect(btnAll).toHaveClass(/m3-chip--selected/);

    // Verify both article and trajectory cards exist in feed
    const articleCards = page.locator('#post-list [data-card-type="article"]');
    const trajectoryCards = page.locator('#post-list [data-card-type="trajectory"]');

    await expect(articleCards.first()).toBeVisible();
    await expect(trajectoryCards.first()).toBeVisible();

    // Verify badges
    const articleBadge = articleCards.first().locator(".m3-content-badge--article");
    await expect(articleBadge).toHaveText("文章");

    const trajectoryBadge = trajectoryCards.first().locator(".m3-content-badge--trajectory");
    await expect(trajectoryBadge).toHaveText("轨迹");

    // Verify trajectory card details
    const firstTraj = trajectoryCards.first();
    await expect(firstTraj.locator(".community-post-card__title")).toContainText("轨迹测试记录一");
    await expect(firstTraj.locator("strong")).toHaveText("第一条"); // rendered markdown
    await expect(firstTraj.locator(".community-post-card__more-link")).toHaveAttribute(
      "href",
      "/community/traj-test-1/"
    );

    // Test filtering by "文章"
    await btnArticle.click();
    await expect(btnArticle).toHaveClass(/m3-chip--selected/);
    await expect(btnAll).not.toHaveClass(/m3-chip--selected/);
    await expect(articleCards.first()).toBeVisible();
    await expect(trajectoryCards.first()).not.toBeVisible();

    // Test filtering by "轨迹"
    await btnTrajectory.click();
    await expect(btnTrajectory).toHaveClass(/m3-chip--selected/);
    await expect(btnArticle).not.toHaveClass(/m3-chip--selected/);
    await expect(trajectoryCards.first()).toBeVisible();
    await expect(articleCards.first()).not.toBeVisible();

    // Test returning to "全部"
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

    // Articles must still render normally
    const articleCards = page.locator('#post-list [data-card-type="article"]');
    await expect(articleCards.first()).toBeVisible();

    // Switch to trajectory filter when API fails
    const btnTrajectory = page.locator("#filter-btn-trajectory");
    await btnTrajectory.click();

    // Friendly notice shown, no uncaught crashes
    const notice = page.locator("#trajectory-status-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("暂无法获取轨迹数据");
  });

  test("SiteStats sidebar displays 轨迹 and updates count", async ({ page }) => {
    await page.route("**/api/v1/community/posts*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          data: { total: 3, posts: [] },
        }),
      });
    });

    await page.goto("/");
    const statItem = page.locator('[data-stat-trajectory]');
    await expect(statItem).toBeVisible();
    await expect(statItem).toHaveText("3");
  });

  test("responsive layout on mobile (390px) without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    // Verify filter buttons and cards fit within 390px
    const filterCard = page.locator("#feed-filter-card");
    await expect(filterCard).toBeVisible();

    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(isOverflowing).toBe(false);

    // Verify /posts/ on mobile
    await page.goto("/posts/");
    const postsOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(postsOverflowing).toBe(false);
  });
});

test.describe("Articles Page (/posts/) Visual Feed and Search View", () => {
  test("/posts/ defaults to visual article card feed with tabs to toggle search/archive view", async ({
    page,
  }) => {
    await page.goto("/posts/");

    // Check tab buttons
    const tabFeedBtn = page.locator("#tab-btn-feed");
    const tabSearchBtn = page.locator("#tab-btn-search");
    await expect(tabFeedBtn).toBeVisible();
    await expect(tabSearchBtn).toBeVisible();
    await expect(tabFeedBtn).toHaveClass(/m3-chip--selected/);

    // Verify visual article cards are shown by default
    const feedPanel = page.locator("#posts-feed-pane");
    const searchPanel = page.locator("#posts-search-pane");
    await expect(feedPanel).toBeVisible();
    await expect(searchPanel).not.toBeVisible();

    const articleCards = feedPanel.locator('[data-card-type="article"]');
    await expect(articleCards.first()).toBeVisible();

    // Switch to search/archive tab
    await tabSearchBtn.click();
    await expect(tabSearchBtn).toHaveClass(/m3-chip--selected/);
    await expect(tabFeedBtn).not.toHaveClass(/m3-chip--selected/);
    await expect(feedPanel).not.toBeVisible();
    await expect(searchPanel).toBeVisible();

    // Test ?tab=search directly selects search tab
    await page.goto("/posts/?tab=search");
    await expect(page.locator("#tab-btn-search")).toHaveClass(/m3-chip--selected/);
    await expect(page.locator("#posts-search-pane")).toBeVisible();
  });
});

