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

describe('settings: preferences, avatar and notifications', () => {
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
    t.clock.reset();
    w = await seedWorld(t.prisma);
  });

  async function uploadAvatar(as: string, body: Buffer) {
    const target = (
      await t
        .as(as)
        .post('/v1/uploads', {
          purpose: 'AVATAR',
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
  }

  describe('preferences', () => {
    it('default to Sunday and the system motion setting, and can be changed', async () => {
      const me = (await t.as('cleanerA').get('/v1/me').expect(200)).body;
      expect(me).toMatchObject({ weekStartsOn: 0, motion: 'SYSTEM', avatar: null });
      const updated = await t.as('cleanerA').patch('/v1/me', { weekStartsOn: 1, motion: 'REDUCED' }).expect(200);
      expect(updated.body).toMatchObject({ weekStartsOn: 1, motion: 'REDUCED', firstName: 'cleanerA' });
    });

    it.each([[{ weekStartsOn: 2 }], [{ weekStartsOn: '1' }], [{ motion: 'FAST' }]])('refuses %o', async (bad) => {
      expect((await t.as('cleanerA').patch('/v1/me', bad).expect(400)).body.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('avatar', () => {
    it('sets a photo, serves it to its owner and admins only, and replaces it without leaving the old one behind', async () => {
      const first = await uploadAvatar('ownerA', Buffer.from('first face'));
      const me = (await t.as('ownerA').put('/v1/me/avatar', { fileId: first }).expect(200)).body;
      expect(me.avatar.url).toContain(`/users/${w.users.ownerA.id}/avatar/${first}?`);
      const img = await t.http().get(pathOf(me.avatar.url)).expect(200);
      expect(Buffer.from(img.body as Buffer).toString()).toBe('first face');

      await t.as('ownerA').get(`/v1/files/${first}/url`).expect(200);
      await t.as('admin').get(`/v1/files/${first}/url`).expect(200);
      await t.as('ownerB').get(`/v1/files/${first}/url`).expect(404);
      await t.as('cleanerA').get(`/v1/files/${first}/url`).expect(404);

      const firstKey = (await t.prisma.storedFile.findUniqueOrThrow({ where: { id: first } })).objectKey;
      const second = await uploadAvatar('ownerA', Buffer.from('second face'));
      await t.as('ownerA').put('/v1/me/avatar', { fileId: second }).expect(200);
      expect(await t.prisma.storedFile.count({ where: { id: first } })).toBe(0);
      expect(await storage.head(firstKey)).toBeNull();
      expect((await t.prisma.user.findUniqueOrThrow({ where: { id: w.users.ownerA.id } })).avatarFileId).toBe(second);
    });

    it('removes the photo, its row and its stored object', async () => {
      const id = await uploadAvatar('cleanerA', Buffer.from('face'));
      await t.as('cleanerA').put('/v1/me/avatar', { fileId: id }).expect(200);
      const key = (await t.prisma.storedFile.findUniqueOrThrow({ where: { id } })).objectKey;
      const res = await t.as('cleanerA').delete('/v1/me/avatar').expect(200);
      expect(res.body.avatar).toBeNull();
      expect(await t.prisma.storedFile.count({ where: { id } })).toBe(0);
      expect(await storage.head(key)).toBeNull();
      await t.as('cleanerA').delete('/v1/me/avatar').expect(200); // nothing to remove: still fine
    });

    it('refuses someone else’s upload, a property photo, a PNG and an oversized file', async () => {
      const theirs = await uploadAvatar('ownerB', Buffer.from('not yours'));
      expect((await t.as('ownerA').put('/v1/me/avatar', { fileId: theirs }).expect(422)).body.code).toBe(
        'UNKNOWN_FILE',
      );
      expect((await t.as('admin').put('/v1/me/avatar', { fileId: w.photoA.fileId }).expect(422)).body.code).toMatch(
        /FILE_MISMATCH|FILE_ALREADY_USED|UNKNOWN_FILE/,
      );
      const upload = (over: object) =>
        t.as('ownerA').post('/v1/uploads', {
          purpose: 'AVATAR',
          contentType: 'image/jpeg',
          sizeBytes: 10,
          sha256: 'a'.repeat(64),
          ...over,
        });
      await upload({ contentType: 'image/png' }).expect(400);
      await upload({ sizeBytes: 1024 * 1024 + 1 }).expect(400);
    });

    it('lets any signed-in user upload their own photo, stored under their own folder', async () => {
      for (const who of ['outsider', 'cleanerB'] as const) {
        const id = await uploadAvatar(who, Buffer.from(`${who} face`));
        const file = await t.prisma.storedFile.findUniqueOrThrow({ where: { id } });
        expect(file).toMatchObject({
          propertyId: null,
          purpose: 'AVATAR',
          objectKey: `users/${w.users[who].id}/avatar/${id}`,
        });
      }
    });

    it('database: avatars have no property, everything else must; avatars can be deleted, evidence can’t', async () => {
      const raise = (sql: Promise<unknown>) => expect(sql).rejects.toThrow();
      await raise(t.prisma.$executeRaw`UPDATE "StoredFile" SET "propertyId" = NULL WHERE id = ${w.files.a}::uuid`);
      await raise(
        t.prisma
          .$executeRaw`INSERT INTO "StoredFile" (id, purpose, "propertyId", "objectKey", "contentType", "sizeBytes", sha256, "uploadedById")
          VALUES (gen_random_uuid(), 'AVATAR', ${w.propertyA.id}::uuid, 'x/y', 'image/jpeg', 1, ${'f'.repeat(64)}, ${w.users.admin.id}::uuid)`,
      );
      const id = await uploadAvatar('ownerA', Buffer.from('face'));
      await t.as('ownerA').put('/v1/me/avatar', { fileId: id }).expect(200);
      await t.prisma.$executeRaw`UPDATE "User" SET "avatarFileId" = NULL WHERE id = ${w.users.ownerA.id}::uuid`;
      await t.prisma.$executeRaw`DELETE FROM "StoredFile" WHERE id = ${id}::uuid`; // verified avatar: deletable
      await raise(t.prisma.$executeRaw`DELETE FROM "StoredFile" WHERE id = ${w.photoA.fileId}::uuid`); // still protected
    });
  });

  describe('notifications', () => {
    const categories = async (who: string) =>
      ((await t.as(who).get('/v1/me/notification-settings').expect(200)).body.items as { category: string }[]).map(
        (i) => i.category,
      );

    it('offers each role its own categories, with defaults', async () => {
      expect(await categories('ownerB')).toEqual(['SUPPLY_ALERTS', 'WEEKLY_SUMMARY', 'STATEMENT_RELEASED']);
      expect(await categories('cleanerA')).toEqual(['CLEAN_ASSIGNED', 'PAYMENT_RECORDED']);
      // The admin also owns property A: both sets, once each.
      expect(await categories('admin')).toEqual([
        'SUPPLY_ALERTS',
        'INVITE_ACCEPTED',
        'WEEKLY_SUMMARY',
        'STATEMENT_RELEASED',
      ]);
      expect(await categories('outsider')).toEqual([]);
      const owner = (await t.as('ownerB').get('/v1/me/notification-settings').expect(200)).body.items;
      expect(owner).toContainEqual({ category: 'WEEKLY_SUMMARY', email: true, inApp: false });
    });

    it('saves choices for the caller only', async () => {
      const res = await t
        .as('ownerB')
        .put('/v1/me/notification-settings', { items: [{ category: 'SUPPLY_ALERTS', email: false, inApp: true }] })
        .expect(200);
      expect(res.body.items).toContainEqual({ category: 'SUPPLY_ALERTS', email: false, inApp: true });
      expect((await t.as('admin').get('/v1/me/notification-settings').expect(200)).body.items).toContainEqual({
        category: 'SUPPLY_ALERTS',
        email: true,
        inApp: true,
      });
    });

    it('refuses categories outside the caller’s roles and channels a category doesn’t use', async () => {
      const put = (who: string, items: object[]) => t.as(who).put('/v1/me/notification-settings', { items });
      expect(
        (await put('cleanerA', [{ category: 'STATEMENT_RELEASED', email: true, inApp: true }]).expect(422)).body.code,
      ).toBe('NOT_YOUR_NOTIFICATION');
      expect(
        (await put('ownerB', [{ category: 'WEEKLY_SUMMARY', email: true, inApp: true }]).expect(422)).body.code,
      ).toBe('CHANNEL_NOT_AVAILABLE');
    });
  });
});
