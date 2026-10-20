import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

describe('onboarding: welcome tours', () => {
  let t: TestApp;
  let w: World;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    w = await seedWorld(t.prisma);
  });

  const tours = async (as: string) => (await t.as(as).get('/v1/me/onboarding').expect(200)).body.tours;
  const move = (as: string, role: string, body: object) => t.as(as).post(`/v1/me/onboarding/tours/${role}`, body);

  it('offers one tour per role held: admin (not owner) for the admin, owner, cleaner, none for an outsider', async () => {
    const fresh = { status: 'NOT_STARTED', step: null, offer: true };
    expect(await tours('admin')).toEqual([{ role: 'ADMIN', ...fresh }]);
    expect(await tours('ownerA')).toEqual([{ role: 'OWNER', ...fresh }]);
    expect(await tours('cleanerB')).toEqual([{ role: 'CLEANER', ...fresh }]);
    expect(await tours('outsider')).toEqual([]);
  });

  it('gives someone who owns one property and cleans another both tours, owner first', async () => {
    await t.prisma.membership.create({
      data: { userId: w.users.ownerA.id, propertyId: w.propertyB.id, role: 'CLEANER', createdById: w.users.admin.id },
    });
    expect((await tours('ownerA')).map((x: { role: string }) => x.role)).toEqual(['OWNER', 'CLEANER']);
  });

  it('records starting, each step, and finishing; a finished tour is no longer offered', async () => {
    let res = (await move('ownerA', 'OWNER', { action: 'START' }).expect(200)).body.tours[0];
    expect(res).toEqual({ role: 'OWNER', status: 'IN_PROGRESS', step: 0, offer: true });
    res = (await move('ownerA', 'OWNER', { action: 'STEP', step: 3 }).expect(200)).body.tours[0];
    expect(res).toMatchObject({ status: 'IN_PROGRESS', step: 3, offer: true });
    res = (await move('ownerA', 'OWNER', { action: 'COMPLETE' }).expect(200)).body.tours[0];
    expect(res).toEqual({ role: 'OWNER', status: 'COMPLETED', step: null, offer: false });
    // Another user's progress is untouched.
    expect((await tours('ownerB'))[0]).toMatchObject({ status: 'NOT_STARTED', offer: true });
  });

  it('remembers where a skipped tour stopped, and RESET offers it again', async () => {
    const skipped = (await move('cleanerA', 'CLEANER', { action: 'SKIP', step: 2 }).expect(200)).body.tours[0];
    expect(skipped).toEqual({ role: 'CLEANER', status: 'SKIPPED', step: 2, offer: false });
    const reset = (await move('cleanerA', 'CLEANER', { action: 'RESET' }).expect(200)).body.tours[0];
    expect(reset).toEqual({ role: 'CLEANER', status: 'NOT_STARTED', step: null, offer: true });
  });

  it("is not found for a role the caller doesn't hold, and refuses bad input", async () => {
    expect((await move('ownerA', 'ADMIN', { action: 'START' }).expect(404)).body.code).toBe('NOT_FOUND');
    expect((await move('admin', 'OWNER', { action: 'START' }).expect(404)).body.code).toBe('NOT_FOUND');
    for (const bad of [
      { action: 'STEP' },
      { action: 'STEP', step: -1 },
      { action: 'COMPLETE', step: 2 },
      { action: 'JUMP' },
    ]) {
      expect((await move('ownerA', 'OWNER', bad).expect(400)).body.code).toBe('VALIDATION_FAILED');
    }
    expect((await move('ownerA', 'owner', { action: 'START' }).expect(400)).body.code).toBe('VALIDATION_FAILED');
  });

  it('keeps step and version in range in the database', async () => {
    const insert = (step: number | null, version: number) =>
      t.prisma.$executeRawUnsafe(
        `INSERT INTO "OnboardingProgress" ("userId", role, "tourStep", "tourVersion", "updatedAt")
         VALUES ($1::uuid, 'OWNER', $2, $3, now())`,
        w.users.ownerA.id,
        step,
        version,
      );
    await expect(insert(-1, 1)).rejects.toThrow(/OnboardingProgress_tourStep_check/);
    await expect(insert(0, 0)).rejects.toThrow(/OnboardingProgress_tourVersion_check/);
    await expect(insert(null, 1)).resolves.toBe(1);
  });
});
