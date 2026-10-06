import { json, validSlug, type Env } from '../../../../_lib/http';

interface RawPost {
  id: string;
  slug: string;
  title: string;
  content: string;
  contentFormat: string;
  createdAt: string;
  updatedAt?: string | null;
  publishedAt?: string | null;
}

interface RawImage {
  url: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
}

export const onRequest: PagesFunction<Env> = async ({ request, params, env }) => {
  if (request.method !== 'GET') {
    return json({ code: 405, error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }, 405);
  }

  if (!validSlug(params.slug)) {
    return json({ code: 400, error: 'INVALID_SLUG', message: 'Invalid slug' }, 400);
  }

  try {
    const slug = params.slug as string;

    // 1. Query post by slug with public or unlisted visibility
    const post = await env.DB.prepare(
      `SELECT id, slug, title, content, content_format AS contentFormat,
              created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt
       FROM community_posts
       WHERE slug = ? AND visibility IN ('public', 'unlisted')`
    ).bind(slug).first<RawPost>();

    if (!post) {
      return json({ code: 404, error: 'POST_NOT_FOUND', message: 'Community post not found' }, 404);
    }

    // 2. Query images for this post
    const imagesResult = await env.DB.prepare(
      `SELECT url, alt_text AS alt, width, height
       FROM community_post_images
       WHERE post_id = ?
       ORDER BY sort_order ASC`
    ).bind(post.id).all<RawImage>();

    const images = (imagesResult.results || []).map((img) => ({
      url: img.url,
      alt: img.alt || undefined,
      width: img.width ? Number(img.width) : undefined,
      height: img.height ? Number(img.height) : undefined,
    }));

    // 3. Assemble response
    const data = {
      id: post.id,
      slug: post.slug,
      title: post.title,
      content: post.content,
      contentFormat: post.contentFormat || 'markdown',
      author: {
        name: 'Alister',
        avatar: '/images/profile/avatar.webp',
      },
      createdAt: post.createdAt,
      updatedAt: post.updatedAt || undefined,
      publishedAt: post.publishedAt || undefined,
      images,
    };

    return json({ code: 0, data }, 200);
  } catch {
    return json({ code: 500, error: 'INTERNAL_ERROR', message: 'Failed to retrieve community post' }, 500);
  }
};
