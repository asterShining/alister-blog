import { test, expect } from '@playwright/test';
import { apiFixture } from '../helpers/e2e-fixture.mjs';

const article = '/posts/hello-alister-blog/';

test('@smoke comments section is visible on article page and makes exactly one initial GET', async ({ page }) => {
  const fixture = await apiFixture(page);
  try {
    await page.goto('/');
    await expect(page.locator('alister-post-comments')).toHaveCount(0);

    await page.locator(`a[href="${article}"]:visible`).first().click();
    const commentsEl = page.locator('alister-post-comments');
    await expect(commentsEl).toBeVisible();

    // Verify exactly one comments GET request on load
    await expect.poll(() => fixture.requests.filter(r => r.resource === 'comments' && r.method === 'GET').length).toBe(1);

    // Wait a brief moment to ensure no background polling occurs
    await page.waitForTimeout(500);
    expect(fixture.requests.filter(r => r.resource === 'comments' && r.method === 'GET')).toHaveLength(1);

    // Initial empty state
    await expect(commentsEl.locator('[data-comment-count]')).toHaveText('评论 0');
    await expect(commentsEl.locator('.comment-section__empty')).toHaveText('暂无评论，来说点什么吧。');
  } finally {
    await fixture.close();
  }
});

test('@smoke comments submission, nickname persistence, and plain-text XSS safety', async ({ page }) => {
  const fixture = await apiFixture(page);
  try {
    await page.goto(article);
    const commentsEl = page.locator('alister-post-comments');
    await expect(commentsEl).toBeVisible();

    const nameInput = commentsEl.locator('[data-comment-name]');
    const contentInput = commentsEl.locator('[data-comment-content]');
    const submitBtn = commentsEl.locator('[data-comment-submit]');
    const statusEl = commentsEl.locator('[data-comment-status]');

    // 1. Submit with empty inputs -> blocked client-side
    await submitBtn.click();
    await expect(statusEl).toHaveText('昵称长度应为 1-32 个字符。');
    expect(fixture.requests.filter(r => r.resource === 'comments' && r.method === 'POST')).toHaveLength(0);

    // 2. Submit with malicious XSS payload
    const xssPayload = '<script>window.__xssPwned = true;</script><img src="x" onerror="window.__xssPwned=true">';
    await nameInput.fill('SecurityTester');
    await contentInput.fill(xssPayload);
    await submitBtn.click();

    // Verify submission succeeds
    await expect(statusEl).toHaveText('评论发表成功！');
    await expect(commentsEl.locator('[data-comment-count]')).toHaveText('评论 1');
    expect(fixture.requests.filter(r => r.resource === 'comments' && r.method === 'POST')).toHaveLength(1);

    // Content input cleared, nickname retained
    await expect(contentInput).toHaveValue('');
    await expect(nameInput).toHaveValue('SecurityTester');

    // Verify XSS did NOT execute
    const xssExecuted = await page.evaluate(() => Boolean((window).__xssPwned));
    expect(xssExecuted).toBe(false);

    // Verify comment rendered as plain text
    const commentItem = commentsEl.locator('.comment-item').first();
    await expect(commentItem.locator('.comment-item__name')).toHaveText('SecurityTester');
    await expect(commentItem.locator('.comment-item__body')).toHaveText(xssPayload);
    // Ensure no <script> tag exists inside the comment body
    expect(await commentItem.locator('.comment-item__body script').count()).toBe(0);

    // Verify nickname is persisted in localStorage
    const savedNick = await page.evaluate(() => localStorage.getItem('alister_comment_author'));
    expect(savedNick).toBe('SecurityTester');

    // Reload page: verify comment is still displayed from DB and nickname pre-filled
    await page.reload();
    await expect(commentsEl.locator('[data-comment-count]')).toHaveText('评论 1');
    await expect(commentsEl.locator('.comment-item__name').first()).toHaveText('SecurityTester');
    await expect(nameInput).toHaveValue('SecurityTester');
  } finally {
    await fixture.close();
  }
});

