import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

describe('my guide character', () => {
  let t: TestApp;
  let w: World;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    t.identity.reset();
    w = await seedWorld(t.prisma);
  });

  it('defaults to Sage', async () => {
    const res = await t.as('cleanerA').get('/v1/me').expect(200);
    expect(res.body.guide).toBe('SAGE');
  });

  it('lets every user change their own guide, and only theirs', async () => {
    for (const key of ['admin', 'ownerA', 'cleanerA'] as const) {
      const res = await t.as(key).patch('/v1/me', { guide: 'JUNIPER' }).expect(200);
      expect(res.body.guide).toBe('JUNIPER');
    }
    expect((await t.as('ownerA').get('/v1/me').expect(200)).body.guide).toBe('JUNIPER');
    expect((await t.prisma.user.findUniqueOrThrow({ where: { id: w.users.ownerB.id } })).guide).toBe('SAGE');
  });

  it('leaves the other profile fields alone when only the guide changes', async () => {
    await t.as('ownerA').patch('/v1/me', { phone: '604-555-0100' }).expect(200);
    const res = await t.as('ownerA').patch('/v1/me', { guide: 'PIP' }).expect(200);
    expect(res.body).toMatchObject({ guide: 'PIP', firstName: 'ownerA', phone: '604-555-0100' });
  });

  it('leaves the guide alone when other fields change', async () => {
    await t.as('ownerA').patch('/v1/me', { guide: 'PIP' }).expect(200);
    const res = await t.as('ownerA').patch('/v1/me', { firstName: 'Ann' }).expect(200);
    expect(res.body.guide).toBe('PIP');
  });

  it.each([['OTTER'], ['sage'], [''], [null], [3]])('rejects %j as a guide', async (guide) => {
    const res = await t.as('ownerA').patch('/v1/me', { guide }).expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect((await t.prisma.user.findUniqueOrThrow({ where: { id: w.users.ownerA.id } })).guide).toBe('SAGE');
  });
});
