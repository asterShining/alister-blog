import { resolveCommunityImageUrl } from '../../../../_lib/community-media';
import { json, type Env } from '../../../../_lib/http';

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
  postId: string;
  objectKey: string;
  alt?: string | null;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'GET') {
    return json({ code: 405, error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }, 405);
  }

  try {
    const url = new URL(request.url);
    const rawLimit = parseInt(url.searchParams.get('limit') || '20', 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(50, rawLimit);

    const rawOffset = parseInt(url.searchParams.get('offset') || '0', 10);
    const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

    // 1. Total count of public posts
    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM community_posts WHERE visibility = 'public'`
    ).first<{ total: number }>();
    const total = countRow ? Number(countRow.total) : 0;

    // 2. Query paginated public posts
    const postsResult = await env.DB.prepare(
      `SELECT id, slug, title, content, content_format AS contentFormat,
              created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt
       FROM community_posts
       WHERE visibility = 'public'
       ORDER BY published_at DESC, created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(limit, offset).all<RawPost>();

    const rawPosts = postsResult.results || [];
    if (rawPosts.length === 0) {
      return json({ code: 0, data: { posts: [], total } }, 200);
    }

    // 3. Query images for these posts
    const postIds = rawPosts.map((p) => p.id);
    const placeholders = postIds.map(() => '?').join(',');
    const imagesResult = await env.DB.prepare(
      `SELECT post_id AS postId, object_key AS objectKey, alt_text AS alt
       FROM community_post_images
       WHERE post_id IN (${placeholders})
       ORDER BY sort_order ASC`
    ).bind(...postIds).all<RawImage>();

    const imageMap = new Map<string, Array<{ url: string; alt?: string }>>();
    for (const img of imagesResult.results || []) {
      if (!imageMap.has(img.postId)) {
        imageMap.set(img.postId, []);
      }
      imageMap.get(img.postId)!.push({
        url: resolveCommunityImageUrl(img.objectKey, env),
        alt: img.alt || undefined,
      });
    }

    // 4. Assemble public posts response
    const posts = rawPosts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      content: p.content,
      contentFormat: p.contentFormat || 'markdown',
      author: {
        name: 'Alister',
        avatar: '/images/profile/avatar.webp',
      },
      createdAt: p.createdAt,
      updatedAt: p.updatedAt || undefined,
      publishedAt: p.publishedAt || undefined,
      images: imageMap.get(p.id) || [],
    }));

    return json({ code: 0, data: { posts, total } }, 200);
  } catch {
    return json({ code: 500, error: 'INTERNAL_ERROR', message: 'Failed to retrieve community posts' }, 500);
  }
};
