import { expect, test } from "@playwright/test";

const EXPECTED_CLIPBOARD_TEXT = [
	"name: Alister's Blog",
	"link: https://alistereno.top/",
	"avatar: https://alistereno.top/images/profile/avatar.webp",
	"descr: 把喜欢的、想到的，都留在这里。",
	"rss: https://alistereno.top/rss.xml",
].join("\n");

test.describe("Friends Self Link Card and Clipboard", () => {
	test.beforeEach(async ({ context }) => {
		try {
			await context.grantPermissions(["clipboard-read", "clipboard-write"]);
		} catch {
			// Grant permissions if supported in test browser context
		}
	});

	test("Case 1: Direct load /friends/ displays My Link Card with all 5 fields and avatar", async ({ page }) => {
		await page.goto("/friends/");

		const selfCard = page.locator("friend-self-link");
		await expect(selfCard).toBeVisible();

		// Check title & badge
		await expect(selfCard.locator(".friend-self-link__title")).toHaveText("我的友链信息");
		await expect(selfCard.locator(".friend-self-link__hint")).toContainText("如果你想添加本站，可以直接复制下面的信息。");

		// Check identity
		await expect(selfCard.locator(".friend-self-link__name")).toHaveText("Alister's Blog");
		await expect(selfCard.locator(".friend-self-link__host-link")).toContainText("alistereno.top");
		await expect(selfCard.locator(".friend-self-link__desc")).toHaveText("把喜欢的、想到的，都留在这里。");

		// Check avatar image
		const avatar = selfCard.locator(".friend-self-link__avatar");
		await expect(avatar).toBeVisible();
		await expect(avatar).toHaveAttribute("src", "/images/profile/avatar.webp");

		// Check the 5 fields
		const codeBox = selfCard.locator(".friend-self-link__code-box");
		await expect(codeBox).toBeVisible();
		await expect(codeBox).toContainText("name");
		await expect(codeBox).toContainText("Alister's Blog");
		await expect(codeBox).toContainText("link");
		await expect(codeBox).toContainText("https://alistereno.top/");
		await expect(codeBox).toContainText("avatar");
		await expect(codeBox).toContainText("https://alistereno.top/images/profile/avatar.webp");
		await expect(codeBox).toContainText("descr");
		await expect(codeBox).toContainText("把喜欢的、想到的，都留在这里。");
		await expect(codeBox).toContainText("rss");
		await expect(codeBox).toContainText("https://alistereno.top/rss.xml");

		// Check copy button
		const copyBtn = selfCard.locator("[data-copy-btn]");
		await expect(copyBtn).toBeVisible();
		await expect(copyBtn).toHaveText(/一键复制友链信息/);
	});

	test("Case 2: One-click copy copies exact 5-line text and updates visual state", async ({ page }) => {
		await page.goto("/friends/");

		const copyBtn = page.locator("friend-self-link [data-copy-btn]");
		await copyBtn.click();

		// Check button visual feedback
		await expect(copyBtn).toHaveText(/已复制/);
		await expect(copyBtn).toHaveClass(/friend-self-link__copy-btn--copied/);
		await expect(page.locator("friend-self-link [data-icon-check]")).toBeVisible();
		await expect(page.locator("friend-self-link [data-icon-copy]")).not.toBeVisible();

		// Read clipboard content
		const clipboardText = await page.evaluate(async () => {
			return navigator.clipboard.readText();
		});
		expect(clipboardText).toBe(EXPECTED_CLIPBOARD_TEXT);

		// Check aria-live status text
		const statusEl = page.locator("friend-self-link [data-copy-status]");
		await expect(statusEl).toHaveText("友链信息已成功复制到剪贴板");
	});

	test("Case 3: Home -> Friends via Swup navigation -> Copy button works with correct clipboard", async ({ page }) => {
		await page.goto("/");
		await page.waitForFunction(() => Boolean((window as Window & { swup?: unknown }).swup));

		// Navigate to Friends via in-site Swup navigation
		const friendsNavLink = page.locator('a[href="/friends/"]:visible').first();
		await friendsNavLink.click();
		await expect(page).toHaveURL(/\/friends\/$/);

		const selfCard = page.locator("friend-self-link");
		await expect(selfCard).toBeVisible();

		const copyBtn = selfCard.locator("[data-copy-btn]");
		await copyBtn.click();

		await expect(copyBtn).toHaveText(/已复制/);
		const clipboardText = await page.evaluate(async () => {
			return navigator.clipboard.readText();
		});
		expect(clipboardText).toBe(EXPECTED_CLIPBOARD_TEXT);
	});

	test("Case 4: Keyboard navigation (Tab and Enter / Space) can trigger copy", async ({ page }) => {
		await page.goto("/friends/");

		const copyBtn = page.locator("friend-self-link [data-copy-btn]");
		await copyBtn.focus();
		await page.keyboard.press("Enter");

		await expect(copyBtn).toHaveText(/已复制/);
		const clipboardText = await page.evaluate(async () => {
			return navigator.clipboard.readText();
		});
		expect(clipboardText).toBe(EXPECTED_CLIPBOARD_TEXT);
	});

	test("Case 5: Mobile viewport 390px has zero horizontal overflow", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto("/friends/");

		const selfCard = page.locator("friend-self-link");
		await expect(selfCard).toBeVisible();

		// Verify copy button is visible and clickable on mobile
		const copyBtn = selfCard.locator("[data-copy-btn]");
		await expect(copyBtn).toBeVisible();

		// Check zero horizontal overflow
		const isOverflowing = await page.evaluate(() => {
			const doc = document.documentElement;
			return doc.scrollWidth > doc.clientWidth;
		});
		expect(isOverflowing).toBe(false);
	});

	test("Case 6: Continuous 20 Swup navigations between Home and Friends without leaks or errors", async ({ page }) => {
		const errors: string[] = [];
		page.on("pageerror", (err) => errors.push(err.message));

		await page.goto("/");
		await page.waitForFunction(() => Boolean((window as Window & { swup?: unknown }).swup));

		for (let i = 0; i < 20; i++) {
			await page.locator('a[href="/friends/"]:visible').first().click();
			await expect(page).toHaveURL(/\/friends\/$/);
			await page.locator('a[href="/"]:visible').first().click();
			await expect(page).toHaveURL(/\/$/);
		}

		// Finally land on Friends
		await page.locator('a[href="/friends/"]:visible').first().click();
		await expect(page).toHaveURL(/\/friends\/$/);

		const copyBtn = page.locator("friend-self-link [data-copy-btn]");
		await expect(copyBtn).toBeVisible();
		await copyBtn.click();
		await expect(copyBtn).toHaveText(/已复制/);

		const clipboardText = await page.evaluate(async () => {
			return navigator.clipboard.readText();
		});
		expect(clipboardText).toBe(EXPECTED_CLIPBOARD_TEXT);
		expect(errors).toHaveLength(0);
	});

	test("Case 7: Preserves existing friends list and headings", async ({ page }) => {
		await page.goto("/friends/");

		// Header subtitle unchanged
		await expect(page.locator(".page-header__subtitle")).toHaveText("这里收录一些朋友的博客，欢迎去看看。");

		// Friends section heading
		await expect(page.locator(".friend-section__friends-title")).toHaveText("朋友列表");

		// Existing friends cards present with exact attributes
		const neomelt = page.getByRole("link", { name: "Neomelt's Blog", exact: true });
		const evilKnight = page.getByRole("link", { name: "evil0knight's Blog", exact: true });

		await expect(neomelt).toBeVisible();
		await expect(neomelt).toHaveAttribute("href", "https://neomelt.cloud");
		await expect(neomelt).toContainText("Keep looking, don't settle");

		await expect(evilKnight).toBeVisible();
		await expect(evilKnight).toHaveAttribute("href", "https://evil0knight.github.io/quartz/");
		await expect(evilKnight).toContainText("嵌入式软件,笔记博客,欢迎交流");
	});
});
