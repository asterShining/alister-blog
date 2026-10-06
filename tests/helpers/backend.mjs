import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const helper = ts.transpileModule(readFileSync('functions/_lib/http.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const helperUrl = `data:text/javascript;base64,${Buffer.from(helper).toString('base64')}`;

export async function handler(path) {
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText.replace(/from ['"][^'"]*_lib\/http['"]/g, `from '${helperUrl}'`);
  return (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).onRequest;
}

export function database() {
  const sql = new DatabaseSync(':memory:');
  for (const migration of ['0001_public_interactions.sql', '0002_post_views.sql']) {
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

export function call(fn, DB, method = 'GET', body, cookie, slug = 'hello-alister-blog') {
  const headers = cookie ? { Cookie: cookie } : {};
  return fn({
    env: { DB },
    params: { slug },
    request: new Request(`https://example.test/api/v1/test/${slug}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    }),
  });
}

export function cookieOf(response) {
  return response.headers.get('set-cookie')?.split(';')[0];
}
