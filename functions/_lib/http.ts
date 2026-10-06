export interface Env { DB: D1Database }

export function json(value: unknown, status = 200, cookie?: string): Response {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  if (cookie) headers.set('Set-Cookie', cookie);
  return new Response(JSON.stringify(value), { status, headers });
}

export function validSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(slug);
}

export function visitor(request: Request): { id: string; cookie?: string } {
  const value = request.headers.get('Cookie')?.split(';').map(part => part.trim())
    .find(part => part.startsWith('alister_visitor_id='))?.slice('alister_visitor_id='.length);
  if (value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return { id: value };
  const id = crypto.randomUUID();
  return { id, cookie: `alister_visitor_id=${id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000` };
}

export async function objectBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}
