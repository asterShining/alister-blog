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

test('comments GET normal, filter statuses, plain text and omit identity', async () => {
  const db = database();
  db.sql.prepare("INSERT INTO comments (id,post_slug,visitor_id,author_name,content,status,created_at) VALUES (?,?,?,?,?,?,?)")
    .run('c1', 'hello-alister-blog', 'v1', 'Bob', '<script>alert("x")</script>', 'published', '2026-10-06 01:00:00');
  for (const status of ['hidden', 'pending']) {
    db.sql.prepare('INSERT INTO comments (id,post_slug,visitor_id,author_name,content,status) VALUES (?,?,?,?,?,?)')
      .run(status, 'hello-alister-blog', 'v1', 'Bob', 'private', status);
  }
  const response = await call(comments, db, 'GET');
  assert.equal(response.status, 200);
  const list = await response.json();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'c1');
  assert.equal(list[0].authorName, 'Bob');
  assert.equal(list[0].content, '<script>alert("x")</script>');
  assert.equal(list[0].createdAt, '2026-10-06 01:00:00');
  assert.ok(list.every(c => !('visitor_id' in c)));
  assert.ok(!JSON.stringify(list).includes('v1'));
  db.sql.close();
});

test('comments POST requires Turnstile token and validates via siteverify without remoteip', async () => {
  const db = database();

  // 1. Missing turnstileToken -> 400
  let res = await call(comments, db, 'POST', { authorName: 'Alice', content: 'Hello' });
  assert.equal(res.status, 400);

  // 2. Empty string turnstileToken -> 400
  res = await call(comments, db, 'POST', { authorName: 'Alice', content: 'Hello', turnstileToken: '' });
  assert.equal(res.status, 400);

  // 3. Siteverify request inspection: no remoteip sent, secret and response included
  let verifiedUrl = null;
  let verifiedBody = null;
  const inspectFetch = async (url, options) => {
    verifiedUrl = url;
    verifiedBody = new URLSearchParams(options.body.toString());
    return new Response(JSON.stringify({ success: true, action: 'comment_submit', hostname: 'alistereno.top' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  res = await call(comments, db, 'POST', { authorName: 'Alice', content: 'Hello', turnstileToken: 'token-123' }, undefined, 'hello-alister-blog', { fetch: inspectFetch });
  assert.equal(res.status, 201);
  assert.equal(verifiedUrl, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(verifiedBody.get('response'), 'token-123');
  assert.equal(verifiedBody.get('secret'), '1x0000000000000000000000000000000AA');
  assert.equal(verifiedBody.has('remoteip'), false, 'Siteverify must NOT send remoteip');

  db.sql.close();
});

test('Turnstile verification failures (invalid, expired/duplicate, wrong action/hostname)', async () => {
  const db = database();

  // Turnstile failure -> 400
  const failFetch = async () => new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  let res = await call(comments, db, 'POST', { authorName: 'Alice', content: 'Hello', turnstileToken: 'bad' }, undefined, 'hello-alister-blog', { fetch: failFetch });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'Comment verification failed' });

  // Expired / duplicate token -> 400
  const expiredFetch = async () => new Response(JSON.stringify({ success: false, 'error-codes': ['timeout-or-duplicate'] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  res = await call(comments, db, 'POST', { authorName: 'Alice', content: 'Hello', turnstileToken: 'expired' }, undefined, 'hello-alister-blog', { fetch: expiredFetch });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'Comment verification failed' });

  // Siteverify network error -> 400 (not leaking internal error)
  const networkErrorFetch = async () => { throw new Error('DNS failure'); };
  res = await call(comments, db, 'POST', { authorName: 'Alice', content: 'Hello', turnstileToken: 'valid-token' }, undefined, 'hello-alister-blog', { fetch: networkErrorFetch });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'Comment verification failed' });

  // Missing TURNSTILE_SECRET in env -> 500
  res = await call(comments, db, 'POST', { authorName: 'Alice', content: 'Hello', turnstileToken: 'valid-token' }, undefined, 'hello-alister-blog', { TURNSTILE_SECRET: '' });
  assert.equal(res.status, 500);

  db.sql.close();
});

test('comments authorName and content length validation', async () => {
  const db = database();
  const valid = { turnstileToken: 'valid-token' };

  // Bad bodies
  for (const body of ['{', {}, null, { authorName: 1, content: 'x', ...valid }]) {
    assert.equal((await call(comments, db, 'POST', body)).status, 400);
  }

  // authorName bounds: 1 - 32 characters
  assert.equal((await call(comments, db, 'POST', { authorName: '', content: 'hello', ...valid })).status, 400);
  assert.equal((await call(comments, db, 'POST', { authorName: '   ', content: 'hello', ...valid })).status, 400);
  assert.equal((await call(comments, db, 'POST', { authorName: 'a'.repeat(33), content: 'hello', ...valid })).status, 400);
  // 32 chars should succeed
  let res = await call(comments, db, 'POST', { authorName: 'a'.repeat(32), content: 'hello', ...valid });
  assert.equal(res.status, 201);

  // content bounds: 1 - 1000 characters
  const db2 = database();
  assert.equal((await call(comments, db2, 'POST', { authorName: 'Alice', content: '', ...valid })).status, 400);
  assert.equal((await call(comments, db2, 'POST', { authorName: 'Alice', content: '   ', ...valid })).status, 400);
  assert.equal((await call(comments, db2, 'POST', { authorName: 'Alice', content: 'c'.repeat(1001), ...valid })).status, 400);
  // 1000 chars should succeed
  res = await call(comments, db2, 'POST', { authorName: 'Alice', content: 'c'.repeat(1000), ...valid });
  assert.equal(res.status, 201);

  db.sql.close();
  db2.sql.close();
});

test('rate limiting: 30-second interval, 10-minute cap, and visitor isolation', async () => {
  const db = database();
  const valid = { turnstileToken: 'valid-token' };

  // First comment succeeds
  let res = await call(comments, db, 'POST', { authorName: 'Alice', content: 'First comment', ...valid });
  assert.equal(res.status, 201);
  const cookie = cookieOf(res);
  const comment = await res.json();
  assert.equal(comment.authorName, 'Alice');
  assert.equal(comment.content, 'First comment');
  assert.ok(!('visitor_id' in comment));

  // Same visitor posts immediately (< 30s) -> 429
  res = await call(comments, db, 'POST', { authorName: 'Alice', content: 'Second comment', ...valid }, cookie);
  assert.equal(res.status, 429);
  const errBody = await res.json();
  assert.deepEqual(errBody, { error: 'Too many comments' });
  assert.ok(!JSON.stringify(errBody).includes('visitor'));

  // A DIFFERENT visitor can comment immediately without being blocked
  let resOther = await call(comments, db, 'POST', { authorName: 'Bob', content: 'Other visitor comment', ...valid });
  assert.equal(resOther.status, 201);
  const otherCookie = cookieOf(resOther);

  // Manipulate created_at of existing comments to simulate passage of 35 seconds
  db.sql.prepare("UPDATE comments SET created_at = datetime('now', '-35 seconds') WHERE author_name = 'Alice'").run();

  // Now first visitor can comment again
  res = await call(comments, db, 'POST', { authorName: 'Alice', content: 'Third comment', ...valid }, cookie);
  assert.equal(res.status, 201);

  // Insert 3 more comments for Alice spread out over the last 5 minutes (total 5 comments in 10 minutes)
  const vid = cookie.split(';')[0].replace('alister_visitor_id=', '');
  db.sql.prepare("INSERT INTO comments (id, post_slug, visitor_id, author_name, content, status, created_at) VALUES (?, ?, ?, ?, ?, 'published', datetime('now', '-2 minutes'))")
    .run(crypto.randomUUID(), 'hello-alister-blog', vid, 'Alice', 'Extra 1');
  db.sql.prepare("INSERT INTO comments (id, post_slug, visitor_id, author_name, content, status, created_at) VALUES (?, ?, ?, ?, ?, 'published', datetime('now', '-3 minutes'))")
    .run(crypto.randomUUID(), 'hello-alister-blog', vid, 'Alice', 'Extra 2');
  db.sql.prepare("INSERT INTO comments (id, post_slug, visitor_id, author_name, content, status, created_at) VALUES (?, ?, ?, ?, ?, 'published', datetime('now', '-4 minutes'))")
    .run(crypto.randomUUID(), 'hello-alister-blog', vid, 'Alice', 'Extra 3');

  // Verify Alice has 5 comments in 10-min window
  const countRow = db.sql.prepare("SELECT COUNT(*) AS c FROM comments WHERE visitor_id = ? AND created_at >= datetime('now', '-10 minutes')").get(vid);
  assert.equal(countRow.c, 5);

  // Alice tries 6th comment after 35s from last one -> 429 (exceeds 5 comments per 10 min)
  db.sql.prepare("UPDATE comments SET created_at = datetime('now', '-40 seconds') WHERE content = 'Third comment'").run();
  res = await call(comments, db, 'POST', { authorName: 'Alice', content: 'Sixth comment attempt', ...valid }, cookie);
  assert.equal(res.status, 429);
  assert.deepEqual(await res.json(), { error: 'Too many comments' });

  // Other visitor Bob is NOT affected by Alice's rate limit
  db.sql.prepare("UPDATE comments SET created_at = datetime('now', '-35 seconds') WHERE author_name = 'Bob'").run();
  resOther = await call(comments, db, 'POST', { authorName: 'Bob', content: 'Bob second comment', ...valid }, otherCookie);
  assert.equal(resOther.status, 201);

  db.sql.close();
});

test('invalid inputs, SQL-like slugs, methods and internal errors', async () => {
  const db = database();
  for (const body of ['{','null','[]',{}, { type: true }, { type: 'other' }]) {
    assert.equal((await call(reactions, db, 'PUT', body)).status, 400);
  }
  for (const fn of [reactions, comments, views]) {
    for (const slug of ['x'.repeat(201), 'a.b', "a' OR 1=1", '中文']) {
      assert.equal((await call(fn, db, 'GET', undefined, undefined, slug)).status, 400);
    }
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
