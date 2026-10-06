import { spawn } from 'node:child_process';
import { once } from 'node:events';

export async function apiFixture(page, options = {}) {
  const child = spawn(process.execPath, ['tests/helpers/api-server.mjs'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const port = await new Promise((resolve, reject) => {
    let output = '';
    child.stdout.on('data', chunk => {
      output += chunk;
      if (output.includes('\n')) resolve(JSON.parse(output.split('\n')[0]).port);
    });
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`API fixture exited: ${code}`)));
  });
  const base = `http://127.0.0.1:${port}`;
  const requests = [];

  await page.route(/challenges\.cloudflare\.com/, async route => {
    if (options.turnstileScriptFail) {
      await route.abort();
      return;
    }
    const token = options.turnstileToken ?? 'valid-token';
    const mockScript = `
      window.turnstile = {
        render: (container, opts) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'cf-turnstile-response';
          input.value = '${token}';
          if (typeof container === 'string') container = document.querySelector(container);
          if (container) container.appendChild(input);
          if (opts && opts.callback) opts.callback('${token}');
          return 'widget-1';
        },
        reset: (id) => {},
        remove: (id) => {},
        getResponse: (id) => '${token}',
      };
    `;
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: mockScript });
  });

  await page.route(/\/api\/v1\//, async route => {
    const req = route.request();
    const url = new URL(req.url());
    const [, resource, slug] = url.pathname.match(/\/api\/v1\/(views|reactions|comments)\/([^/]+)$/) ?? [];
    if (!resource) { await route.continue(); return; }
    requests.push({ resource, slug, method: req.method() });
    const failure = options.failure?.(resource, req.method());
    if (failure) { await route.fulfill({ status: typeof failure === 'number' ? failure : 503, json: { error: 'Unavailable' } }); return; }
    if (resource === 'reactions' && req.method() === 'GET') await options.beforeReaction?.();
    const response = await route.fetch({ url: `${base}${url.pathname}`, maxRetries: 0 });
    await route.fulfill({ response });
  });

  return {
    base,
    requests,
    count: async () => (await (await fetch(`${base}/__test/counts`)).json()).views,
    commentsCount: async () => (await (await fetch(`${base}/__test/counts`)).json()).comments,
    close: async () => { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; },
  };
}
