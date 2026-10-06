import type { IdentityProvider } from '../../src/auth/identity-provider.js';

/**
 * Stand-in for Clerk. A session token is `test:<subject>`; anything else is invalid.
 * Register a subject's verified email with `users.set(subject, email)`.
 */
export class FakeIdentityProvider implements IdentityProvider {
  readonly users = new Map<string, string | null>();
  readonly invitations: { id: string; email: string; redirectUrl: string; url: string }[] = [];
  readonly revokedInvitations: string[] = [];
  readonly revokedAccess: string[] = [];
  private seq = 0;

  verifySessionToken(token: string): Promise<string | null> {
    return Promise.resolve(token.startsWith('test:') ? token.slice(5) : null);
  }

  getVerifiedPrimaryEmail(subject: string): Promise<string | null> {
    return Promise.resolve(this.users.get(subject) ?? null);
  }

  createInvitation(email: string, redirectUrl: string): Promise<{ id: string; url: string }> {
    const id = `inv_${++this.seq}`;
    const invitation = { id, email, redirectUrl, url: `${redirectUrl}?__clerk_ticket=${id}` };
    this.invitations.push(invitation);
    return Promise.resolve({ id, url: invitation.url });
  }

  revokeInvitation(invitationId: string): Promise<void> {
    this.revokedInvitations.push(invitationId);
    return Promise.resolve();
  }

  revokeAccess(subject: string): Promise<void> {
    this.revokedAccess.push(subject);
    return Promise.resolve();
  }

  reset(): void {
    this.users.clear();
    this.invitations.length = 0;
    this.revokedInvitations.length = 0;
    this.revokedAccess.length = 0;
    this.seq = 0;
  }
}
