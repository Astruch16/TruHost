import { createHash } from 'node:crypto';
import { FILE_STORAGE, type FileStorage } from '../src/files/storage.js';
import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const pathOf = (url: string) => {
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
};
const details = {
  name: 'Spare Cabin',
  addressLine1: '9 Sample Rd',
  city: 'Hope',
  postalCode: 'V0X 1L0',
  description: 'Two-storey cabin by the river.',
  bedrooms: 3,
  bathrooms: 2,
  halfBathrooms: 1,
  maxGuests: 6,
  airbnbUrl: 'https://www.airbnb.ca/rooms/12345',
  vrboUrl: 'https://www.vrbo.com/1234567',
  bookingComUrl: 'https://www.booking.com/hotel/ca/spare-cabin.html',
};

describe('property details and deletion', () => {
  let t: TestApp;
  let w: World;
  let storage: FileStorage;

  beforeAll(async () => {
    t = await createTestApp();
    storage = t.app.get(FILE_STORAGE);
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    w = await seedWorld(t.prisma);
  });

  const create = (body: object = details) => t.as('admin').post('/v1/properties', body);

  /** A property set up like a real one, but with no bookings, expenses or receipts yet. */
  async function setUpProperty() {
    const p = (await create().expect(201)).body;
    await t.as('admin').post(`/v1/properties/${p.id}/rooms`, { name: 'Bedroom', type: 'BEDROOM' }).expect(201);
    await t
      .as('admin')
      .post(`/v1/properties/${p.id}/memberships`, { userId: w.users.ownerB.id, role: 'OWNER' })
      .expect(201);
    await t
      .as('admin')
      .post(`/v1/properties/${p.id}/plan`, { planId: w.planId, effectiveFrom: '2026-12-01' })
      .expect(200);
    const upload = async (body: Buffer) => {
      const target = (
        await t
          .as('admin')
          .post('/v1/uploads', {
            purpose: 'PROPERTY_PHOTO',
            propertyId: p.id,
            contentType: 'image/jpeg',
            sizeBytes: body.length,
            sha256: sha256(body),
          })
          .expect(201)
      ).body;
      let req = t.http().put(pathOf(target.upload.url));
      for (const [k, v] of Object.entries(target.upload.headers as Record<string, string>)) req = req.set(k, v);
      await req.send(body).expect(200);
      return target.fileId as string;
    };
    const fileId = await upload(Buffer.from('large'));
    const thumbFileId = await upload(Buffer.from('card'));
    await t.as('admin').put(`/v1/properties/${p.id}/cover-photo`, { fileId, thumbFileId }).expect(200);
    // An abandoned receipt upload (never attached) is stored against the property too.
    await t
      .as('admin')
      .post('/v1/uploads', {
        purpose: 'RECEIPT',
        propertyId: p.id,
        contentType: 'application/pdf',
        sizeBytes: 10,
        sha256: 'e'.repeat(64),
      })
      .expect(201);
    return p.id as string;
  }

  describe('details', () => {
    it('stores and returns the new details, and updates them', async () => {
      const p = (await create().expect(201)).body;
      expect(p).toMatchObject(details);
      const updated = await t
        .as('admin')
        .patch(`/v1/properties/${p.id}`, { bedrooms: 4, airbnbUrl: null, description: 'Renovated in 2026.' })
        .expect(200);
      expect(updated.body).toMatchObject({
        bedrooms: 4,
        airbnbUrl: null,
        description: 'Renovated in 2026.',
        maxGuests: 6,
      });
      // Owners and cleaners of the property see them too.
      await t
        .as('admin')
        .post(`/v1/properties/${p.id}/memberships`, { userId: w.users.ownerB.id, role: 'OWNER' })
        .expect(201);
      expect((await t.as('ownerB').get(`/v1/properties/${p.id}`).expect(200)).body.bedrooms).toBe(4);
    });

    it('leaves the details empty on properties created without them', async () => {
      const p = (
        await create({ name: 'Bare', addressLine1: '1 A St', city: 'Hope', postalCode: 'V0X 1L0' }).expect(201)
      ).body;
      expect(p).toMatchObject({ description: null, bedrooms: null, maxGuests: null, airbnbUrl: null });
    });

    it.each([
      ['an http listing link', { airbnbUrl: 'http://www.airbnb.ca/rooms/1' }],
      ['another site in the Airbnb field', { airbnbUrl: 'https://example.com/rooms/1' }],
      ['a look-alike domain', { vrboUrl: 'https://vrbo.com.evil.test/1' }],
      ['not a link', { bookingComUrl: 'booking dot com' }],
      ['negative bedrooms', { bedrooms: -1 }],
      ['no guests', { maxGuests: 0 }],
      ['half a bedroom', { bedrooms: 1.5 }],
      ['a very long description', { description: 'x'.repeat(1001) }],
    ])('refuses %s', async (_, bad) => {
      const res = await create({ ...details, ...bad }).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('deletion', () => {
    it('deletes a property with no records, with its rooms, access, plan history, photos and files', async () => {
      const id = await setUpProperty();
      const files = await t.prisma.storedFile.findMany({ where: { propertyId: id } });
      expect(files).toHaveLength(3);
      expect(await storage.head(files.find((f) => f.status === 'VERIFIED')!.objectKey)).not.toBeNull();

      expect((await t.as('admin').get(`/v1/properties/${id}/deletion`).expect(200)).body).toEqual({
        allowed: true,
        bookings: 0,
        expenses: 0,
        receipts: 0,
      });
      await t.as('admin').delete(`/v1/properties/${id}`).expect(204);

      const where = { where: { propertyId: id } };
      expect(
        await Promise.all([
          t.prisma.property.count({ where: { id } }),
          t.prisma.room.count(where),
          t.prisma.membership.count(where),
          t.prisma.propertyPlan.count(where),
          t.prisma.propertyPhoto.count(where),
          t.prisma.storedFile.count(where),
        ]),
      ).toEqual([0, 0, 0, 0, 0, 0]);
      for (const f of files) expect(await storage.head(f.objectKey)).toBeNull();

      const audit = await t.prisma.auditLog.findFirstOrThrow({ where: { action: 'property.delete', entityId: id } });
      expect(audit.before).toMatchObject({ name: 'Spare Cabin', city: 'Hope', files: 3 });
      await t.as('admin').get(`/v1/properties/${id}`).expect(404);
      await t.as('ownerB').get(`/v1/properties/${id}`).expect(404); // their access went with it
    });

    it('refuses a property with records, keeps everything, and says what is in the way', async () => {
      expect((await t.as('admin').get(`/v1/properties/${w.propertyA.id}/deletion`).expect(200)).body).toEqual({
        allowed: false,
        bookings: 1,
        expenses: 2,
        receipts: 2,
      });
      const res = await t.as('admin').delete(`/v1/properties/${w.propertyA.id}`).expect(409);
      expect(res.body.code).toBe('PROPERTY_HAS_RECORDS');
      expect(await t.prisma.property.count({ where: { id: w.propertyA.id } })).toBe(1);
      expect(await t.prisma.room.count({ where: { propertyId: w.propertyA.id } })).toBe(2);
    });

    it('counts a cancelled booking as a record too', async () => {
      const id = await setUpProperty();
      const booking = (
        await t
          .as('admin')
          .post(`/v1/properties/${id}/bookings`, {
            channel: 'AIRBNB',
            checkInDate: '2026-12-01',
            checkOutDate: '2026-12-03',
          })
          .expect(201)
      ).body;
      await t.as('admin').post(`/v1/bookings/${booking.id}/cancel`, { version: booking.version }).expect(200);
      const blocked = (await t.as('admin').get(`/v1/properties/${id}/deletion`).expect(200)).body;
      expect(blocked).toMatchObject({ allowed: false, bookings: 1 });
      await t.as('admin').delete(`/v1/properties/${id}`).expect(409);
    });

    it('is for admins only', async () => {
      const id = await setUpProperty();
      await t.as('ownerB').delete(`/v1/properties/${id}`).expect(404);
      await t.as('ownerB').get(`/v1/properties/${id}/deletion`).expect(404);
      expect(await t.prisma.property.count({ where: { id } })).toBe(1);
    });
  });

  describe('database guards', () => {
    const raise = (sql: Promise<unknown>) => expect(sql).rejects.toThrow();

    it('still protect photos and files outside a property deletion, or for another property', async () => {
      await raise(t.prisma.$executeRaw`DELETE FROM "PropertyPhoto" WHERE id = ${w.photoA.id}::uuid`);
      await raise(t.prisma.$executeRaw`DELETE FROM "StoredFile" WHERE id = ${w.photoA.fileId}::uuid`);
      await raise(
        t.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('truhost.deleting_property', ${w.propertyB.id}, true)`;
          await tx.$executeRaw`DELETE FROM "PropertyPhoto" WHERE id = ${w.photoA.id}::uuid`;
        }),
      );
      // The setting is transaction-local: it doesn't leak into later statements.
      await raise(t.prisma.$executeRaw`DELETE FROM "PropertyPhoto" WHERE id = ${w.photoA.id}::uuid`);
      expect(await t.prisma.propertyPhoto.count({ where: { id: w.photoA.id } })).toBe(1);
    });

    it('keep receipts and expenses undeletable even during a property deletion', async () => {
      await raise(
        t.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('truhost.deleting_property', ${w.propertyA.id}, true)`;
          await tx.$executeRaw`DELETE FROM "Receipt" WHERE id = ${w.receipts.a}::uuid`;
        }),
      );
      await raise(
        t.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('truhost.deleting_property', ${w.propertyA.id}, true)`;
          await tx.$executeRaw`DELETE FROM "Expense" WHERE id = ${w.expenses.a}::uuid`;
        }),
      );
    });
  });
});
