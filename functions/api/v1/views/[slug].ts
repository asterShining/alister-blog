import { json, validSlug, visitor, type Env } from '../../../_lib/http';

type ViewCount = { views: number };

async function countViews(database: D1Database, slug: string): Promise<ViewCount> {
  const result = await database.prepare('SELECT COUNT(*) AS views FROM post_views WHERE post_slug = ?')
    .bind(slug).first<ViewCount>();
  return { views: Number(result?.views ?? 0) };
}

export const onRequest: PagesFunction<Env> = async ({ request, params, env }) => {
  if (!validSlug(params.slug)) return json({ error: 'Invalid slug' }, 400);
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
  const slug = params.slug;

  if (request.method === 'GET') {
    try { return json(await countViews(env.DB, slug)); }
    catch { return json({ error: 'Internal server error' }, 500); }
  }

  const identity = visitor(request);
  const viewBucket = Math.floor(Date.now() / (30 * 60 * 1000));
  try {
    await env.DB.prepare(`INSERT OR IGNORE INTO post_views
      (id, post_slug, visitor_id, view_bucket) VALUES (?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), slug, identity.id, viewBucket).run();
    return json(await countViews(env.DB, slug), 200, identity.cookie);
  } catch { return json({ error: 'Internal server error' }, 500, identity.cookie); }
};
