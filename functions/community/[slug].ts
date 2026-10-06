import type { Env } from '../_lib/http';

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;
  const slug = typeof params.slug === 'string' ? params.slug : '';

  // If this is the shell itself or a static asset, pass through to ASSETS
  if (slug === 'post' || slug === 'index.html' || slug.includes('.')) {
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return fetch(request);
  }

  // Rewrite to fetch the static detail shell asset at /community/post/
  const url = new URL(request.url);
  const shellUrl = new URL('/community/post/', url.origin);

  if (env.ASSETS) {
    return env.ASSETS.fetch(new Request(shellUrl.toString(), request));
  }
  return fetch(new Request(shellUrl.toString(), request));
};
