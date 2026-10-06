import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { apiFixture } from '../helpers/e2e-fixture.mjs';

const article = '/posts/hello-alister-blog/';

test('@smoke article views and Like use actual API logic and preserve cookie on reload', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const fixture = await apiFixture(page, { beforeReaction: () => gate });
  try {
    await page.goto('/');
    expect(fixture.requests).toHaveLength(0);
    await page.locator(`a[href="${article}"]:visible`).first().click();
    const bar = page.locator('alister-post-interactions');
    await expect(bar).toBeVisible();
    await expect(bar.locator('[data-like]')).toBeDisabled();
    await expect(bar.locator('[data-likes]')).toHaveText('—');
    release();
    await expect(bar.locator('[data-views]')).toHaveText('1');
    await expect(bar.locator('[data-likes]')).toHaveText('0');
    const button = bar.getByRole('button');
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(bar.locator('[data-likes]')).toHaveText('1');
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(bar.locator('[data-likes]')).toHaveText('0');
    expect(fixture.requests.filter(r => r.resource === 'views')).toHaveLength(1);
    expect(fixture.requests.filter(r => r.method === 'GET' && r.resource === 'reactions')).toHaveLength(1);
    await page.reload();
    await expect(bar.locator('[data-views]')).toHaveText('1');
    await expect(button).toBeEnabled();
    expect(await fixture.count()).toBe(1);
    for (const width of [390, 768, 1440, 1600]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1024 });
      for (const dark of [false, true]) {
        await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
        await expect(bar).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await button.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      }
    }
  } finally { release(); await fixture.close(); }
});

test('@smoke Swup article changes and back/forward initialize each new bar once', async ({ page }) => {
  const fixture = await apiFixture(page);
  // A second static fixture uses the real article HTML without publishing fake content.
  const second = '/posts/interaction-test-b/';
  const html = readFileSync('dist/posts/hello-alister-blog/index.html', 'utf8')
    .replace('data-slug="hello-alister-blog"', 'data-slug="interaction-test-b"');
  await page.route(`**${second}`, route => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
  async function navigate(href) {
    await page.evaluate(url => {
      const link = document.createElement('a'); link.href = url; link.id = 'interaction-test-navigation';
      link.textContent = 'Test navigation'; document.querySelector('main').append(link);
    }, href);
    await page.locator('#interaction-test-navigation').click();
    await expect(page).toHaveURL(new RegExp(href + '$'));
    await expect(page.locator('alister-post-interactions [data-like]')).toBeEnabled();
  }
  try {
    await page.goto(article);
    await expect(page.locator('[data-like]')).toBeEnabled();
    const start = await page.evaluate(() => performance.timeOrigin);
    await page.locator('[data-like]').click();
    await expect(page.locator('[data-like]')).toHaveAttribute('aria-pressed', 'true');
    await navigate(second);
    await expect(page.locator('[data-like]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-views]')).toHaveText('1');
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(article + '$'));
    await expect(page.locator('[data-like]')).toHaveAttribute('aria-pressed', 'true');
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(second + '$'));
    await expect(page.locator('[data-like]')).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(start);
    expect(fixture.requests.filter(r => r.resource === 'views')).toHaveLength(4);
    expect(fixture.requests.filter(r => r.resource === 'reactions' && r.method === 'GET')).toHaveLength(4);
    expect(await fixture.count()).toBe(2);
  } finally { await fixture.close(); }
});

test('@smoke unavailable APIs stay non-blocking and Like can retry without optimistic corruption', async ({ page }) => {
  let failPut = true;
  const fixture = await apiFixture(page, { failure: (resource, method) => resource === 'views' || (method === 'PUT' && failPut) });
  try {
    await page.goto(article);
    const button = page.locator('[data-like]');
    await expect(button).toBeEnabled();
    await expect(page.locator('[data-views]')).toHaveText('—');
    await button.click();
    await expect(page.locator('[data-status]')).toHaveText('操作失败，请重试');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-likes]')).toHaveText('0');
    failPut = false;
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-likes]')).toHaveText('1');
    await page.goto('/tags/');
    await expect(page.locator('alister-post-interactions')).toHaveCount(0);
  } finally { await fixture.close(); }
});


test('@smoke a retry after initial reaction load failure reads state and completes the Like click', async ({ page }) => {
  let failInitialGet = true;
  const fixture = await apiFixture(page, { failure: (resource, method) => {
    if (resource === 'reactions' && method === 'GET' && failInitialGet) { failInitialGet = false; return true; }
    return false;
  } });
  try {
    await page.goto(article);
    await expect(page.locator('[data-status]')).toHaveText('点赞暂不可用，点击可重试');
    await page.locator('[data-like]').click();
    await expect(page.locator('[data-like]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-likes]')).toHaveText('1');
    expect(fixture.requests.filter(r => r.resource === 'reactions' && r.method === 'PUT')).toHaveLength(1);
  } finally { await fixture.close(); }
});
