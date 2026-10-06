import { createTestApp, type TestApp } from './support/app.js';

describe('GET /v1/health (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it('returns ok without authentication', () => {
    return t.http().get('/v1/health').expect(200).expect({ status: 'ok' });
  });

  it('tags responses with a request id', async () => {
    const res = await t.http().get('/v1/health');
    expect(res.headers['x-request-id']).toMatch(/^[\w-]{8,64}$/);
  });
});
