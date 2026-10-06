import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld } from './support/world.js';

describe('rate limiting', () => {
  let t: TestApp;
  const previous = process.env.RATE_LIMIT_MULTIPLIER;

  beforeAll(async () => {
    process.env.RATE_LIMIT_MULTIPLIER = '1';
    t = await createTestApp();
    await resetDb(t.prisma);
    await seedWorld(t.prisma);
  });
  afterAll(async () => {
    process.env.RATE_LIMIT_MULTIPLIER = previous;
    await t.close();
  });

  it('limits auth-tier routes to 10 per minute per user, independently per user', async () => {
    for (let i = 0; i < 10; i++) {
      await t
        .as('ownerA')
        .patch('/v1/me', { phone: `604-555-01${i}0` })
        .expect(200);
    }
    const res = await t.as('ownerA').patch('/v1/me', { phone: '604-555-0999' }).expect(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(res.headers['retry-after-user-auth']).toBeDefined();

    // Another user is unaffected, and reads stay on the default tier.
    await t.as('ownerB').patch('/v1/me', { phone: '604-555-0100' }).expect(200);
    await t.as('ownerA').get('/v1/me').expect(200);
  });

  it('limits public routes per IP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) statuses.push((await t.http().get('/v1/health')).status);
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  });
});
