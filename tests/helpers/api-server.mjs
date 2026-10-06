// Local-only browser-test transport: real Functions with migrated SQLite.
import { createServer } from 'node:http';
import { handler, database } from './backend.mjs';

const DB = database();
const handlers = {
  views: await handler('functions/api/v1/views/[slug].ts'),
  reactions: await handler('functions/api/v1/reactions/[slug].ts'),
  comments: await handler('functions/api/v1/comments/[slug].ts'),
};

const mockTurnstileFetch = async (url, options) => {
  if (url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
    const params = new URLSearchParams(options.body?.toString() ?? '');
    const token = params.get('response');
    if (token === 'valid-token' || token === '1x00000000000000000000AA' || token === 'test-token' || token === 'pass') {
      return new Response(JSON.stringify({ success: true, action: 'comment_submit', hostname: 'alistereno.top' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return fetch(url, options);
};

const server = createServer(async (req, res) => {
  try {
    if (req.url === '/__test/counts') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        views: DB.sql.prepare('SELECT COUNT(*) AS count FROM post_views').get().count,
        comments: DB.sql.prepare('SELECT COUNT(*) AS count FROM comments').get().count,
      }));
      return;
    }
    const match = req.url.match(/^\/api\/v1\/(views|reactions|comments)\/([^/?]+)$/);
    if (!match) { res.writeHead(404); res.end(); return; }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const response = await handlers[match[1]]({
      env: { DB, TURNSTILE_SECRET: '1x0000000000000000000000000000000AA', fetch: mockTurnstileFetch },
      params: { slug: decodeURIComponent(match[2]) },
      request: new Request(`http://127.0.0.1${req.url}`, {
        method: req.method,
        headers: req.headers,
        ...(['GET','HEAD'].includes(req.method) ? {} : { body: Buffer.concat(chunks) }),
      }),
    });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  } catch { res.writeHead(500); res.end('{}'); }
});
server.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ port: server.address().port })));
process.on('SIGTERM', () => server.close(() => { DB.sql.close(); process.exit(0); }));