test('@smoke rate limiting 429 displays friendly message', async ({ page }) => {
  const fixture = await apiFixture(page);
  try {
    await page.goto(article);
    const commentsEl = page.locator('alister-post-comments');
    await expect(commentsEl).toBeVisible();

    const nameInput = commentsEl.locator('[data-comment-name]');
    const contentInput = commentsEl.locator('[data-comment-content]');
    const submitBtn = commentsEl.locator('[data-comment-submit]');
    const statusEl = commentsEl.locator('[data-comment-status]');

    // First comment succeeds
    await nameInput.fill('FastPoster');
    await contentInput.fill('First comment');
    await submitBtn.click();
    await expect(statusEl).toHaveText('评论发表成功！');

    // Second comment immediately (< 30s) triggers 429
    await contentInput.fill('Immediate second comment');
    await submitBtn.click();
    await expect(statusEl).toHaveText('操作太频繁，请稍后再试。');
    await expect(submitBtn).toBeEnabled();
  } finally {
    await fixture.close();
  }
});

test('@smoke Turnstile failure and API failure stay non-blocking', async ({ page }) => {
  // Test with failing turnstile
  const fixture = await apiFixture(page, { turnstileToken: 'fail-token' });
  try {
    await page.goto(article);
    const commentsEl = page.locator('alister-post-comments');
    await expect(commentsEl).toBeVisible();

    const nameInput = commentsEl.locator('[data-comment-name]');
    const contentInput = commentsEl.locator('[data-comment-content]');
    const submitBtn = commentsEl.locator('[data-comment-submit]');
    const statusEl = commentsEl.locator('[data-comment-status]');

    await nameInput.fill('Tester');
    await contentInput.fill('Testing failure');
    await submitBtn.click();
    await expect(statusEl).toHaveText('Comment verification failed');
    await expect(submitBtn).toBeEnabled();
  } finally {
    await fixture.close();
  }

  // Test with 503 API failure on comments GET: article remains readable
  const failingFixture = await apiFixture(page, { failure: (resource) => resource === 'comments' });
  try {
    await page.goto(article);
    // Article text is still completely readable
    await expect(page.getByText('Alister Blog 从这里开始。')).toBeVisible();
    const commentsEl = page.locator('alister-post-comments');
    await expect(commentsEl).toBeVisible();
    await expect(commentsEl.locator('.comment-section__empty')).toHaveText('评论加载失败，请刷新页面重试。');
  } finally {
    await failingFixture.close();
  }
});

test('@smoke Swup navigation preserves comments state and avoids duplicate widgets', async ({ page }) => {
  const fixture = await apiFixture(page);
  try {
    await page.goto('/');
    const start = await page.evaluate(() => performance.timeOrigin);

    // Navigate to article via Swup
    await page.locator(`a[href="${article}"]:visible`).first().click();
    await expect(page).toHaveURL(new RegExp(article + '$'));
    const commentsEl = page.locator('alister-post-comments');
    await expect(commentsEl).toBeVisible();

    // Exactly 1 GET request
    expect(fixture.requests.filter(r => r.resource === 'comments' && r.method === 'GET')).toHaveLength(1);

    // Navigate away to /archive/
    await page.locator('a[href="/archive/"]:visible').first().click();
    await expect(page).toHaveURL(/\/archive\/$/);
    await expect(page.locator('alister-post-comments')).toHaveCount(0);

    // Navigate back to article
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(article + '$'));
    await expect(commentsEl).toBeVisible();

    // Verify timeOrigin preserved (SPA Swup navigation)
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(start);

    // Exactly 2 GET requests total (1 for each visit, no duplicated/lingering requests)
    expect(fixture.requests.filter(r => r.resource === 'comments' && r.method === 'GET')).toHaveLength(2);

    // Ensure only 1 widget container exists
    expect(await commentsEl.locator('[data-turnstile]').count()).toBe(1);
  } finally {
    await fixture.close();
  }
});
