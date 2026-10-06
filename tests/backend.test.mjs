import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, cookieOf, database, handler } from './helpers/backend.mjs';

const health = await handler('functions/api/v1/health.ts');
const reactions = await handler('functions/api/v1/reactions/[slug].ts');
const comments = await handler('functions/api/v1/comments/[slug].ts');
const views = await handler('functions/api/v1/views/[slug].ts');

test('health queries database and hides failures', async () => {
  const db = database();
  assert.deepEqual(await (await call(health, db)).json(), { status: 'ok', database: 'connected' });
  const bad = { prepare() { throw new Error('secret binding detail'); } };
  const response = await call(health, bad);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'degraded', database: 'unavailable' });
  db.sql.close();
});

test('reaction insert, idempotence, change, delete and visitor isolation', async () => {
  const db = database();
  let response = await call(reactions, db);
  assert.deepEqual(await response.json(), { likes: 0, dislikes: 0, viewerReaction: null });
  assert.match(response.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=31536000/);
  const cookie = cookieOf(response);
  for (let i = 0; i < 2; i++) {
    response = await call(reactions, db, 'PUT', { type: 'like' }, cookie);
    assert.deepEqual(await response.json(), { likes: 1, dislikes: 0, viewerReaction: 'like' });
  }
  response = await call(reactions, db);
  assert.deepEqual(await response.json(), { likes: 1, dislikes: 0, viewerReaction: null });
  response = await call(reactions, db, 'PUT', { type: 'dislike' }, cookie);
  assert.deepEqual(await response.json(), { likes: 0, dislikes: 1, viewerReaction: 'dislike' });
  response = await call(reactions, db, 'PUT', { type: null }, cookie);
  assert.deepEqual(await response.json(), { likes: 0, dislikes: 0, viewerReaction: null });
  assert.equal((await call(reactions, db, 'GET', undefined, 'alister_visitor_id=bad')).status, 200);
  db.sql.close();
});

test('comments trim, escape nothing into HTML, filter statuses and omit identity', async () => {
  const db = database();
  const response = await call(comments, db, 'POST', { authorName: ' Alice ', content: " <script>alert('x')</script> " });
  assert.equal(response.status, 201);
  const comment = await response.json();
  assert.equal(comment.authorName, 'Alice');
  assert.equal(comment.content, "<script>alert('x')</script>");
  assert.deepEqual(Object.keys(comment).sort(), ['authorName', 'content', 'createdAt', 'id']);
  db.sql.prepare("INSERT INTO comments (id,post_slug,visitor_id,author_name,content,status,created_at) VALUES (?,?,?,?,?,?,?)")
    .run('earlier','hello-alister-blog','v','Bob','earlier','published','2000-01-01 00:00:00');
  for (const status of ['hidden','pending']) db.sql.prepare('INSERT INTO comments (id,post_slug,visitor_id,author_name,content,status) VALUES (?,?,?,?,?,?)').run(status,'hello-alister-blog','v','Bob','private',status);
  const list = await (await call(comments, db)).json();
  assert.equal(list.length, 2);
  assert.equal(list[0].id, 'earlier');
  assert.ok(list.every(c => !('visitor_id' in c)));
  db.sql.close();
});

test('invalid inputs, SQL-like slugs, methods and internal errors', async () => {
  const db = database();
  for (const body of ['{','null','[]',{}, { type: true }, { type: 'other' }]) assert.equal((await call(reactions, db, 'PUT', body)).status, 400);
  for (const body of ['{', {}, { authorName: 1, content: 'x' }, { authorName: ' ', content: 'x' }, { authorName: 'x'.repeat(33), content: 'x' }, { authorName: 'x', content: 'x'.repeat(1001) }]) assert.equal((await call(comments, db, 'POST', body)).status, 400);
  for (const fn of [reactions,comments,views]) {
    for (const slug of ['x'.repeat(201), 'a.b', "a' OR 1=1", '中文']) assert.equal((await call(fn, db, 'GET', undefined, undefined, slug)).status, 400);
    assert.equal((await call(fn, db, 'DELETE')).status, 405);
    const response = await call(fn, { prepare() { throw new Error('secret'); } });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Internal server error' });
  }
  assert.throws(() => db.sql.prepare('INSERT INTO reactions(id,post_slug,visitor_id,type) VALUES(?,?,?,?)').run('x','s','v','invalid'));
  db.sql.close();
});

test('views deduplicate by visitor and 30-minute bucket', async () => {
  const db = database();
  const otherVisitors = database();
  const originalNow = Date.now;
  try {
    Date.now = () => 1_800_000_000_000;
    let response = await call(views, db);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.deepEqual(await response.json(), { views: 0 });

    response = await call(views, db, 'POST');
    assert.deepEqual(await response.json(), { views: 1 });
    assert.match(response.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=31536000/);
    const firstVisitor = cookieOf(response);

    response = await call(views, db, 'POST', undefined, firstVisitor);
    assert.deepEqual(await response.json(), { views: 1 });

    Date.now = () => 1_800_000_000_000 + 30 * 60 * 1000;
    response = await call(views, db, 'POST', undefined, firstVisitor);
    assert.deepEqual(await response.json(), { views: 2 });

    const rows = db.sql.prepare('SELECT post_slug, view_bucket FROM post_views ORDER BY created_at, id').all();
    assert.equal(rows.length, 2);
    assert.ok(rows.every(row => !('visitor_id' in row)));

    Date.now = () => 1_800_000_000_000;
    assert.deepEqual(await (await call(views, otherVisitors, 'POST')).json(), { views: 1 });
    assert.deepEqual(await (await call(views, otherVisitors, 'POST')).json(), { views: 2 });
  } finally {
    Date.now = originalNow;
    db.sql.close();
    otherVisitors.sql.close();
  }
});

test('views validate slugs, hide identity and contain database failures', async () => {
  const db = database();
  for (const slug of ['x'.repeat(201), 'a.b', "a' OR 1=1", '中文']) {
    const response = await call(views, db, 'POST', undefined, undefined, slug);
    assert.equal(response.status, 400);
    assert.ok(!JSON.stringify(await response.json()).includes('visitor'));
  }
  assert.equal((await call(views, db, 'PUT')).status, 405);
  const failed = await call(views, { prepare() { throw new Error('secret database detail'); } }, 'POST');
  assert.equal(failed.status, 500);
  const failedBody = await failed.json();
  assert.deepEqual(failedBody, { error: 'Internal server error' });
  assert.ok(!JSON.stringify(failedBody).includes('secret'));
  db.sql.close();
});
