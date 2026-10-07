import { test, expect } from '@playwright/test';

const PREVIEW_BASE = 'https://ed90c2c6.alister-blog.pages.dev';

test.describe('Cloudflare Pages Preview Verification', () => {
  test('Preview inspection across viewports, themes, and Swup navigation', async ({ page }) => {
    test.setTimeout(60000);
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    // 1. Desktop 1440px Starry (Dark)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${PREVIEW_BASE}/friends/`);

    // Verify 4 main regions
    const selfLinkCard = page.locator('.friend-self-link');
    await expect(selfLinkCard).toBeVisible();
    await expect(selfLinkCard.locator('.friend-self-link__name')).toHaveText("Alister's Blog");

    const applyCard = page.locator('.friend-apply');
    await expect(applyCard).toBeVisible();
    await expect(applyCard.locator('.friend-apply__title')).toHaveText('友链申请');
    await expect(applyCard.locator('.friend-apply__email-address')).toHaveText('3335679109@qq.com');

    const friendsList = page.locator('.friend-card, [data-friend-card]');
    expect(await friendsList.count()).toBeGreaterThanOrEqual(2);

    const guestbook = page.locator('.friend-guestbook');
    await expect(guestbook).toBeVisible();
    await expect(guestbook.locator('.friend-guestbook__title')).toContainText('留言板');
    await expect(guestbook.locator('.friend-guestbook__hint')).toHaveText('路过的话，欢迎留下一句话。');

    // Check no horizontal overflow at 1440
    let isOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(isOverflow).toBe(false);

    // 2. Tablet 768px
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    isOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(isOverflow).toBe(false);

    // 3. Mobile 390px Summer (Light)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      localStorage.setItem('theme', 'light');
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'github-light');
      window.dispatchEvent(new CustomEvent('shirone:theme-change'));
    });
    await page.waitForTimeout(400);

    await expect(selfLinkCard).toBeVisible();
    await expect(applyCard).toBeVisible();
    await expect(guestbook).toBeVisible();

    isOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(isOverflow).toBe(false);

    // 4. Swup Navigation: Home -> Friends -> Home -> Friends
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${PREVIEW_BASE}/`);
    await page.waitForFunction(() => Boolean((window as Window & { swup?: unknown }).swup));

    // Nav to Friends
    await page.locator('a[href="/friends/"]:visible').first().click();
    await expect(page).toHaveURL(`${PREVIEW_BASE}/friends/`);
    await page.locator('.friend-guestbook').scrollIntoViewIfNeeded();
    await expect(page.locator('.friend-guestbook')).toBeVisible();

    // Nav to Home
    await page.locator('a[href="/"]:visible').first().click();
    await expect(page).toHaveURL(`${PREVIEW_BASE}/`);

    // Nav to Friends again
    await page.locator('a[href="/friends/"]:visible').first().click();
    await expect(page).toHaveURL(`${PREVIEW_BASE}/friends/`);
    await page.locator('.friend-guestbook').scrollIntoViewIfNeeded();
    await expect(page.locator('.friend-guestbook')).toBeVisible();

    // Check console errors
    // Filter out expected 500 error from /api/v1/comments due to known missing D1 binding on preview
    const realErrors = consoleErrors.filter(e => !e.includes('500') && !e.includes('Failed to load resource'));
    expect(realErrors).toHaveLength(0);
  });
});
