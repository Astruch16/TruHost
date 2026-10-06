import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

describe('authentication and first sign-in', () => {
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

  it('rejects a missing or invalid token with 401', async () => {
    await t.http().get('/v1/me').expect(401);
    await t.http().get('/v1/me').set('Authorization', 'Bearer not-a-real-token').expect(401);
    await t.http().get('/v1/me').set('Authorization', 'Basic abc').expect(401);
  });

  it('resolves roles from our database, not the token', async () => {
    const res = await t.as('admin').get('/v1/me').expect(200);
    expect(res.body).toMatchObject({ staffRole: 'ADMIN', status: 'ACTIVE' });
    expect(res.body.memberships).toEqual([
      { id: w.memberships.adminOwnsA, role: 'OWNER', property: { id: w.propertyA.id, name: 'Property A' } },
    ]);
  });

  it('links an invited user on first sign-in by verified email and accepts the invite', async () => {
    t.identity.users.set('clerk_new', 'invited@example.test');
    const res = await t.as('clerk_new').get('/v1/me').expect(200);
    expect(res.body).toMatchObject({ id: w.invitedUserId, status: 'ACTIVE' });
    expect(res.body.memberships).toHaveLength(1);

    const user = await t.prisma.user.findUniqueOrThrow({ where: { id: w.invitedUserId } });
    expect(user.clerkUserId).toBe('clerk_new');
    const invite = await t.prisma.invite.findUniqueOrThrow({ where: { id: w.pendingInviteId } });
    expect(invite.status).toBe('ACCEPTED');
    expect(await t.prisma.auditLog.count({ where: { action: 'user.link', entityId: w.invitedUserId } })).toBe(1);
  });

  it('refuses an identity whose email was never invited', async () => {
    t.identity.users.set('clerk_stranger', 'stranger@example.test');
    const res = await t.as('clerk_stranger').get('/v1/me').expect(403);
    expect(res.body.code).toBe('NOT_INVITED');
  });

  it('refuses an identity without a verified email', async () => {
    t.identity.users.set('clerk_unverified', null);
    await t.as('clerk_unverified').get('/v1/me').expect(403);
  });

  it('will not link a second identity to an already-linked user', async () => {
    t.identity.users.set('clerk_imposter', 'ownera@example.test');
    const res = await t.as('clerk_imposter').get('/v1/me').expect(403);
    expect(res.body.code).toBe('NOT_INVITED');
  });

  it('will not link a user whose invite was revoked', async () => {
    await t.as('admin').post(`/v1/invites/${w.pendingInviteId}/revoke`).expect(200);
    t.identity.users.set('clerk_new', 'invited@example.test');
    await t.as('clerk_new').get('/v1/me').expect(403);
  });

  it('rejects a deactivated user with 401', async () => {
    await t.as('admin').post(`/v1/users/${w.users.ownerB.id}/deactivate`).expect(200);
    await t.as('ownerB').get('/v1/me').expect(401);
    expect(t.identity.revokedAccess).toEqual(['ownerB']);
  });

  it('drops access as soon as a membership is revoked', async () => {
    await t.as('cleanerA').get(`/v1/properties/${w.propertyA.id}`).expect(200);
    await t.as('admin').post(`/v1/memberships/${w.memberships.cleanerA}/revoke`).expect(200);
    await t.as('cleanerA').get(`/v1/properties/${w.propertyA.id}`).expect(404);
  });
});
