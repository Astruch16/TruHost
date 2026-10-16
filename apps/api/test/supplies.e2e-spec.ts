import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

interface Item {
  id: string;
  name: string;
  levelPct: number | null;
  state: string;
  thresholdPct: number;
}

describe('supplies: levels, restock points and alerts', () => {
  let t: TestApp;
  let w: World;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    w = await seedWorld(t.prisma);
    t.email.reset();
  });

  // Property A tracks Toilet paper and Coffee pods (restock point 25%), never checked yet.
  const tp = () => w.propertyA.supplyIds[0]!;
  const pods = () => w.propertyA.supplyIds[1]!;
  const list = async (who = 'admin', propertyId = w.propertyA.id) =>
    (await t.as(who).get(`/v1/properties/${propertyId}/supplies`).expect(200)).body.items as Item[];
  const report = (who: string, readings: { supplyItemId: string; levelPct: number; note?: string }[]) =>
    t.as(who).post(`/v1/properties/${w.propertyA.id}/supply-statuses`, { readings });
  const notifications = (who: string) => t.as(who).get('/v1/me/notifications').expect(200);

  describe('levels', () => {
    it('starts unknown, then shows the latest reading and its state', async () => {
      expect((await list()).map((i) => [i.name, i.levelPct, i.state])).toEqual([
        ['Toilet paper', null, 'UNKNOWN'],
        ['Coffee pods', null, 'UNKNOWN'],
      ]);
      await report('cleanerA', [
        { supplyItemId: tp(), levelPct: 75 },
        { supplyItemId: pods(), levelPct: 25 },
      ]).expect(201);
      await report('cleanerA', [{ supplyItemId: tp(), levelPct: 0 }]).expect(201);
      // Owners and cleaners see the same bars.
      for (const who of ['admin', 'ownerA', 'cleanerA']) {
        expect((await list(who)).map((i) => [i.name, i.levelPct, i.state])).toEqual([
          ['Toilet paper', 0, 'OUT'],
          ['Coffee pods', 25, 'LOW'],
        ]);
      }
    });

    it('keeps every reading as history, newest first, with who reported it', async () => {
      await report('cleanerA', [{ supplyItemId: tp(), levelPct: 50, note: 'Two rolls left' }]).expect(201);
      await report('admin', [{ supplyItemId: tp(), levelPct: 100 }]).expect(201);
      const history = (await t.as('ownerA').get(`/v1/supply-items/${tp()}/history`).expect(200)).body.items;
      expect(history).toMatchObject([
        { levelPct: 100, note: null, reportedBy: { firstName: 'admin' } },
        { levelPct: 50, note: 'Two rolls left', reportedBy: { firstName: 'cleanerA' } },
      ]);
    });

    it('rejects items from another property, archived items and repeats', async () => {
      await report('admin', [{ supplyItemId: w.propertyB.supplyIds[0]!, levelPct: 50 }]).expect(422);
      await t.as('admin').post(`/v1/supply-items/${pods()}/archive`).expect(200);
      const archived = await report('cleanerA', [{ supplyItemId: pods(), levelPct: 50 }]).expect(422);
      expect(archived.body.code).toBe('UNKNOWN_SUPPLY_ITEM');
      const twice = await report('cleanerA', [
        { supplyItemId: tp(), levelPct: 50 },
        { supplyItemId: tp(), levelPct: 25 },
      ]).expect(422);
      expect(twice.body.code).toBe('DUPLICATE_SUPPLY_ITEM');
      for (const levelPct of [-1, 101, 33.5]) {
        await report('cleanerA', [{ supplyItemId: tp(), levelPct }]).expect(400);
      }
      // Nothing was written by any of these.
      expect(await t.prisma.supplyStatus.count()).toBe(0);
    });
  });

  describe('alerts', () => {
    it('alerts admins and owners once when an item reaches its restock point, and again when it runs out', async () => {
      await report('cleanerA', [{ supplyItemId: tp(), levelPct: 75 }]).expect(201);
      await report('cleanerA', [{ supplyItemId: tp(), levelPct: 50 }]).expect(201);
      expect(await t.prisma.notification.count()).toBe(0);

      await report('cleanerA', [{ supplyItemId: tp(), levelPct: 25 }]).expect(201);
      // Admin (who also owns A) once, ownerA once; nobody at B, no cleaners.
      const low = await t.prisma.notification.findMany({ include: { user: true } });
      expect(low.map((n) => [n.user.firstName, n.kind]).sort(([a], [b]) => a.localeCompare(b))).toEqual([
        ['admin', 'SUPPLY_LOW'],
        ['ownerA', 'SUPPLY_LOW'],
      ]);
      expect(t.email.sent.map((m) => m.to).sort()).toEqual(['admin@example.test', 'ownera@example.test']);
      expect(t.email.sent[0]!.subject).toBe('Toilet paper is running low · Property A');
      // Admins' link opens the property's admin page; owners' opens their portal.
      const byTo = (to: string) => t.email.sent.find((m) => m.to === to)!.text;
      expect(byTo('admin@example.test')).toContain(`/admin/properties/${w.propertyA.id}`);
      expect(byTo('ownera@example.test')).toContain('https://app.truhost.example/owner');

      // Still low: no repeat.
      await report('cleanerA', [{ supplyItemId: tp(), levelPct: 25 }]).expect(201);
      expect(await t.prisma.notification.count()).toBe(2);

      await report('cleanerA', [{ supplyItemId: tp(), levelPct: 0 }]).expect(201);
      expect(await t.prisma.notification.count({ where: { kind: 'SUPPLY_OUT' } })).toBe(2);
      expect(t.email.sent).toHaveLength(4);
      expect(t.email.sent[3]!.subject).toBe('Toilet paper has run out · Property A');

      // Restocked, then low again: a new alert.
      await report('admin', [{ supplyItemId: tp(), levelPct: 100 }]).expect(201);
      await report('cleanerA', [{ supplyItemId: tp(), levelPct: 25 }]).expect(201);
      expect(await t.prisma.notification.count({ where: { kind: 'SUPPLY_LOW' } })).toBe(4);
    });

    it('an item checked for the first time at its restock point or empty alerts', async () => {
      await report('cleanerA', [
        { supplyItemId: tp(), levelPct: 0 },
        { supplyItemId: pods(), levelPct: 25 },
      ]).expect(201);
      const own = (await notifications('ownerA')).body;
      expect(own.unread).toBe(2);
      expect(own.items.map((n: { title: string }) => n.title).sort()).toEqual([
        'Coffee pods is running low',
        'Toilet paper has run out',
      ]);
      expect(own.items[0]).toMatchObject({ property: { id: w.propertyA.id, name: 'Property A' }, readAt: null });
    });

    it('uses the item’s own restock point', async () => {
      await t.as('admin').patch(`/v1/supply-items/${tp()}`, { thresholdPct: 50 }).expect(200);
      await report('cleanerA', [{ supplyItemId: tp(), levelPct: 75 }]).expect(201);
      await report('cleanerA', [{ supplyItemId: tp(), levelPct: 50 }]).expect(201);
      expect(await t.prisma.notification.count({ where: { kind: 'SUPPLY_LOW' } })).toBe(2);
    });

    it('follows each person’s Settings → Notifications choices', async () => {
      await t.prisma.notificationSetting.create({
        data: { userId: w.users.ownerA.id, category: 'SUPPLY_ALERTS', email: false, inApp: true },
      });
      await t.prisma.notificationSetting.create({
        data: { userId: w.users.admin.id, category: 'SUPPLY_ALERTS', email: true, inApp: false },
      });
      await report('cleanerA', [{ supplyItemId: tp(), levelPct: 0 }]).expect(201);
      expect(t.email.sent.map((m) => m.to)).toEqual(['admin@example.test']);
      expect((await notifications('admin')).body.unread).toBe(0);
      expect((await notifications('ownerA')).body.unread).toBe(1);
    });

    it('skips deactivated people and revoked owners', async () => {
      await t.prisma.user.update({ where: { id: w.users.admin.id }, data: { status: 'DEACTIVATED' } });
      await t.prisma.membership.update({ where: { id: w.memberships.ownerA }, data: { revokedAt: new Date() } });
      await report('cleanerA', [{ supplyItemId: tp(), levelPct: 0 }]).expect(201);
      expect(await t.prisma.notification.count()).toBe(0);
      expect(t.email.sent).toHaveLength(0);
    });

    it('keeps the reading when the email provider is down', async () => {
      t.email.fail = true;
      await report('cleanerA', [{ supplyItemId: tp(), levelPct: 0 }]).expect(201);
      expect(await t.prisma.supplyStatus.count()).toBe(1);
      const rows = await t.prisma.notification.findMany();
      expect(rows).toHaveLength(2);
      expect(rows.every((n) => n.emailSentAt === null)).toBe(true);
    });

    it('records when an alert was emailed', async () => {
      await report('cleanerA', [{ supplyItemId: tp(), levelPct: 0 }]).expect(201);
      const rows = await t.prisma.notification.findMany();
      expect(rows.every((n) => n.emailSentAt instanceof Date)).toBe(true);
    });
  });

  describe('notifications', () => {
    it('marks some or all read, and only the caller’s own', async () => {
      await report('cleanerA', [
        { supplyItemId: tp(), levelPct: 0 },
        { supplyItemId: pods(), levelPct: 0 },
      ]).expect(201);
      const mine = (await notifications('ownerA')).body.items as { id: string }[];
      const admins = (await notifications('admin')).body.items as { id: string }[];

      // Someone else's ids are ignored.
      await t
        .as('ownerA')
        .post('/v1/me/notifications/read', { ids: [admins[0]!.id] })
        .expect(200);
      expect((await notifications('admin')).body.unread).toBe(2);

      const one = await t
        .as('ownerA')
        .post('/v1/me/notifications/read', { ids: [mine[0]!.id] })
        .expect(200);
      expect(one.body.unread).toBe(1);
      const unread = await t.as('ownerA').get('/v1/me/notifications?unread=true').expect(200);
      expect(unread.body.items.map((n: { id: string }) => n.id)).toEqual([mine[1]!.id]);

      const all = await t.as('ownerA').post('/v1/me/notifications/read', { all: true }).expect(200);
      expect(all.body.unread).toBe(0);
      expect((await notifications('cleanerA')).body).toEqual({ items: [], unread: 0 });
    });
  });

  describe('managing items', () => {
    it('adds items (one or several), names unique per property ignoring case', async () => {
      const one = await t
        .as('admin')
        .post(`/v1/properties/${w.propertyA.id}/supplies`, { name: '  Shampoo ', category: 'BATHROOM' })
        .expect(201);
      expect(one.body).toMatchObject({ name: 'Shampoo', thresholdPct: 25, position: 2, state: 'UNKNOWN' });
      const dup = await t
        .as('admin')
        .post(`/v1/properties/${w.propertyA.id}/supplies`, { name: 'shampoo' })
        .expect(409);
      expect(dup.body.code).toBe('SUPPLY_NAME_TAKEN');
      await t
        .as('admin')
        .post(`/v1/properties/${w.propertyA.id}/supplies/bulk`, {
          items: [{ name: 'Conditioner' }, { name: 'CONDITIONER' }],
        })
        .expect(409);
      // The same name is fine at another property, and again once the old one is archived.
      await t.as('admin').post(`/v1/properties/${w.propertyB.id}/supplies`, { name: 'Shampoo' }).expect(201);
      await t.as('admin').post(`/v1/supply-items/${one.body.id}/archive`).expect(200);
      await t.as('admin').post(`/v1/properties/${w.propertyA.id}/supplies`, { name: 'Shampoo' }).expect(201);
      await t.as('admin').patch(`/v1/supply-items/${tp()}`, { name: 'Coffee Pods' }).expect(409);
      expect((await list()).map((i) => i.name)).toEqual(['Toilet paper', 'Coffee pods', 'Shampoo']);
    });

    it('archived items leave the list but keep their history', async () => {
      await report('cleanerA', [{ supplyItemId: pods(), levelPct: 50 }]).expect(201);
      await t.as('admin').post(`/v1/supply-items/${pods()}/archive`).expect(200);
      expect((await list()).map((i) => i.name)).toEqual(['Toilet paper']);
      const history = await t.as('admin').get(`/v1/supply-items/${pods()}/history`).expect(200);
      expect(history.body.items).toHaveLength(1);
    });

    it('lists what needs restocking, then what’s close to it, across properties', async () => {
      await report('cleanerA', [
        { supplyItemId: tp(), levelPct: 25 },
        { supplyItemId: pods(), levelPct: 75 }, // well above its restock point: not listed
      ]).expect(201);
      await t
        .as('admin')
        .post(`/v1/properties/${w.propertyB.id}/supply-statuses`, {
          readings: [
            { supplyItemId: w.propertyB.supplyIds[0]!, levelPct: 50 }, // a quarter above: close
            { supplyItemId: w.propertyB.supplyIds[1]!, levelPct: 0 },
          ],
        })
        .expect(201);
      const restock = (await t.as('admin').get('/v1/supplies/restock').expect(200)).body.items;
      expect(
        restock.map((i: Item & { property: { name: string }; urgency: string }) => [
          i.property.name,
          i.name,
          i.state,
          i.urgency,
        ]),
      ).toEqual([
        ['Property B', 'Coffee pods', 'OUT', 'OUT'],
        ['Property A', 'Toilet paper', 'LOW', 'LOW'],
        ['Property B', 'Toilet paper', 'OK', 'SOON'],
      ]);
    });
  });

  describe('database guarantees', () => {
    it('readings are append-only', async () => {
      await report('cleanerA', [{ supplyItemId: tp(), levelPct: 50 }]).expect(201);
      await expect(t.prisma.$executeRaw`UPDATE "SupplyStatus" SET "levelPct" = 100`).rejects.toThrow(/append-only/);
      await expect(t.prisma.$executeRaw`DELETE FROM "SupplyStatus"`).rejects.toThrow(/append-only/);
    });

    it('checks levels, restock points and names', async () => {
      await expect(
        t.prisma
          .$executeRaw`INSERT INTO "SupplyStatus" (id, "supplyItemId", "levelPct", "reportedById") VALUES (gen_random_uuid(), ${tp()}::uuid, 101, ${w.users.admin.id}::uuid)`,
      ).rejects.toThrow(/supply_status_level_range/);
      await expect(
        t.prisma.$executeRaw`UPDATE "SupplyItem" SET "thresholdPct" = 100 WHERE id = ${tp()}::uuid`,
      ).rejects.toThrow(/supply_item_threshold_range/);
      await expect(
        t.prisma.$executeRaw`UPDATE "SupplyItem" SET name = ' Toilet paper' WHERE id = ${tp()}::uuid`,
      ).rejects.toThrow(/supply_item_name_tidy/);
      await expect(
        t.prisma.$executeRaw`UPDATE "SupplyItem" SET name = 'COFFEE PODS' WHERE id = ${tp()}::uuid`,
      ).rejects.toThrow(/supply_item_name_unique/);
    });

    it('deleting a property removes its supplies, readings and alerts', async () => {
      const p = (
        await t
          .as('admin')
          .post('/v1/properties', {
            name: 'Spare Cabin',
            addressLine1: '9 Sample Rd',
            city: 'Hope',
            postalCode: 'V0X 1L0',
          })
          .expect(201)
      ).body;
      const item = (await t.as('admin').post(`/v1/properties/${p.id}/supplies`, { name: 'Soap' }).expect(201)).body;
      await t
        .as('admin')
        .post(`/v1/properties/${p.id}/supply-statuses`, { readings: [{ supplyItemId: item.id, levelPct: 0 }] })
        .expect(201);
      expect(await t.prisma.notification.count({ where: { propertyId: p.id } })).toBe(1);
      await t.as('admin').delete(`/v1/properties/${p.id}`).expect(204);
      expect(await t.prisma.supplyItem.count({ where: { propertyId: p.id } })).toBe(0);
      expect(await t.prisma.notification.count({ where: { propertyId: p.id } })).toBe(0);
      // Property A's readings are still protected.
      await report('cleanerA', [{ supplyItemId: tp(), levelPct: 50 }]).expect(201);
      await expect(t.prisma.$executeRaw`DELETE FROM "SupplyStatus"`).rejects.toThrow(/append-only/);
    });
  });
});
