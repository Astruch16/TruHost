import { createHash } from 'node:crypto';
import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
/** Signed local-storage URLs are absolute (http://api.test/…); supertest needs the path. */
const pathOf = (url: string) => {
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
};
// Stand-ins for the browser's JPEG renditions: storage checks bytes, type and size, not pixels.
const large = Buffer.from('large rendition bytes');
const thumb = Buffer.from('card rendition bytes');

describe('property cover photos', () => {
  let t: TestApp;
  let w: World;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    t.clock.reset();
    w = await seedWorld(t.prisma);
  });

  const requestUpload = (body: Buffer, over: object = {}, as = 'admin', propertyId = w.propertyA.id) =>
    t.as(as).post('/v1/uploads', {
      purpose: 'PROPERTY_PHOTO',
      propertyId,
      contentType: 'image/jpeg',
      sizeBytes: body.length,
      sha256: sha256(body),
      ...over,
    });

  async function upload(body: Buffer, propertyId = w.propertyA.id) {
    const target = (await requestUpload(body, {}, 'admin', propertyId).expect(201)).body;
    let req = t.http().put(pathOf(target.upload.url));
    for (const [k, v] of Object.entries(target.upload.headers as Record<string, string>)) req = req.set(k, v);
    await req.send(body).expect(200);
    return target.fileId as string;
  }

  async function setCover(propertyId = w.propertyA.id) {
    const fileId = await upload(large, propertyId);
    const thumbFileId = await upload(thumb, propertyId);
    const res = await t
      .as('admin')
      .put(`/v1/properties/${propertyId}/cover-photo`, { fileId, thumbFileId })
      .expect(200);
    return { fileId, thumbFileId, property: res.body };
  }

  it('sets a cover from two verified uploads and serves both renditions', async () => {
    const { fileId, thumbFileId, property } = await setCover();
    expect(property.coverPhoto).toEqual({
      id: expect.any(String),
      url: expect.stringContaining(`/property_photo/${fileId}?`),
      thumbUrl: expect.stringContaining(`/property_photo/${thumbFileId}?`),
      expiresAt: expect.any(String),
    });

    const card = await t.http().get(pathOf(property.coverPhoto.thumbUrl)).expect(200);
    expect(Buffer.from(card.body as Buffer).equals(thumb)).toBe(true);
    expect(card.headers['content-type']).toBe('image/jpeg');
    expect(card.headers['cache-control']).toBe('private, max-age=240, immutable');

    const files = await t.prisma.storedFile.findMany({ where: { id: { in: [fileId, thumbFileId] } } });
    expect(files.map((f) => f.status)).toEqual(['VERIFIED', 'VERIFIED']);
  });

  it('returns the same links within a signing window, and new ones after it', async () => {
    await setCover();
    const get = async () => (await t.as('admin').get(`/v1/properties/${w.propertyA.id}`).expect(200)).body.coverPhoto;
    t.clock.set('2026-11-20T20:00:30Z');
    const first = await get();
    t.clock.set('2026-11-20T20:03:59Z');
    expect(await get()).toEqual(first);
    expect(first.expiresAt).toBe('2026-11-20T20:05:00.000Z');
    t.clock.set('2026-11-20T20:04:00Z');
    const next = await get();
    expect(next.thumbUrl).not.toBe(first.thumbUrl);
    expect(next.expiresAt).toBe('2026-11-20T20:09:00.000Z');
  });

  it('includes the cover in the list, the dashboard and for owners and cleaners of the property', async () => {
    const { property } = await setCover();
    const list = (await t.as('admin').get('/v1/properties').expect(200)).body.items;
    expect(list.find((p: { id: string }) => p.id === w.propertyA.id).coverPhoto).toEqual(property.coverPhoto);
    expect(list.find((p: { id: string }) => p.id === w.propertyB.id).coverPhoto).toBeNull();

    const dashboard = (await t.as('admin').get('/v1/dashboard?month=2026-11').expect(200)).body;
    expect(dashboard.properties.find((p: { id: string }) => p.id === w.propertyA.id).coverPhoto).toEqual(
      property.coverPhoto,
    );

    for (const who of ['ownerA', 'cleanerA']) {
      const res = await t.as(who).get(`/v1/properties/${w.propertyA.id}`).expect(200);
      expect(res.body.coverPhoto.thumbUrl).toBe(property.coverPhoto.thumbUrl);
    }
    await t.as('ownerB').get(`/v1/properties/${w.propertyA.id}`).expect(404);
  });

  it('replaces the cover, keeps the old photo as history and audits both changes', async () => {
    const first = await setCover();
    const second = await setCover();
    expect(second.property.coverPhoto.id).not.toBe(first.property.coverPhoto.id);
    expect(await t.prisma.propertyPhoto.count({ where: { propertyId: w.propertyA.id } })).toBe(3); // + the fixture

    const removed = await t.as('admin').delete(`/v1/properties/${w.propertyA.id}/cover-photo`).expect(200);
    expect(removed.body.coverPhoto).toBeNull();
    expect(await t.prisma.propertyPhoto.count({ where: { propertyId: w.propertyA.id } })).toBe(3);

    const audit = await t.prisma.auditLog.findMany({
      where: { entityId: w.propertyA.id, action: { startsWith: 'property.coverPhoto' } },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.map((a) => [a.action, a.before, a.after])).toEqual([
      [
        'property.coverPhoto.set',
        { coverPhotoId: null },
        expect.objectContaining({ coverPhotoId: first.property.coverPhoto.id }),
      ],
      [
        'property.coverPhoto.set',
        { coverPhotoId: first.property.coverPhoto.id },
        expect.objectContaining({ coverPhotoId: second.property.coverPhoto.id }),
      ],
      ['property.coverPhoto.remove', { coverPhotoId: second.property.coverPhoto.id }, { coverPhotoId: null }],
    ]);

    // Removing again is a no-op, and isn't audited twice.
    await t.as('admin').delete(`/v1/properties/${w.propertyA.id}/cover-photo`).expect(200);
    expect(
      await t.prisma.auditLog.count({ where: { action: 'property.coverPhoto.remove', entityId: w.propertyA.id } }),
    ).toBe(1);
  });

  describe('refuses', () => {
    const cover = (fileId: string, thumbFileId: string) =>
      t.as('admin').put(`/v1/properties/${w.propertyA.id}/cover-photo`, { fileId, thumbFileId });

    it('the same upload for both renditions', async () => {
      const fileId = await upload(large);
      const res = await cover(fileId, fileId).expect(422);
      expect(res.body.code).toBe('SAME_FILE');
    });

    it('another property’s upload, leaving nothing half-attached', async () => {
      const fileId = await upload(large);
      const other = await upload(thumb, w.propertyB.id);
      expect((await cover(fileId, other).expect(422)).body.code).toBe('FILE_MISMATCH');
      expect((await t.prisma.storedFile.findUniqueOrThrow({ where: { id: fileId } })).status).toBe('PENDING');
      expect(await t.prisma.propertyPhoto.count({ where: { propertyId: w.propertyA.id } })).toBe(1);
    });

    it('a receipt upload', async () => {
      const fileId = await upload(large);
      expect((await cover(fileId, w.files.a).expect(422)).body.code).toBe('FILE_MISMATCH');
    });

    it('an upload whose bytes never arrived', async () => {
      const fileId = await upload(large);
      const declared = (await requestUpload(thumb).expect(201)).body.fileId;
      expect((await cover(fileId, declared).expect(422)).body.code).toBe('UPLOAD_MISSING');
    });

    it.each([
      ['a PNG', { contentType: 'image/png' }],
      ['more than 5 MB', { sizeBytes: 5 * 1024 * 1024 + 1 }],
    ])('%s photo upload', async (_, over) => {
      const res = await requestUpload(large, over).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('photo uploads from owners and cleaners', async () => {
      await requestUpload(large, {}, 'ownerA').expect(404);
      await requestUpload(large, {}, 'cleanerA').expect(404);
    });
  });

  describe('database guards', () => {
    const raise = (sql: Promise<unknown>) => expect(sql).rejects.toThrow();

    it('photos can’t be changed or deleted', async () => {
      await raise(t.prisma.$executeRaw`UPDATE "PropertyPhoto" SET "createdAt" = now() WHERE id = ${w.photoA.id}::uuid`);
      await raise(t.prisma.$executeRaw`DELETE FROM "PropertyPhoto" WHERE id = ${w.photoA.id}::uuid`);
    });

    it('a cover must be one of the property’s own photos', async () => {
      await raise(
        t.prisma
          .$executeRaw`UPDATE "Property" SET "coverPhotoId" = ${w.photoA.id}::uuid WHERE id = ${w.propertyB.id}::uuid`,
      );
      await t.prisma
        .$executeRaw`UPDATE "Property" SET "coverPhotoId" = ${w.photoA.id}::uuid WHERE id = ${w.propertyA.id}::uuid`;
    });

    it('a photo needs two different verified property-photo files of its property', async () => {
      const insert = (fileId: string, thumbFileId: string, propertyId = w.propertyA.id) =>
        t.prisma.$executeRaw`INSERT INTO "PropertyPhoto" (id, "propertyId", "fileId", "thumbFileId", "uploadedById")
          VALUES (gen_random_uuid(), ${propertyId}::uuid, ${fileId}::uuid, ${thumbFileId}::uuid, ${w.users.admin.id}::uuid)`;
      const pending = await upload(large);
      const other = await upload(thumb);
      await raise(insert(w.files.a, other)); // a receipt
      await raise(insert(pending, other)); // not verified
      await raise(insert(pending, pending)); // the same file twice
      await t.prisma
        .$executeRaw`UPDATE "StoredFile" SET status = 'VERIFIED', "verifiedAt" = now() WHERE id IN (${pending}::uuid, ${other}::uuid)`;
      await raise(insert(pending, other, w.propertyB.id)); // another property's files
      await insert(pending, other);
    });
  });
});
