import { readFileSync } from 'node:fs';
import { createTestApp, type TestApp } from './support/app.js';

/**
 * The web (and later mobile) client is generated from packages/api-client/openapi.json. Every operation in it must
 * be served by the app as assembled in AppModule: a module that isn't registered, or a route renamed without
 * regenerating the client, fails here instead of as "Cannot GET …" in the browser.
 */
const doc = JSON.parse(readFileSync(new URL('../../../packages/api-client/openapi.json', import.meta.url), 'utf8')) as {
  paths: Record<string, Record<string, unknown>>;
};
const SAMPLE_ID = '00000000-0000-7000-8000-000000000000';
const operations = Object.entries(doc.paths).flatMap(([path, methods]) =>
  Object.keys(methods)
    .filter((m) => ['get', 'post', 'put', 'patch', 'delete'].includes(m))
    .map((method) => ({ method, path, url: path.replace(/\{[^}]+\}/g, SAMPLE_ID) })),
);

describe('client contract: every generated operation is served', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('covers the dashboard explicitly', () => {
    expect(operations.map((o) => `${o.method.toUpperCase()} ${o.path}`)).toContain('GET /v1/dashboard');
  });

  it.each(operations.map((o) => [`${o.method.toUpperCase()} ${o.path}`, o] as const))('%s', async (_, o) => {
    const res = await (
      t.http() as unknown as Record<string, (url: string) => Promise<{ status: number; body: { code?: string } }>>
    )[o.method]!(o.url);
    // Reaching the route means auth (401), validation or a normal response, never "no such endpoint".
    expect(res.body.code).not.toBe('ROUTE_NOT_FOUND');
    expect(res.status).not.toBe(405);
  });

  it('answers unknown routes with a plain problem, not framework text', async () => {
    const res = await t.http().get('/v1/definitely-not-a-route').expect(404);
    expect(res.body).toMatchObject({ code: 'ROUTE_NOT_FOUND', detail: 'This endpoint does not exist' });
    expect(JSON.stringify(res.body)).not.toContain('Cannot GET');
  });
});
