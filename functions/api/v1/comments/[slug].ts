import { json, objectBody, validSlug, visitor, type Env } from '../../../_lib/http';

type Comment = { id: string; authorName: string; content: string; createdAt: string };

export const onRequest: PagesFunction<Env> = async ({ request, params, env }) => {
  if (!validSlug(params.slug)) return json({ error: 'Invalid slug' }, 400);
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
  const slug = params.slug;
  const identity = visitor(request);
  try {
    if (request.method === 'GET') {
      const result = await env.DB.prepare(`SELECT id, author_name AS authorName, content, created_at AS createdAt
        FROM comments WHERE post_slug = ? AND status = 'published' ORDER BY created_at ASC, id ASC`).bind(slug).all<Comment>();
      return json(result.results, 200, identity.cookie);
    }
    const body = await objectBody(request);
    if (!body || typeof body.authorName !== 'string' || typeof body.content !== 'string') {
      return json({ error: 'Invalid comment' }, 400);
    }
    const authorName = body.authorName.trim();
    const content = body.content.trim();
    if ([...authorName].length < 1 || [...authorName].length > 32 || [...content].length < 1 || [...content].length > 1000) {
      return json({ error: 'Invalid comment length' }, 400);
    }
    const id = crypto.randomUUID();
    const comment = await env.DB.prepare(`INSERT INTO comments (id, post_slug, visitor_id, author_name, content)
      VALUES (?, ?, ?, ?, ?) RETURNING id, author_name AS authorName, content, created_at AS createdAt`)
      .bind(id, slug, identity.id, authorName, content).first<Comment>();
    return json(comment, 201, identity.cookie);
  } catch { return json({ error: 'Internal server error' }, 500, identity.cookie); }
};
