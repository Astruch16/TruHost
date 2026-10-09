import { createHash } from 'node:crypto';
import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

const NOV = 'from=2026-11-01&to=2026-12-01';
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
/** Signed local-storage URLs are absolute (http://api.test/…); supertest needs the path. */
const pathOf = (url: string) => {
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
};

describe('expenses', () => {
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

  const create = (body: object) =>
    t.as('admin').post(`/v1/properties/${w.propertyA.id}/expenses`, {
      category: 'SUPPLIES',
      incurredOn: '2026-11-06',
      description: 'Dish soap',
      amountCents: 899,
      ...body,
    });

  it('creates an owner-borne expense flagged until a receipt is attached, and audits it', async () => {
    const res = await create({ vendor: 'Store' }).expect(201);
    expect(res.body).toMatchObject({
      bearer: 'OWNER',
      amountCents: 899,
      missingReceipt: true,
      receipts: [],
      version: 0,
    });
    expect(await t.prisma.auditLog.count({ where: { action: 'expense.create', entityId: res.body.id } })).toBe(1);
  });

  it('accepts streaming and other subscriptions as their own category', async () => {
    const res = await create({ category: 'SUBSCRIPTIONS', vendor: 'Netflix', description: 'Standard plan' }).expect(
      201,
    );
    expect(res.body).toMatchObject({ category: 'SUBSCRIPTIONS', vendor: 'Netflix' });
    const owner = await t.as('ownerA').get(`/v1/properties/${w.propertyA.id}/expenses?${NOV}`).expect(200);
    expect(owner.body.items).toContainEqual(expect.objectContaining({ category: 'SUBSCRIPTIONS' }));
  });

  it('never flags TruHost-borne expenses as missing a receipt', async () => {
    expect((await create({ bearer: 'TRUHOST' }).expect(201)).body.missingReceipt).toBe(false);
  });

  it('shows owners only owner-borne, non-voided expenses, without admin fields', async () => {
    await t.as('admin').post(`/v1/expenses/${w.expenses.a}/void`, { reason: 'Duplicate' }).expect(200);
    await create({ description: 'Bleach' }).expect(201);
    const owner = await t.as('ownerA').get(`/v1/properties/${w.propertyA.id}/expenses?${NOV}`).expect(200);
    expect(owner.body.items.map((e: { description: string }) => e.description)).toEqual(['Bleach']);
    expect(owner.body.items[0]).not.toHaveProperty('version');

    const admin = await t
      .as('admin')
      .get(`/v1/properties/${w.propertyA.id}/expenses?${NOV}&includeVoided=true`)
      .expect(200);
    expect(admin.body.items).toHaveLength(3);
  });

  it('updates with a version and refuses stale or voided edits', async () => {
    await t.as('admin').patch(`/v1/expenses/${w.expenses.a}`, { version: 0, amountCents: 4_299 }).expect(200);
    expect(
      (await t.as('admin').patch(`/v1/expenses/${w.expenses.a}`, { version: 0, amountCents: 1 }).expect(409)).body.code,
    ).toBe('STALE_VERSION');
    await t.as('admin').post(`/v1/expenses/${w.expenses.a}/void`, { reason: 'Wrong property' }).expect(200);
    expect(
      (await t.as('admin').patch(`/v1/expenses/${w.expenses.a}`, { version: 2, vendor: 'x' }).expect(409)).body.code,
    ).toBe('EXPENSE_VOIDED');
  });

  it('requires a reason to void, and voids once', async () => {
    await t.as('admin').post(`/v1/expenses/${w.expenses.a}/void`, { reason: '' }).expect(400);
    await t.as('admin').post(`/v1/expenses/${w.expenses.a}/void`, { reason: 'Duplicate' }).expect(200);
    await t.as('admin').post(`/v1/expenses/${w.expenses.a}/void`, { reason: 'Again' }).expect(409);
  });

  it('rejects tax amounts while tax fields are disabled, and float money', async () => {
    expect((await create({ gstCents: 45 }).expect(400)).body.errors[0].path).toBe('gstCents');
    await create({ amountCents: 8.99 }).expect(400);
  });

  it('cannot be deleted at the database level', async () => {
    await expect(t.prisma.expense.delete({ where: { id: w.expenses.a } })).rejects.toThrow(/append-only|cannot/);
  });

  it('requires a reason when voided at the database level', async () => {
    await expect(
      t.prisma.expense.update({
        where: { id: w.expenses.a },
        data: { voidedAt: new Date(), voidedById: w.users.admin.id },
      }),
    ).rejects.toThrow(/expense_void_reason/);
  });
});

