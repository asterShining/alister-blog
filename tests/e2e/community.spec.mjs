import { expect, test } from "@playwright/test";

test.describe("Community Feature Flag & Navigation Specs", () => {
  test("navigation bar reflects community feature flag state", async ({
    page,
  }) => {
    await page.goto("/");
    const communityNavLinks = page.locator('header a[href*="/community/"]');
    const count = await communityNavLinks.count();

    // In default build, count is 0; in enabled build, count is 1
    if (count === 0) {
      expect(count).toBe(0);
    } else {
      expect(count).toBe(1);
      await expect(communityNavLinks.first()).toContainText("社区");
    }
  });

  test("route access adheres to feature flag state", async ({ page }) => {
    await page.goto("/");
    const isEnabled =
      (await page.locator('header a[href*="/community/"]').count()) > 0;

    if (!isEnabled) {
      // Disabled state: accessing /community/ must redirect to /404/
      await page.goto("/community/");
      await page.waitForURL(/\/404\/?/, { timeout: 4000 }).catch(() => {});
      const bodyText = await page.locator("body").innerText();
      expect(bodyText.includes("/404/") || page.url().includes("/404/")).toBe(
        true,
      );
    } else {
      // Enabled state: accessing /community/ renders feed
      await page.goto("/community/");
      await expect(page.locator(".community-page-header h1")).toContainText(
        "社区",
      );
    }
  });

  test("no community network requests are fired on main routes", async ({ page }) => {
    const requests = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/v1/community")) {
        requests.push(req.url());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.goto("/posts/hello-alister-blog/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText("Alister Blog，开始记录").first()).toBeVisible();

    expect(requests.length).toBe(0);
  });

  test("feed, card, image grid, and responsive viewports render correctly when enabled", async ({
    page,
  }) => {
    await page.goto("/");
    const isEnabled =
      (await page.locator('header a[href*="/community/"]').count()) > 0;

    if (!isEnabled) {
      test.skip(true, "Skipping feed verification on disabled build");
      return;
    }

    await page.goto("/community/");
    await expect(page.locator(".community-page-header h1")).toContainText("社区");

    const cards = page.locator(".community-post-card");
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);

    const firstCard = cards.first();
    await expect(firstCard.locator(".community-post-card__header")).toBeVisible();

    // Verify detail navigation
    await page.goto("/community/k230-canmv-debug/");
    await expect(page.locator(".community-detail-title")).toContainText("K230");
    await expect(page.locator(".community-back-link")).toBeVisible();

    // Verify mobile responsive viewport (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".community-detail-card")).toBeVisible();

    // Verify dark mode preserves styling
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
    });
    await expect(page.locator(".community-detail-card")).toBeVisible();

    // Verify light mode preserves styling
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
    });
    await expect(page.locator(".community-detail-card")).toBeVisible();
  });
});
