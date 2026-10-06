/**
 * Everything the API needs from the identity provider (Clerk). Behind an interface so tests can
 * swap in a fake, and so Clerk-specific code stays in one file.
 */
export interface IdentityProvider {
  /** Verifies a session token; returns the provider's user id, or null if the token is invalid. */
  verifySessionToken(token: string): Promise<string | null>;
  /** The user's primary email if it is verified, else null. */
  getVerifiedPrimaryEmail(subject: string): Promise<string | null>;
  /**
   * Creates a sign-up invitation without the provider emailing it (we send our own email with `url`).
   * `redirectUrl` is where the link lands to finish sign-up.
   */
  createInvitation(email: string, redirectUrl: string): Promise<{ id: string; url: string }>;
  revokeInvitation(invitationId: string): Promise<void>;
  /** Ends all sessions and blocks sign-in (used on deactivation). */
  revokeAccess(subject: string): Promise<void>;
}

export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');
