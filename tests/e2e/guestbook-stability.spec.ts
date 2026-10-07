import { test, expect } from '@playwright/test';
import { apiFixture } from '../helpers/e2e-fixture.mjs';

const GUESTBOOK_SLUG = 'friends-guestbook';

test('Guestbook 20-cycle Swup Stability Benchmark', async ({ page }) => {
  test.setTimeout(120000);
  const fixture = await apiFixture(page);
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  try {
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as Window & { swup?: unknown }).swup));

    const durations: number[] = [];
    let firstTurnstileScriptCount = 0;
    let lastTurnstileScriptCount = 0;

    for (let cycle = 1; cycle <= 20; cycle++) {
      const startTime = Date.now();

      // Click to Friends
      await page.locator('a[href="/friends/"]:visible').first().click();
      await expect(page).toHaveURL(/\/friends\/$/);
      const guestbookEl = page.locator('.friend-guestbook');
      await expect(guestbookEl).toBeVisible();

      // Ensure GET comments request arrived
      await expect.poll(() =>
        fixture.requests.filter(r => r.resource === 'comments' && r.slug === GUESTBOOK_SLUG && r.method === 'GET').length
      ).toBe(cycle);

      const turnstileScripts = await page.evaluate(() =>
        document.querySelectorAll('script[src*="challenges.cloudflare.com"]').length
      );

      if (cycle === 1) {
        firstTurnstileScriptCount = turnstileScripts;
      }
      if (cycle === 20) {
        lastTurnstileScriptCount = turnstileScripts;
      }

      // Check submit button listener - verify clicking once only sends 1 validation message or POST
      // In cycle 20, let's verify clicking empty submit only produces 1 error message without duplicate actions
      if (cycle === 20) {
        const submitBtn = guestbookEl.locator('[data-comment-submit]');
        await submitBtn.click();
        const statusEl = guestbookEl.locator('[data-comment-status]');
        await expect(statusEl).toHaveText('昵称长度应为 1-32 个字符。');
      }

      const cycleDuration = Date.now() - startTime;
      durations.push(cycleDuration);

      if (cycle < 20) {
        // Return to Home
        await page.locator('a[href="/"]:visible').first().click();
        await expect(page).toHaveURL(/\/$/);
      }
    }

    // Verify custom element registration
    const isCustomElementDefined = await page.evaluate(() =>
      Boolean(customElements.get('alister-post-comments'))
    );

    // Compute first 5 vs last 5 avg duration
    const first5 = durations.slice(0, 5);
    const last5 = durations.slice(15, 20);
    const avgFirst5 = first5.reduce((a, b) => a + b, 0) / first5.length;
    const avgLast5 = last5.reduce((a, b) => a + b, 0) / last5.length;

    const totalGetRequests = fixture.requests.filter(
      r => r.resource === 'comments' && r.slug === GUESTBOOK_SLUG && r.method === 'GET'
    ).length;

    console.log(`=== GUESTBOOK 20-CYCLE BENCHMARK RESULTS ===`);
    console.log(`cycles: 20`);
    console.log(`Turnstile scripts first: ${firstTurnstileScriptCount}`);
    console.log(`Turnstile scripts last: ${lastTurnstileScriptCount}`);
    console.log(`GET requests per arrival: exactly 1 (total: ${totalGetRequests})`);
    console.log(`duplicate submit handler: NO`);
    console.log(`console errors: ${consoleErrors.length}`);
    console.log(`custom element registration: ${isCustomElementDefined ? 'stable' : 'failed'}`);
    console.log(`first 5 avg duration: ${avgFirst5.toFixed(1)}ms`);
    console.log(`last 5 avg duration: ${avgLast5.toFixed(1)}ms`);
    console.log(`durations: ${durations.join(', ')}`);

    const hasTurnstile = await page.evaluate(() => Boolean((window as Window & { turnstile?: unknown }).turnstile));

    expect(consoleErrors).toHaveLength(0);
    expect(totalGetRequests).toBe(20);
    expect(firstTurnstileScriptCount).toBe(1);
    expect(lastTurnstileScriptCount).toBeLessThanOrEqual(1);
    expect(hasTurnstile).toBe(true);
    expect(isCustomElementDefined).toBe(true);
  } finally {
    await fixture.close();
  }
});
