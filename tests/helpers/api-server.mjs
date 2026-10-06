// Local-only browser-test transport: real Functions with migrated SQLite.
import { createServer } from 'node:http';
import { handler, database } from './backend.mjs';
const DB = database();
const handlers = {
  views: await handler('functions/api/v1/views/[slug].ts'),
  reactions: await handler('functions/api/v1/reactions/[slug].ts'),
};
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/__test/counts') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ views: DB.sql.prepare('SELECT COUNT(*) AS count FROM post_views').get().count }));
      return;
    }
    const match = req.url.match(/^\/api\/v1\/(views|reactions)\/([^/?]+)$/);
    if (!match) { res.writeHead(404); res.end(); return; }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const response = await handlers[match[1]]({ env: { DB }, params: { slug: decodeURIComponent(match[2]) },
      request: new Request(`http://127.0.0.1${req.url}`, { method: req.method, headers: req.headers,
        ...(['GET','HEAD'].includes(req.method) ? {} : { body: Buffer.concat(chunks) }) }) });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  } catch { res.writeHead(500); res.end('{}'); }
});
server.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ port: server.address().port })));
process.on('SIGTERM', () => server.close(() => { DB.sql.close(); process.exit(0); }));
