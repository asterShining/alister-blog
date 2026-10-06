import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, database, handler } from './helpers/backend.mjs';

const postsListHandler = await handler('functions/api/v1/community/posts/index.ts');
const postDetailHandler = await handler('functions/api/v1/community/posts/[slug].ts');

test('community posts GET empty list returns code 0 and empty posts array', async () => {
  const db = database();
  const res = await call(postsListHandler, db, 'GET', undefined, undefined, '', {}, 'https://example.test/api/v1/community/posts');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data, {
    code: 0,
    data: {
      posts: [],
      total: 0,
    },
  });
  db.sql.close();
});

test('community posts list pagination and ordering', async () => {
  const db = database();

  // Insert 5 public posts with different published_at
  for (let i = 1; i <= 5; i++) {
    db.sql.prepare(`
      INSERT INTO community_posts (id, slug, title, content, visibility, published_at, created_at)
      VALUES (?, ?, ?, ?, 'public', ?, ?)
    `).run(
      `p_${i}`,
      `post-${i}`,
      `Post ${i}`,
      `Content ${i}`,
      `2026-10-0${i} 12:00:00`,
      `2026-10-0${i} 12:00:00`
    );
  }

  // Page 1: limit 2, offset 0 -> should return post 5 and post 4
  const res1 = await call(
    postsListHandler,
    db,
    'GET',
    undefined,
    undefined,
    '',
    {},
    'https://example.test/api/v1/community/posts?limit=2&offset=0'
  );
  assert.equal(res1.status, 200);
  const json1 = await res1.json();
  assert.equal(json1.code, 0);
  assert.equal(json1.data.total, 5);
  assert.equal(json1.data.posts.length, 2);
  assert.equal(json1.data.posts[0].slug, 'post-5');
  assert.equal(json1.data.posts[1].slug, 'post-4');

  // Page 2: limit 2, offset 2 -> should return post 3 and post 2
  const res2 = await call(
    postsListHandler,
    db,
    'GET',
    undefined,
    undefined,
    '',
    {},
    'https://example.test/api/v1/community/posts?limit=2&offset=2'
  );
  assert.equal(res2.status, 200);
  const json2 = await res2.json();
  assert.equal(json2.data.posts.length, 2);
  assert.equal(json2.data.posts[0].slug, 'post-3');
  assert.equal(json2.data.posts[1].slug, 'post-2');

  db.sql.close();
});

test('community visibility filtering: unlisted does not appear in list', async () => {
  const db = database();

  db.sql.prepare(`
    INSERT INTO community_posts (id, slug, title, content, visibility, published_at, created_at)
    VALUES ('pub_1', 'public-one', 'Public Title', 'Public Content', 'public', '2026-10-06 10:00:00', '2026-10-06 10:00:00')
  `).run();

  db.sql.prepare(`
    INSERT INTO community_posts (id, slug, title, content, visibility, published_at, created_at)
    VALUES ('unl_1', 'unlisted-secret', 'Unlisted Title', 'Unlisted Content', 'unlisted', '2026-10-06 11:00:00', '2026-10-06 11:00:00')
  `).run();

  const listRes = await call(postsListHandler, db, 'GET', undefined, undefined, '', {}, 'https://example.test/api/v1/community/posts');
  assert.equal(listRes.status, 200);
  const listJson = await listRes.json();
  assert.equal(listJson.data.total, 1);
  assert.equal(listJson.data.posts.length, 1);
  assert.equal(listJson.data.posts[0].slug, 'public-one');
  assert.ok(!listJson.data.posts.some((p) => p.slug === 'unlisted-secret'));

  db.sql.close();
});

test('community detail GET: unlisted is accessible via exact slug', async () => {
  const db = database();

  db.sql.prepare(`
    INSERT INTO community_posts (id, slug, title, content, visibility, published_at, created_at)
    VALUES ('unl_1', 'unlisted-secret', 'Unlisted Title', 'Unlisted Content', 'unlisted', '2026-10-06 11:00:00', '2026-10-06 11:00:00')
  `).run();

  const detailRes = await call(postDetailHandler, db, 'GET', undefined, undefined, 'unlisted-secret');
  assert.equal(detailRes.status, 200);
  const detailJson = await detailRes.json();
  assert.equal(detailJson.code, 0);
  assert.equal(detailJson.data.slug, 'unlisted-secret');
  assert.equal(detailJson.data.title, 'Unlisted Title');
  assert.equal(detailJson.data.author.name, 'Alister');
  assert.equal(detailJson.data.author.avatar, '/images/profile/avatar.webp');

  db.sql.close();
});

test('community detail GET: returns images and omits internal fields', async () => {
  const db = database();

  db.sql.prepare(`
    INSERT INTO community_posts (id, slug, title, content, visibility, published_at, created_at)
    VALUES ('p_img', 'post-with-images', 'Photo Post', 'Hello with images', 'public', '2026-10-06 12:00:00', '2026-10-06 12:00:00')
  `).run();

  db.sql.prepare(`
    INSERT INTO community_post_images (id, post_id, url, alt_text, width, height, sort_order)
    VALUES ('img_2', 'p_img', 'https://example.com/2.webp', 'Image 2', 800, 600, 2)
  `).run();

  db.sql.prepare(`
    INSERT INTO community_post_images (id, post_id, url, alt_text, width, height, sort_order)
    VALUES ('img_1', 'p_img', 'https://example.com/1.webp', 'Image 1', 1200, 900, 1)
  `).run();

  const detailRes = await call(postDetailHandler, db, 'GET', undefined, undefined, 'post-with-images');
  assert.equal(detailRes.status, 200);
  const json = await detailRes.json();
  assert.equal(json.data.images.length, 2);
  assert.equal(json.data.images[0].url, 'https://example.com/1.webp');
  assert.equal(json.data.images[1].url, 'https://example.com/2.webp');
  assert.ok(!('object_key' in json.data.images[0]));
  assert.ok(!('post_id' in json.data.images[0]));

  db.sql.close();
});

test('community detail GET: invalid slug returns 400', async () => {
  const db = database();
  const res = await call(postDetailHandler, db, 'GET', undefined, undefined, 'bad/slug/123');
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.code, 400);
  assert.equal(json.error, 'INVALID_SLUG');
  db.sql.close();
});

test('community detail GET: 404 for non-existent post', async () => {
  const db = database();
  const res = await call(postDetailHandler, db, 'GET', undefined, undefined, 'does-not-exist');
  assert.equal(res.status, 404);
  const json = await res.json();
  assert.equal(json.code, 404);
  assert.equal(json.error, 'POST_NOT_FOUND');
  db.sql.close();
});

test('community SQL errors sanitized without leaking details', async () => {
  const badDb = {
    prepare() {
      throw new Error('Fatal sqlite syntax error: select * from broken');
    },
  };

  const listRes = await call(postsListHandler, badDb, 'GET', undefined, undefined, '', {}, 'https://example.test/api/v1/community/posts');
  assert.equal(listRes.status, 500);
  const listJson = await listRes.json();
  assert.equal(listJson.code, 500);
  assert.equal(listJson.error, 'INTERNAL_ERROR');
  assert.ok(!JSON.stringify(listJson).includes('sqlite'));

  const detailRes = await call(postDetailHandler, badDb, 'GET', undefined, undefined, 'valid-slug');
  assert.equal(detailRes.status, 500);
  const detailJson = await detailRes.json();
  assert.equal(detailJson.code, 500);
  assert.equal(detailJson.error, 'INTERNAL_ERROR');
  assert.ok(!JSON.stringify(detailJson).includes('sqlite'));
});
