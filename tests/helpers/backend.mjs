import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const httpHelper = ts.transpileModule(readFileSync('functions/_lib/http.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const httpHelperUrl = `data:text/javascript;base64,${Buffer.from(httpHelper).toString('base64')}`;

const turnstileHelper = ts.transpileModule(readFileSync('functions/_lib/turnstile.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const turnstileHelperUrl = `data:text/javascript;base64,${Buffer.from(turnstileHelper).toString('base64')}`;

export async function handler(path) {
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText
    .replace(/from ['"][^'"]*_lib\/http['"]/g, `from '${httpHelperUrl}'`)
    .replace(/from ['"][^'"]*_lib\/turnstile['"]/g, `from '${turnstileHelperUrl}'`);
  return (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).onRequest;
}

export function database() {
  const sql = new DatabaseSync(':memory:');
  for (const migration of ['0001_public_interactions.sql', '0002_post_views.sql', '0003_comment_rate_limit.sql', '0004_community_public.sql']) {
    sql.exec(readFileSync(`migrations/${migration}`, 'utf8'));
  }
  return {
    sql,
    prepare(query) {
      const statement = sql.prepare(query);
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { return statement.get(...args) ?? null; },
        async all() { return { results: statement.all(...args) }; },
        async run() { return statement.run(...args); },
      };
    },
  };
}

const defaultFetch = async (url, options) => {
  if (url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
    const params = new URLSearchParams(options.body.toString());
    const token = params.get('response');
    if (token === 'valid-token' || token === '1x00000000000000000000AA' || token === 'test-token') {
      return new Response(JSON.stringify({ success: true, action: 'comment_submit', hostname: 'alistereno.top' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return fetch(url, options);
};

export function call(fn, DB, method = 'GET', body, cookie, slug = 'hello-alister-blog', envOverrides = {}, urlOverride) {
  const headers = cookie ? { Cookie: cookie } : {};
  const requestUrl = urlOverride || `https://example.test/api/v1/test/${slug}`;
  return fn({
    env: { DB, TURNSTILE_SECRET: '1x0000000000000000000000000000000AA', fetch: defaultFetch, ...envOverrides },
    params: { slug },
    request: new Request(requestUrl, {
      method,
      headers,
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    }),
  });
}

export function cookieOf(response) {
  return response.headers.get('set-cookie')?.split(';')[0];
}
