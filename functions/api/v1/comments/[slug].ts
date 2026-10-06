import { json, objectBody, validSlug, visitor, type Env } from '../../../_lib/http';
import { verifyTurnstile } from '../../../_lib/turnstile';

type Comment = { id: string; authorName: string; content: string; createdAt: string };

/** Production hostname for Turnstile hostname validation. */
const PRODUCTION_HOSTNAME = 'alistereno.top';

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

    // --- POST: validate input ---
    const body = await objectBody(request);
    if (!body || typeof body.authorName !== 'string' || typeof body.content !== 'string') {
      return json({ error: 'Invalid comment' }, 400);
    }
    const authorName = body.authorName.trim();
    const content = body.content.trim();
    if ([...authorName].length < 1 || [...authorName].length > 32 || [...content].length < 1 || [...content].length > 1000) {
      return json({ error: 'Invalid comment length' }, 400);
    }

    // --- Turnstile verification ---
    if (!body.turnstileToken || typeof body.turnstileToken !== 'string') {
      return json({ error: 'Verification token required' }, 400);
    }
    const secret = env.TURNSTILE_SECRET;
    if (!secret) return json({ error: 'Internal server error' }, 500);

    const requestUrl = new URL(request.url);
    const isProduction = requestUrl.hostname === PRODUCTION_HOSTNAME;
    const fetchFn = (env as unknown as { fetch?: typeof fetch }).fetch ?? fetch;

    const turnstile = await verifyTurnstile(secret, body.turnstileToken as string, {
      fetchFn,
      expectedAction: 'comment_submit',
      expectedHostname: PRODUCTION_HOSTNAME,
      allowLocalhost: !isProduction,
    });
    if (!turnstile.success) {
      return json({ error: turnstile.error ?? 'Comment verification failed' }, 400, identity.cookie);
    }

    // --- Rate limiting by anonymous visitor ---
    const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString().replace('T', ' ').slice(0, 19);
    const tenMinutesAgo = new Date(Date.now() - 600_000).toISOString().replace('T', ' ').slice(0, 19);

    const recent = await env.DB.prepare(
      `SELECT created_at AS createdAt FROM comments WHERE visitor_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 1`
    ).bind(identity.id, thirtySecondsAgo).first<{ createdAt: string }>();
    if (recent) return json({ error: 'Too many comments' }, 429, identity.cookie);

    const windowCount = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM comments WHERE visitor_id = ? AND created_at >= ?`
    ).bind(identity.id, tenMinutesAgo).first<{ count: number }>();
    if (windowCount && windowCount.count >= 5) return json({ error: 'Too many comments' }, 429, identity.cookie);

    // --- Insert comment ---
    const id = crypto.randomUUID();
    const comment = await env.DB.prepare(`INSERT INTO comments (id, post_slug, visitor_id, author_name, content)
      VALUES (?, ?, ?, ?, ?) RETURNING id, author_name AS authorName, content, created_at AS createdAt`)
      .bind(id, slug, identity.id, authorName, content).first<Comment>();
    return json(comment, 201, identity.cookie);
  } catch { return json({ error: 'Internal server error' }, 500, identity.cookie); }
};
