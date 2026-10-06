import type { Env } from './http';

/** Resolve a canonical object key without exposing storage/configuration details. */
export function resolveCommunityImageUrl(objectKey: string, env: Pick<Env, 'COMMUNITY_MEDIA_BASE_URL'>): string {
  const base = env.COMMUNITY_MEDIA_BASE_URL?.trim();
  const key = objectKey.trim().replace(/^\/+/, '');
  if (!base || !key || /[\\?#\u0000-\u0020]/.test(key) || /^[a-z][a-z0-9+.-]*:/i.test(key)) {
    throw new Error('Community media unavailable');
  }
  const baseUrl = new URL(base);
  if (!['https:', 'http:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error('Community media unavailable');
  }
  const segments = key.split('/');
  if (segments.some(segment => ['.', '..'].includes(decodeURIComponent(segment)))) {
    throw new Error('Community media unavailable');
  }
  return `${baseUrl.href.replace(/\/+$/, '')}/${segments.map(segment => encodeURIComponent(decodeURIComponent(segment))).join('/')}`;
}
