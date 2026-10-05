import { expect, test } from "@playwright/test";

test("@smoke main content routes render from the production build", async ({ page }) => {
	await page.goto("/");
	await expect(page).toHaveTitle(/Alister/);
	await expect(page.locator(".banner-stage__copy h1")).toHaveText("Alister's Blog");
	await expect(page.locator('a[href="/posts/hello-alister-blog/"]:visible').first()).toBeVisible();

	await page.goto("/posts/hello-alister-blog/");
	await expect(page.getByText("Alister Blog，开始记录", { exact: true }).first()).toBeVisible();

	await page.goto("/archive/");
	await expect(page.locator('a[href="/posts/hello-alister-blog/"]:visible').first()).toBeVisible();

	await page.goto("/tags/");
	await expect(page.locator(".tag-index__chip:visible").filter({ hasText: "Astro" })).toBeVisible();

	await page.goto("/friends/");
	await expect(page.locator(".page-header__subtitle")).toHaveText("友链正在整理中，欢迎稍后再来看看。");

	await page.goto("/about/");
	await expect(page.getByText("Summer Blue 与 Starry Night", { exact: false })).toBeVisible();
});

test("@smoke Swup navigation keeps the selected dark skin", async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("theme", "dark"));
	await page.goto("/");
	await expect(page.locator("html")).toHaveClass(/dark/);
	const documentStart = await page.evaluate(() => performance.timeOrigin);

	await page.locator('a[href="/archive/"]:visible').first().click();
	await expect(page).toHaveURL(/\/archive\/$/);
	await page.locator('a[href="/tags/"]:visible').first().click();
	await expect(page).toHaveURL(/\/tags\/$/);

	expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart);
	await expect(page.locator("html")).toHaveClass(/dark/);
	await expect(page.locator("body")).toHaveCSS("background-color", "rgb(5, 11, 29)");
});
