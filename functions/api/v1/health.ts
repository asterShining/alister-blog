import { json, type Env } from '../../_lib/http';

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  try {
    await env.DB.prepare('SELECT 1').first();
    return json({ status: 'ok', database: 'connected' });
  } catch {
    return json({ status: 'degraded', database: 'unavailable' }, 503);
  }
};
