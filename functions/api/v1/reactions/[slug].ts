import { json, objectBody, validSlug, visitor, type Env } from '../../../_lib/http';

type Summary = { likes: number; dislikes: number; viewerReaction: 'like' | 'dislike' | null };

export const onRequest: PagesFunction<Env> = async ({ request, params, env }) => {
  if (!validSlug(params.slug)) return json({ error: 'Invalid slug' }, 400);
  if (!['GET', 'PUT'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
  const slug = params.slug;
  const identity = visitor(request);
  try {
    if (request.method === 'PUT') {
      const body = await objectBody(request);
      if (!body || !('type' in body) || ![null, 'like', 'dislike'].includes(body.type as string | null)) {
        return json({ error: 'Invalid reaction type' }, 400);
      }
      if (body.type === null) {
        await env.DB.prepare('DELETE FROM reactions WHERE post_slug = ? AND visitor_id = ?').bind(slug, identity.id).run();
      } else {
        await env.DB.prepare(`INSERT INTO reactions (id, post_slug, visitor_id, type) VALUES (?, ?, ?, ?)
          ON CONFLICT(post_slug, visitor_id) DO UPDATE SET type = excluded.type, updated_at = CURRENT_TIMESTAMP
          WHERE reactions.type != excluded.type`).bind(crypto.randomUUID(), slug, identity.id, body.type).run();
      }
    }
    const result = await env.DB.prepare(`SELECT
      COALESCE(SUM(type = 'like'), 0) AS likes,
      COALESCE(SUM(type = 'dislike'), 0) AS dislikes,
      MAX(CASE WHEN visitor_id = ? THEN type END) AS viewerReaction
      FROM reactions WHERE post_slug = ?`).bind(identity.id, slug).first<Summary>();
    return json(result ?? { likes: 0, dislikes: 0, viewerReaction: null }, 200, identity.cookie);
  } catch { return json({ error: 'Internal server error' }, 500, identity.cookie); }
};
