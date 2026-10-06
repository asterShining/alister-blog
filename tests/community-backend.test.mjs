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
    INSERT INTO community_post_images (id, post_id, object_key, alt_text, sort_order)
    VALUES ('img_2', 'p_img', '2.webp', 'Image 2', 2)
  `).run();

  db.sql.prepare(`
    INSERT INTO community_post_images (id, post_id, object_key, alt_text, sort_order)
    VALUES ('img_1', 'p_img', '/1.webp', 'Image 1', 1)
  `).run();

  const detailRes = await call(postDetailHandler, db, 'GET', undefined, undefined, 'post-with-images', { COMMUNITY_MEDIA_BASE_URL: 'https://example.com/' });
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

test('replica image columns, checks, unique constraint and indexes match publisher', () => {
  const db = database();
  assert.deepEqual(db.sql.prepare('PRAGMA table_info(community_post_images)').all().map(c => c.name), ['id', 'post_id', 'object_key', 'alt_text', 'sort_order', 'created_at']);
  db.sql.exec("INSERT INTO community_posts (id, slug, title, content) VALUES ('p', 'p', 'P', '')");
  const insert = db.sql.prepare('INSERT INTO community_post_images (id, post_id, object_key, sort_order) VALUES (?, ?, ?, ?)');
  assert.throws(() => insert.run('empty', 'p', '  ', 0), /CHECK/);
  assert.throws(() => insert.run('negative', 'p', 'a.webp', -1), /CHECK/);
  insert.run('valid', 'p', 'a.webp', 0);
  assert.throws(() => insert.run('duplicate', 'p', 'b.webp', 0), /UNIQUE/);
  const index = db.sql.prepare('PRAGMA index_xinfo(idx_community_posts_visibility_published)').all().filter(c => c.key);
  assert.deepEqual(index.map(c => [c.name, c.desc]), [['visibility', 0], ['published_at', 1], ['created_at', 1]]);
  assert.deepEqual(db.sql.prepare('PRAGMA index_info(idx_community_post_images_post_id)').all().map(c => c.name), ['post_id', 'sort_order']);
  db.sql.close();
});

test('media config missing: imageless posts succeed; actual images fail safely in both endpoints', async () => {
  const db = database();
  db.sql.exec("INSERT INTO community_posts (id, slug, title, content) VALUES ('p', 'p', 'P', '')");
  for (const fn of [postsListHandler, postDetailHandler]) assert.equal((await call(fn, db, 'GET', undefined, undefined, 'p')).status, 200);
  db.sql.exec("INSERT INTO community_post_images (id, post_id, object_key) VALUES ('i', 'p', '/private-key.webp')");
  for (const fn of [postsListHandler, postDetailHandler]) {
    const failed = await call(fn, db, 'GET', undefined, undefined, 'p');
    assert.equal(failed.status, 500);
    assert.ok(!/private-key|object_key|COMMUNITY_MEDIA_BASE_URL/.test(await failed.text()));
    for (const base of ['https://media.example.test/images', 'https://media.example.test/images/']) {
      const success = await call(fn, db, 'GET', undefined, undefined, 'p', { COMMUNITY_MEDIA_BASE_URL: base });
      assert.equal(success.status, 200);
      const dto = await success.json();
      const images = fn === postsListHandler ? dto.data.posts[0].images : dto.data.images;
      assert.deepEqual(images, [{ url: 'https://media.example.test/images/private-key.webp' }]);
    }
  }
  db.sql.close();
});

test('unsafe object keys and base protocols produce sanitized failures', async () => {
  const db = database();
  db.sql.exec("INSERT INTO community_posts (id, slug, title, content) VALUES ('p', 'p', 'P', '')");
  const insert = db.sql.prepare('INSERT INTO community_post_images (id, post_id, object_key) VALUES (?, ?, ?)');
  for (const key of ['javascript:alert(1)', 'data:image/png;base64,a', '../private', '%2e%2e/private', 'https://other.test/a']) {
    insert.run('i', 'p', key);
    assert.equal((await call(postDetailHandler, db, 'GET', undefined, undefined, 'p', { COMMUNITY_MEDIA_BASE_URL: 'https://media.example.test/' })).status, 500);
    db.sql.exec("DELETE FROM community_post_images WHERE id = 'i'");
  }
  insert.run('i', 'p', 'a.webp');
  for (const base of ['javascript:alert(1)', 'data:text/plain,a']) assert.equal((await call(postDetailHandler, db, 'GET', undefined, undefined, 'p', { COMMUNITY_MEDIA_BASE_URL: base })).status, 500);
  db.sql.close();
});

test('list breaks published_at ties by created_at descending', async () => {
  const db = database();
  const insert = db.sql.prepare('INSERT INTO community_posts (id, slug, title, content, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  insert.run('older', 'older', 'Older', '', '2026-10-06 12:00:00', '2026-10-06 10:00:00');
  insert.run('newer', 'newer', 'Newer', '', '2026-10-06 12:00:00', '2026-10-06 11:00:00');
  const response = await call(postsListHandler, db);
  assert.deepEqual((await response.json()).data.posts.map(p => p.slug), ['newer', 'older']);
  db.sql.close();
});
