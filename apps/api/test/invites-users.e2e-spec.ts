import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

describe('invites', () => {
  let t: TestApp;
  let w: World;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    t.identity.reset();
    t.email.reset();
    w = await seedWorld(t.prisma);
  });

  it('creates an INVITED user with memberships, sends the email, and lets them sign in', async () => {
    const res = await t
      .as('admin')
      .post('/v1/invites', {
        email: '  New.Cleaner@Example.TEST ',
        firstName: 'New',
        lastName: 'Cleaner',
        memberships: [{ propertyId: w.propertyB.id, role: 'CLEANER' }],
      })
      .expect(201);
    expect(res.body).toMatchObject({ status: 'PENDING', emailSent: true, user: { email: 'new.cleaner@example.test' } });
    // Clerk creates the invitation without emailing it; we send our own email with its link.
    expect(t.identity.invitations).toEqual([
      {
        id: 'inv_1',
        email: 'new.cleaner@example.test',
        redirectUrl: 'https://app.truhost.example/sign-up',
        url: 'https://app.truhost.example/sign-up?__clerk_ticket=inv_1',
      },
    ]);
    expect(t.email.sent).toHaveLength(1);
    expect(t.email.sent[0]).toMatchObject({ to: 'new.cleaner@example.test', subject: 'You’re invited to TruHost' });
    expect(t.email.sent[0]!.text).toContain('https://app.truhost.example/sign-up?__clerk_ticket=inv_1');
    const stored = await t.prisma.invite.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored).toMatchObject({ clerkInvitationId: 'inv_1', emailMessageId: 'email_1' });
    expect(stored.lastSentAt).toBeInstanceOf(Date);

    t.identity.users.set('clerk_nc', 'new.cleaner@example.test');
    const me = await t.as('clerk_nc').get('/v1/me').expect(200);
    expect(me.body.memberships.map((m: { property: { id: string } }) => m.property.id)).toEqual([w.propertyB.id]);
    await t.as('clerk_nc').get(`/v1/properties/${w.propertyA.id}`).expect(404);
  });

  it('refuses to invite an existing active user', async () => {
    const res = await t
      .as('admin')
      .post('/v1/invites', { email: 'ownera@example.test', firstName: 'A', lastName: 'B' })
      .expect(409);
    expect(res.body.code).toBe('USER_EXISTS');
  });

  it('refuses memberships on unknown properties without creating anything', async () => {
    await t
      .as('admin')
      .post('/v1/invites', {
        email: 'x@example.test',
        firstName: 'X',
        lastName: 'Y',
        memberships: [{ propertyId: '00000000-0000-7000-8000-000000000000', role: 'OWNER' }],
      })
      .expect(422);
    expect(await t.prisma.user.count({ where: { email: 'x@example.test' } })).toBe(0);
  });

  it('can re-invite someone whose invite was revoked', async () => {
    await t.as('admin').post(`/v1/invites/${w.pendingInviteId}/revoke`).expect(200);
    expect(t.identity.revokedInvitations).toEqual(['inv_seed']);
    await t
      .as('admin')
      .post('/v1/invites', { email: 'invited@example.test', firstName: 'Invited', lastName: 'Again' })
      .expect(201);
    t.identity.users.set('clerk_again', 'invited@example.test');
    await t.as('clerk_again').get('/v1/me').expect(200);
  });

  it('resends by replacing the provider invitation', async () => {
    await t.as('admin').post(`/v1/invites/${w.pendingInviteId}/resend`).expect(200);
    expect(t.identity.revokedInvitations).toEqual(['inv_seed']);
    expect(t.identity.invitations).toHaveLength(1);
    expect(t.email.sent.map((m) => m.to)).toEqual(['invited@example.test']);
  });

  it('saves nothing and revokes the provider invitation when the email fails', async () => {
    t.email.fail = true;
    const res = await t
      .as('admin')
      .post('/v1/invites', { email: 'unlucky@example.test', firstName: 'Un', lastName: 'Lucky' })
      .expect(502);
    expect(res.body.code).toBe('EMAIL_FAILED');
    expect(await t.prisma.user.count({ where: { email: 'unlucky@example.test' } })).toBe(0);
    expect(t.identity.revokedInvitations).toEqual(['inv_1']);
  });
});

describe('users', () => {
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

  it('will not let an admin deactivate or demote themselves', async () => {
    expect((await t.as('admin').post(`/v1/users/${w.users.admin.id}/deactivate`).expect(422)).body.code).toBe(
      'CANNOT_DEACTIVATE_SELF',
    );
    expect(
      (await t.as('admin').patch(`/v1/users/${w.users.admin.id}`, { staffRole: null }).expect(422)).body.code,
    ).toBe('CANNOT_DEMOTE_SELF');
  });

  it('always keeps at least one admin', async () => {
    await t.as('admin').patch(`/v1/users/${w.users.ownerB.id}`, { staffRole: 'ADMIN' }).expect(200);
    await t.as('ownerB').patch(`/v1/users/${w.users.admin.id}`, { staffRole: null }).expect(200);
    // ownerB is now the only admin; the former admin can't remove them.
    await t.as('admin').get('/v1/users').expect(404);
    const res = await t.as('ownerB').post(`/v1/users/${w.users.ownerB.id}/deactivate`).expect(422);
    expect(res.body.code).toBe('CANNOT_DEACTIVATE_SELF');
  });

  it('paginates with a cursor', async () => {
    const first = await t.as('admin').get('/v1/users?limit=3').expect(200);
    expect(first.body.items).toHaveLength(3);
    const second = await t.as('admin').get(`/v1/users?limit=3&cursor=${first.body.nextCursor}`).expect(200);
    const third = await t.as('admin').get(`/v1/users?limit=3&cursor=${second.body.nextCursor}`).expect(200);
    const all = [...first.body.items, ...second.body.items, ...third.body.items].map((u: { id: string }) => u.id);
    expect(new Set(all).size).toBe(7);
    expect(third.body.nextCursor).toBeNull();
  });
});
