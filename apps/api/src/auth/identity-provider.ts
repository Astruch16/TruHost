/**
 * Everything the API needs from the identity provider (Clerk). Behind an interface so tests can
 * swap in a fake, and so Clerk-specific code stays in one file.
 */
export interface IdentityProvider {
  /** Verifies a session token; returns the provider's user id, or null if the token is invalid. */
  verifySessionToken(token: string): Promise<string | null>;
  /** The user's primary email if it is verified, else null. */
  getVerifiedPrimaryEmail(subject: string): Promise<string | null>;
  /** Sends a sign-up invitation. Returns null when the provider isn't configured to send email. */
  sendInvitation(email: string): Promise<{ id: string } | null>;
  revokeInvitation(invitationId: string): Promise<void>;
  /** Ends all sessions and blocks sign-in (used on deactivation). */
  revokeAccess(subject: string): Promise<void>;
}

export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');
