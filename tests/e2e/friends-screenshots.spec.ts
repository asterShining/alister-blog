import { test } from "@playwright/test";

test("Capture Friends screenshots across themes and viewports", async ({ page, context }) => {
	try {
		await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	} catch {}

	// 1. Starry (Dark) 1440
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.addInitScript(() => {
		localStorage.setItem("theme", "dark");
	});
	await page.goto("/friends/");
	await page.waitForSelector("friend-self-link");
	await page.waitForTimeout(600);
	await page.screenshot({ path: "artifacts/friends/friends-starry-1440.png" });

	// Card zoom before copy
	const card = page.locator("friend-self-link");
	await card.screenshot({ path: "artifacts/friends/friends-copy-before.png" });

	// Click copy button -> Card zoom success state
	await page.locator("friend-self-link [data-copy-btn]").click();
	await page.waitForTimeout(250);
	await card.screenshot({ path: "artifacts/friends/friends-copy-success.png" });

	// 2. Summer (Light) 1440
	await page.addInitScript(() => {
		localStorage.setItem("theme", "light");
	});
	await page.goto("/friends/");
	await page.evaluate(() => {
		localStorage.setItem("theme", "light");
		document.documentElement.classList.remove("dark");
		document.documentElement.setAttribute("data-theme", "github-light");
		window.dispatchEvent(new CustomEvent("shirone:theme-change"));
	});
	await page.waitForTimeout(600);
	await page.screenshot({ path: "artifacts/friends/friends-summer-1440.png" });

	// 3. Summer (Light) 390
	await page.setViewportSize({ width: 390, height: 844 });
	await page.reload();
	await page.evaluate(() => {
		localStorage.setItem("theme", "light");
		document.documentElement.classList.remove("dark");
		document.documentElement.setAttribute("data-theme", "github-light");
		window.dispatchEvent(new CustomEvent("shirone:theme-change"));
	});
	await page.waitForTimeout(600);
	await page.screenshot({ path: "artifacts/friends/friends-summer-390.png" });

	// 4. Starry (Dark) 390
	await page.evaluate(() => {
		localStorage.setItem("theme", "dark");
		document.documentElement.classList.add("dark");
		document.documentElement.setAttribute("data-theme", "github-dark");
		window.dispatchEvent(new CustomEvent("shirone:theme-change"));
	});
	await page.waitForTimeout(600);
	await page.screenshot({ path: "artifacts/friends/friends-starry-390.png" });
});
