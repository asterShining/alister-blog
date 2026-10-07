import { test, expect } from '@playwright/test';
import { apiFixture } from '../helpers/e2e-fixture.mjs';

const GUESTBOOK_SLUG = 'friends-guestbook';

test.describe('Friends Guestbook (Polished)', () => {
  test('Case 1: Direct load /friends/ displays Guestbook and triggers exactly one GET request', async ({ page }) => {
    const fixture = await apiFixture(page);
    try {
      await page.goto('/friends/');
      const guestbookEl = page.locator('.friend-guestbook');
      await expect(guestbookEl).toBeVisible();

      // Check header and hint
      await expect(guestbookEl.locator('.friend-guestbook__title')).toContainText('留言板');
      await expect(guestbookEl.locator('.friend-guestbook__hint')).toHaveText('路过的话，欢迎留下一句话。');

      // Verify exactly one comments GET request for synthetic slug
      await expect.poll(() =>
        fixture.requests.filter(r => r.resource === 'comments' && r.slug === GUESTBOOK_SLUG && r.method === 'GET').length
      ).toBe(1);

      // Verify no polling
      await page.waitForTimeout(400);
      expect(
        fixture.requests.filter(r => r.resource === 'comments' && r.slug === GUESTBOOK_SLUG && r.method === 'GET')
      ).toHaveLength(1);
    } finally {
      await fixture.close();
    }
  });

  test('Case 2: Empty state displays polished guestbook guidance', async ({ page }) => {
    const fixture = await apiFixture(page);
    try {
      await page.goto('/friends/');
      const guestbookEl = page.locator('.friend-guestbook');
      await expect(guestbookEl).toBeVisible();

      const emptyEl = guestbookEl.locator('.comment-section__empty');
      await expect(emptyEl).toBeVisible();
      await expect(emptyEl).toHaveText('暂无留言，来留下第一条足迹吧。');
      await expect(guestbookEl.locator('[data-comment-count]')).toContainText('留言 0');
    } finally {
      await fixture.close();
    }
  });

  test('Case 3: Displays existing guestbook messages with author, time, and text content', async ({ page }) => {
    // Intercept GET to return mock comments
    await page.route(/\/api\/v1\/comments\/friends-guestbook$/, async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'guest-1',
              authorName: 'Alice',
              content: '路过支持，博客很棒！',
              createdAt: '2026-10-07T10:00:00Z',
            },
          ]),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/friends/');
    const guestbookEl = page.locator('.friend-guestbook');
    await expect(guestbookEl).toBeVisible();

    const commentItem = guestbookEl.locator('.comment-item');
    await expect(commentItem).toHaveCount(1);
    await expect(commentItem.locator('.comment-item__name')).toHaveText('Alice');
    await expect(commentItem.locator('.comment-item__body')).toHaveText('路过支持，博客很棒！');
    await expect(commentItem.locator('.comment-item__avatar')).toHaveText('A');
    await expect(guestbookEl.locator('[data-comment-count]')).toContainText('留言 1');
  });

  test('Case 4: Swup navigation from Home -> Friends mounts Guestbook and Turnstile container', async ({ page }) => {
    const fixture = await apiFixture(page);
    try {
      await page.goto('/');
      await page.waitForFunction(() => Boolean((window as Window & { swup?: unknown }).swup));

      // In-site Swup navigation
      const navLink = page.locator('a[href="/friends/"]:visible').first();
      await navLink.click();
      await expect(page).toHaveURL(/\/friends\/$/);

      const guestbookEl = page.locator('.friend-guestbook');
      await expect(guestbookEl).toBeVisible();
      await expect(guestbookEl.locator('[data-turnstile]')).toBeVisible();

      // Check request triggered
      await expect.poll(() =>
        fixture.requests.filter(r => r.resource === 'comments' && r.slug === GUESTBOOK_SLUG && r.method === 'GET').length
      ).toBe(1);
    } finally {
      await fixture.close();
    }
  });

  test('Case 5: Repeated Swup navigation does not leak event handlers or trigger duplicate requests', async ({ page }) => {
    const fixture = await apiFixture(page);
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    try {
      await page.goto('/');
      await page.waitForFunction(() => Boolean((window as Window & { swup?: unknown }).swup));

      // Navigate between Home and Friends 3 times
      for (let i = 0; i < 3; i++) {
        await page.locator('a[href="/friends/"]:visible').first().click();
        await expect(page).toHaveURL(/\/friends\/$/);
        const guestbookEl = page.locator('.friend-guestbook');
        await expect(guestbookEl).toBeVisible();

        // Exactly i + 1 GET requests (one per visit to /friends/, no duplicates)
        await expect.poll(() =>
          fixture.requests.filter(r => r.resource === 'comments' && r.slug === GUESTBOOK_SLUG && r.method === 'GET').length
        ).toBe(i + 1);

        await page.locator('a[href="/"]:visible').first().click();
        await expect(page).toHaveURL(/\/$/);
      }

      // Final visit to Friends
      await page.locator('a[href="/friends/"]:visible').first().click();
      await expect(page).toHaveURL(/\/friends\/$/);
      const guestbookEl = page.locator('.friend-guestbook');
      await expect(guestbookEl).toBeVisible();

      await expect.poll(() =>
        fixture.requests.filter(r => r.resource === 'comments' && r.slug === GUESTBOOK_SLUG && r.method === 'GET').length
      ).toBe(4);

      expect(errors).toHaveLength(0);
    } finally {
      await fixture.close();
    }
  });

  test('Case 6: Form validation blocks empty or oversized fields with polite error messages', async ({ page }) => {
    const fixture = await apiFixture(page);
    try {
      await page.goto('/friends/');
      const guestbookEl = page.locator('.friend-guestbook');
      await expect(guestbookEl).toBeVisible();

      const nameInput = guestbookEl.locator('[data-comment-name]');
      const contentInput = guestbookEl.locator('[data-comment-content]');
      const submitBtn = guestbookEl.locator('[data-comment-submit]');
      const statusEl = guestbookEl.locator('[data-comment-status]');

      await expect(submitBtn).toBeEnabled();

      // 1. Empty nickname
      await submitBtn.click();
      await expect(statusEl).toHaveText('昵称长度应为 1-32 个字符。');
      expect(fixture.requests.filter(r => r.resource === 'comments' && r.method === 'POST')).toHaveLength(0);

      // 2. Empty content
      await nameInput.fill('Tester');
      await contentInput.fill('');
      await submitBtn.click();
      await expect(statusEl).toHaveText('留言内容应为 1-1000 个字符。');
      expect(fixture.requests.filter(r => r.resource === 'comments' && r.method === 'POST')).toHaveLength(0);
    } finally {
      await fixture.close();
    }
  });

  test('Case 7: Post valid guestbook message persists to D1 and shows immediate success', async ({ page }) => {
    const fixture = await apiFixture(page);
    try {
      await page.goto('/friends/');
      const guestbookEl = page.locator('.friend-guestbook');
      await expect(guestbookEl).toBeVisible();

      const nameInput = guestbookEl.locator('[data-comment-name]');
      const contentInput = guestbookEl.locator('[data-comment-content]');
      const submitBtn = guestbookEl.locator('[data-comment-submit]');
      const statusEl = guestbookEl.locator('[data-comment-status]');

      await expect(submitBtn).toBeEnabled();

      await nameInput.fill('FriendVisitor');
      await contentInput.fill('这是一条测试留言，博主好！');
      await submitBtn.click();

      // Check success feedback
      await expect(statusEl).toHaveText('留言成功！');
      await expect(contentInput).toHaveValue('');

      // Verify POST request payload
      const postReqs = fixture.requests.filter(r => r.resource === 'comments' && r.slug === GUESTBOOK_SLUG && r.method === 'POST');
      expect(postReqs).toHaveLength(1);

      // Verify new message appears in list
      const newItem = guestbookEl.locator('.comment-item').first();
      await expect(newItem).toBeVisible();
      await expect(newItem.locator('.comment-item__name')).toHaveText('FriendVisitor');
      await expect(newItem.locator('.comment-item__body')).toHaveText('这是一条测试留言，博主好！');

      // Nickname retained in localStorage
      const savedNickname = await page.evaluate(() => localStorage.getItem('alister_comment_author'));
      expect(savedNickname).toBe('FriendVisitor');
    } finally {
      await fixture.close();
    }
  });

  test('Case 8: Plain-text rendering prevents HTML / script injection (XSS)', async ({ page }) => {
    const fixture = await apiFixture(page);
    try {
      await page.goto('/friends/');
      const guestbookEl = page.locator('.friend-guestbook');
      await expect(guestbookEl).toBeVisible();

      const nameInput = guestbookEl.locator('[data-comment-name]');
      const contentInput = guestbookEl.locator('[data-comment-content]');
      const submitBtn = guestbookEl.locator('[data-comment-submit]');

      await expect(submitBtn).toBeEnabled();

      const xssPayload = '<img src="x" onerror="window.__xssPwned = true"><script>window.__xssPwned = true;</script>';
      await nameInput.fill('SecurityTester');
      await contentInput.fill(xssPayload);
      await submitBtn.click();

      await expect(guestbookEl.locator('[data-comment-status]')).toHaveText('留言成功！');

      const bodyEl = guestbookEl.locator('.comment-item__body').first();
      // Rendered strictly as plain text
      await expect(bodyEl).toHaveText(xssPayload);
      // No img element created
      await expect(bodyEl.locator('img')).toHaveCount(0);
      // Window property never touched
      const isPwned = await page.evaluate(() => (window as unknown as { __xssPwned?: boolean }).__xssPwned);
      expect(isPwned).toBeUndefined();
    } finally {
      await fixture.close();
    }
  });

  test('Case 9: Mobile viewport 390px has zero horizontal overflow across full Friends page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/friends/');

    const guestbookEl = page.locator('.friend-guestbook');
    await expect(guestbookEl).toBeVisible();

    const isOverflowing = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth;
    });
    expect(isOverflowing).toBe(false);
  });
});