describe('receipt upload flow', () => {
  let t: TestApp;
  let w: World;
  const pdf = Buffer.from('%PDF-1.4 test receipt body');

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    w = await seedWorld(t.prisma);
  });

  const requestUpload = (over: object = {}, body = pdf) =>
    t.as('admin').post('/v1/uploads', {
      purpose: 'RECEIPT',
      propertyId: w.propertyA.id,
      contentType: 'application/pdf',
      sizeBytes: body.length,
      sha256: sha256(body),
      filename: 'Costco receipt.pdf',
      ...over,
    });

  const put = (target: { url: string; headers: Record<string, string> }, body: Buffer) => {
    let req = t.http().put(pathOf(target.url));
    for (const [k, v] of Object.entries(target.headers)) req = req.set(k, v);
    return req.send(body);
  };

  async function uploadReceiptFile(body = pdf) {
    const target = (await requestUpload({}, body).expect(201)).body;
    await put(target.upload, body).expect(200);
    return target.fileId as string;
  }

  it('uploads, attaches to an expense, verifies the bytes and serves a short-lived link', async () => {
    const expense = (
      await t
        .as('admin')
        .post(`/v1/properties/${w.propertyA.id}/expenses`, {
          category: 'SUPPLIES',
          incurredOn: '2026-11-07',
          description: 'Restock',
          amountCents: 1_500,
        })
        .expect(201)
    ).body;
    const fileId = await uploadReceiptFile();

    const receipt = await t
      .as('admin')
      .post(`/v1/properties/${w.propertyA.id}/receipts`, { fileId, expenseId: expense.id, receiptDate: '2026-11-07' })
      .expect(201);
    expect(receipt.body).toMatchObject({
      expenseId: expense.id,
      filename: 'Costco receipt.pdf',
      contentType: 'application/pdf',
    });

    const file = await t.prisma.storedFile.findUniqueOrThrow({ where: { id: fileId } });
    expect(file).toMatchObject({ status: 'VERIFIED', sha256: sha256(pdf), sizeBytes: pdf.length });

    const listed = await t.as('admin').get(`/v1/properties/${w.propertyA.id}/expenses?${NOV}`).expect(200);
    expect(listed.body.items.find((e: { id: string }) => e.id === expense.id)).toMatchObject({ missingReceipt: false });

    // The owner can view it; the link works, then the bytes are exactly what was uploaded.
    const link = (await t.as('ownerA').get(`/v1/files/${fileId}/url`).expect(200)).body;
    const download = await t
      .http()
      .get(pathOf(link.url))
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('application/pdf');
    expect(Buffer.compare(download.body as Buffer, pdf)).toBe(0);
    expect(Date.parse(link.expiresAt) - Date.now()).toBeLessThanOrEqual(5 * 60_000);
  });

  it('rejects a body that does not match the declared SHA-256 or length', async () => {
    const target = (await requestUpload().expect(201)).body;
    const tampered = Buffer.from(pdf);
    tampered[0] = 0x41;
    expect((await put(target.upload, tampered).expect(403)).body.detail).toMatch(/SHA-256/);
    expect((await put(target.upload, Buffer.concat([pdf, Buffer.from('x')])).expect(403)).body.detail).toMatch(
      /Length/,
    );
  });

  it('rejects forged or altered upload links', async () => {
    const target = (await requestUpload().expect(201)).body;
    const forged = { ...target.upload, url: target.upload.url.replace(/sig=[^&]+/, 'sig=forged') };
    await put(forged, pdf).expect(403);
    const otherKey = { ...target.upload, url: target.upload.url.replace(/receipt\/[^?]+/, 'receipt/other') };
    await put(otherKey, pdf).expect(403);
  });

  it('refuses to attach a file that was never uploaded, twice, or by someone else', async () => {
    const target = (await requestUpload().expect(201)).body;
    const attach = (fileId: string, propertyId = w.propertyA.id) =>
      t.as('admin').post(`/v1/properties/${propertyId}/receipts`, { fileId, receiptDate: '2026-11-07' });
    expect((await attach(target.fileId).expect(422)).body.code).toBe('UPLOAD_MISSING');
    await put(target.upload, pdf).expect(200);
    expect((await attach(target.fileId, w.propertyB.id).expect(422)).body.code).toBe('FILE_MISMATCH');
    await attach(target.fileId).expect(201);
    expect((await attach(target.fileId).expect(422)).body.code).toBe('FILE_ALREADY_USED');
  });

  it('refuses to attach a receipt to another property’s expense', async () => {
    const fileId = await uploadReceiptFile();
    const res = await t
      .as('admin')
      .post(`/v1/properties/${w.propertyA.id}/receipts`, { fileId, expenseId: w.expenses.b, receiptDate: '2026-11-07' })
      .expect(422);
    expect(res.body.code).toBe('UNKNOWN_EXPENSE');
  });

  it('only accepts allowed file types and sizes', async () => {
    await requestUpload({ contentType: 'text/html' }).expect(400);
    await requestUpload({ sizeBytes: 25 * 1024 * 1024 }).expect(400);
    await requestUpload({ sha256: 'not-a-hash' }).expect(400);
  });

  it('hides receipts from owners once voided, and from owners of TruHost-borne expenses', async () => {
    const owner = () => t.as('ownerA').get(`/v1/properties/${w.propertyA.id}/receipts?${NOV}`).expect(200);
    expect((await owner()).body.items.map((r: { id: string }) => r.id)).toEqual([w.receipts.a]);
    await t.as('admin').post(`/v1/receipts/${w.receipts.a}/void`, { reason: 'Wrong file' }).expect(200);
    expect((await owner()).body.items).toEqual([]);
    await t.as('ownerA').get(`/v1/files/${w.files.a}/url`).expect(404);
  });

  describe('database guarantees', () => {
    it('keeps verified files immutable and undeletable', async () => {
      await expect(
        t.prisma.storedFile.update({ where: { id: w.files.a }, data: { sha256: 'c'.repeat(64) } }),
      ).rejects.toThrow(/immutable/);
      await expect(
        t.prisma.storedFile.update({ where: { id: w.files.a }, data: { status: 'PENDING', verifiedAt: null } }),
      ).rejects.toThrow(/already verified/);
      await expect(t.prisma.$executeRaw`DELETE FROM "StoredFile" WHERE id = ${w.files.a}::uuid`).rejects.toThrow(
        /evidence/,
      );
    });

    it('never deletes receipts and keeps their file fixed', async () => {
      await expect(t.prisma.$executeRaw`DELETE FROM "Receipt" WHERE id = ${w.receipts.a}::uuid`).rejects.toThrow(
        /void it/,
      );
      await expect(
        t.prisma.receipt.update({ where: { id: w.receipts.a }, data: { fileId: w.files.b } }),
      ).rejects.toThrow();
    });

    it('requires a reason when a receipt is voided', async () => {
      await expect(
        t.prisma.receipt.update({
          where: { id: w.receipts.a },
          data: { voidedAt: new Date(), voidedById: w.users.admin.id },
        }),
      ).rejects.toThrow(/receipt_void_reason/);
    });

    it('rejects a receipt pointing at another property’s expense', async () => {
      await expect(
        t.prisma.receipt.update({ where: { id: w.receipts.a }, data: { expenseId: w.expenses.b } }),
      ).rejects.toThrow(/receipt_expense_same_property/);
    });
  });
});
