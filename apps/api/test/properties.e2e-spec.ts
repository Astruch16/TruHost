import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

describe('properties', () => {
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

  const ids = (body: { items: { id: string }[] }) => body.items.map((p) => p.id).sort();

  it.each([
    ['admin', () => [w.propertyA.id, w.propertyB.id]],
    ['ownerA', () => [w.propertyA.id]],
    ['ownerB', () => [w.propertyB.id]],
    ['cleanerA', () => [w.propertyA.id]],
    ['cleanerB', () => [w.propertyB.id]],
    ['outsider', () => []],
  ] as const)('lists only the properties %s may see', async (who, expected) => {
    const res = await t.as(who).get('/v1/properties').expect(200);
    expect(ids(res.body)).toEqual(expected().sort());
  });

  it('shows admin-only fields (default cleaner, cleaner pay, cleaning fee) to admins only', async () => {
    const admin = (await t.as('admin').get(`/v1/properties/${w.propertyA.id}`).expect(200)).body;
    expect(admin).toMatchObject({ defaultCleanerId: null, defaultCleanerPayCents: 9000, standardCleaningFeeCents: 0 });
    for (const who of ['ownerA', 'cleanerA']) {
      const body = (await t.as(who).get(`/v1/properties/${w.propertyA.id}`).expect(200)).body;
      expect(body).not.toHaveProperty('defaultCleanerId');
      expect(body).not.toHaveProperty('defaultCleanerPayCents');
      expect(body).not.toHaveProperty('standardCleaningFeeCents');
    }
  });

  it('never stores access codes: the old field is gone and unknown fields are ignored', async () => {
    const res = await t
      .as('admin')
      .patch(`/v1/properties/${w.propertyA.id}`, { accessInstructions: 'Lockbox 1234' })
      .expect(200);
    expect(res.body).not.toHaveProperty('accessInstructions');
    const columns = await t.prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'Property'`;
    expect(columns.map((c) => c.column_name)).not.toContain('accessInstructions');
  });

  describe('default cleaner', () => {
    it('can be set to an active cleaner of the property', async () => {
      const res = await t
        .as('admin')
        .patch(`/v1/properties/${w.propertyA.id}`, {
          defaultCleanerId: w.users.cleanerA.id,
          standardCleaningFeeCents: 12000,
        })
        .expect(200);
      expect(res.body).toMatchObject({ defaultCleanerId: w.users.cleanerA.id, standardCleaningFeeCents: 12000 });
    });

    it.each([
      ['a cleaner of another property', () => w.users.cleanerB.id],
      ['an owner', () => w.users.ownerA.id],
      ['an unknown user', () => '00000000-0000-7000-8000-000000000000'],
    ])('rejects %s', async (_, id) => {
      const res = await t.as('admin').patch(`/v1/properties/${w.propertyA.id}`, { defaultCleanerId: id() }).expect(422);
      expect(res.body.code).toBe('DEFAULT_CLEANER_NOT_MEMBER');
    });

    it('is cleared, with an audit entry, when their cleaner membership is revoked', async () => {
      await t
        .as('admin')
        .patch(`/v1/properties/${w.propertyA.id}`, { defaultCleanerId: w.users.cleanerA.id })
        .expect(200);
      await t.as('admin').post(`/v1/memberships/${w.memberships.cleanerA}/revoke`).expect(200);
      expect((await t.as('admin').get(`/v1/properties/${w.propertyA.id}`)).body.defaultCleanerId).toBeNull();
      const audit = await t.prisma.auditLog.findFirstOrThrow({
        where: { entityId: w.propertyA.id, action: 'property.update' },
        orderBy: { id: 'desc' },
      });
      expect(audit.after).toEqual({ defaultCleanerId: null });
    });

    it('is cleared when the cleaner is deactivated', async () => {
      await t
        .as('admin')
        .patch(`/v1/properties/${w.propertyA.id}`, { defaultCleanerId: w.users.cleanerA.id })
        .expect(200);
      await t.as('admin').post(`/v1/users/${w.users.cleanerA.id}/deactivate`).expect(200);
      expect((await t.as('admin').get(`/v1/properties/${w.propertyA.id}`)).body.defaultCleanerId).toBeNull();
    });

    it('cannot be set on create', async () => {
      const res = await t
        .as('admin')
        .post('/v1/properties', {
          name: 'X',
          addressLine1: '1 X St',
          city: 'Chilliwack',
          postalCode: 'V2P 1A1',
          defaultCleanerId: w.users.cleanerA.id,
        })
        .expect(201);
      expect(res.body.defaultCleanerId).toBeNull();
    });
  });

  it('creates a property with defaults and audits it', async () => {
    const res = await t
      .as('admin')
      .post('/v1/properties', { name: 'Kits 2BR', addressLine1: '1 Yew St', city: 'Vancouver', postalCode: 'v6k3g1' })
      .expect(201);
    expect(res.body).toMatchObject({
      name: 'Kits 2BR',
      postalCode: 'V6K3G1',
      province: 'BC',
      timeZone: 'America/Vancouver',
      checkInTime: '16:00',
      checkOutTime: '11:00',
      defaultCleanerPayCents: 0,
    });
    const audit = await t.prisma.auditLog.findFirstOrThrow({
      where: { action: 'property.create', entityId: res.body.id },
    });
    expect(audit.actorId).toBe(w.users.admin.id);
    expect(audit.propertyId).toBe(res.body.id);
  });

  it('records only changed fields when updating', async () => {
    await t.as('admin').patch(`/v1/properties/${w.propertyA.id}`, { name: 'Renamed', city: 'Vancouver' }).expect(200);
    const audit = await t.prisma.auditLog.findFirstOrThrow({ where: { action: 'property.update' } });
    expect(audit.before).toEqual({ name: 'Property A' });
    expect(audit.after).toEqual({ name: 'Renamed' });
  });

  it('rejects invalid input with per-field problems', async () => {
    const res = await t
      .as('admin')
      .post('/v1/properties', { name: '', addressLine1: 'x', city: 'y', postalCode: '12345', checkInTime: '25:00' })
      .expect(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors.map((e: { path: string }) => e.path).sort()).toEqual(['checkInTime', 'name', 'postalCode']);
  });

  it('rejects money as a float', async () => {
    const res = await t
      .as('admin')
      .patch(`/v1/properties/${w.propertyA.id}`, { defaultCleanerPayCents: 90.5 })
      .expect(400);
    expect(res.body.errors[0].path).toBe('defaultCleanerPayCents');
  });

  it('treats malformed ids as not found', async () => {
    await t.as('admin').get('/v1/properties/not-a-uuid').expect(404);
    await t.as('admin').get('/v1/properties/00000000-0000-7000-8000-000000000000').expect(404);
  });

  it('hides archived properties unless asked, but keeps member access to history', async () => {
    await t.as('admin').post(`/v1/properties/${w.propertyA.id}/archive`).expect(200);
    expect(ids((await t.as('admin').get('/v1/properties')).body)).toEqual([w.propertyB.id]);
    expect(ids((await t.as('admin').get('/v1/properties?includeArchived=true')).body)).toHaveLength(2);
    await t.as('ownerA').get(`/v1/properties/${w.propertyA.id}`).expect(200);
  });
});

describe('memberships and rooms', () => {
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

  it('refuses a duplicate active membership', async () => {
    const res = await t
      .as('admin')
      .post(`/v1/properties/${w.propertyA.id}/memberships`, { userId: w.users.ownerA.id, role: 'OWNER' })
      .expect(409);
    expect(res.body.code).toBe('MEMBERSHIP_EXISTS');
  });

  it('allows re-granting a role after revocation and keeps the history', async () => {
    await t.as('admin').post(`/v1/memberships/${w.memberships.cleanerA}/revoke`).expect(200);
    await t
      .as('admin')
      .post(`/v1/properties/${w.propertyA.id}/memberships`, { userId: w.users.cleanerA.id, role: 'CLEANER' })
      .expect(201);
    const all = await t.as('admin').get(`/v1/properties/${w.propertyA.id}/memberships?includeRevoked=true`).expect(200);
    const cleanerA = all.body.items.filter((m: { user: { id: string } }) => m.user.id === w.users.cleanerA.id);
    expect(cleanerA).toHaveLength(2);
  });

  it('adds rooms at the end of the checklist and reorders them', async () => {
    const kitchen = await t
      .as('admin')
      .post(`/v1/properties/${w.propertyA.id}/rooms`, { name: 'Kitchen', type: 'KITCHEN' })
      .expect(201);
    expect(kitchen.body.sortOrder).toBe(2);

    const order = [kitchen.body.id, ...w.propertyA.roomIds];
    const res = await t.as('admin').put(`/v1/properties/${w.propertyA.id}/rooms/order`, { roomIds: order }).expect(200);
    expect(res.body.items.map((r: { id: string }) => r.id)).toEqual(order);
  });

  it('requires reorder to list exactly the active rooms', async () => {
    const res = await t
      .as('admin')
      .put(`/v1/properties/${w.propertyA.id}/rooms/order`, { roomIds: [w.propertyA.roomIds[0]] })
      .expect(422);
    expect(res.body.code).toBe('ROOM_SET_MISMATCH');
    await t
      .as('admin')
      .put(`/v1/properties/${w.propertyA.id}/rooms/order`, {
        roomIds: [...w.propertyA.roomIds, w.propertyB.roomIds[0]],
      })
      .expect(422);
  });

  it('hides archived rooms from non-admins even when asked', async () => {
    await t.as('admin').post(`/v1/rooms/${w.propertyA.roomIds[0]}/archive`).expect(200);
    const cleaner = await t
      .as('cleanerA')
      .get(`/v1/properties/${w.propertyA.id}/rooms?includeArchived=true`)
      .expect(200);
    expect(cleaner.body.items).toHaveLength(1);
    const admin = await t.as('admin').get(`/v1/properties/${w.propertyA.id}/rooms?includeArchived=true`).expect(200);
    expect(admin.body.items).toHaveLength(2);
  });
});
