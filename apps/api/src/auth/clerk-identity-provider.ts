import { Inject, Injectable, Logger } from '@nestjs/common';
import { createClerkClient, verifyToken, type ClerkClient } from '@clerk/backend';
import { isClerkAPIResponseError, TokenVerificationError } from '@clerk/backend/errors';
import { ENV, type Env } from '../config/env.js';
import { IdentityUnavailableError, type IdentityProvider } from './identity-provider.js';

/**
 * Token failures that say nothing about the token: Clerk's keys couldn't be fetched (network or Clerk down), or our
 * keys are wrong. Everything else (expired, bad signature, wrong party, unknown key id…) is an invalid token.
 */
const UNAVAILABLE_REASONS = new Set<string>([
  'jwk-remote-failed-to-load',
  'jwk-remote-invalid',
  'jwk-remote-missing',
  'jwk-failed-to-resolve',
  'jwk-local-missing',
  'secret-key-invalid',
]);

/** Whether a token verification failure means "couldn't check" rather than "invalid token". */
export function verificationUnavailable(error: unknown): boolean {
  // Network failures (fetch failed, DNS, timeouts) arrive as plain errors, not TokenVerificationError.
  if (!(error instanceof TokenVerificationError)) return true;
  return UNAVAILABLE_REASONS.has(error.reason);
}

/** Whether a Clerk Backend API failure is on Clerk's side, ours (bad secret key), or the network's. */
export function apiUnavailable(error: unknown): boolean {
  return !isClerkAPIResponseError(error) || error.status >= 500 || error.status === 401 || error.status === 429;
}

@Injectable()
export class ClerkIdentityProvider implements IdentityProvider {
  private readonly logger = new Logger(ClerkIdentityProvider.name);
  private readonly clerk: ClerkClient;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
    if (!env.CLERK_JWT_KEY) {
      this.logger.warn(
        'CLERK_JWT_KEY is not set: every sign-in check depends on fetching Clerk’s keys (cached 5 minutes), so a ' +
          'network blip blocks sign-in. Set it to the JWT public key from the Clerk dashboard (API keys).',
      );
    }
  }

  async verifySessionToken(token: string): Promise<string | null> {
    try {
      const payload = await verifyToken(token, {
        secretKey: this.env.CLERK_SECRET_KEY,
        jwtKey: this.env.CLERK_JWT_KEY,
        authorizedParties: this.env.CORS_ORIGINS.length ? this.env.CORS_ORIGINS : undefined,
      });
      return payload.sub;
    } catch (e) {
      const message = describe(e);
      if (verificationUnavailable(e)) {
        this.logger.warn(`Couldn't verify a session token: ${message}`);
        throw new IdentityUnavailableError(`Token verification unavailable: ${message}`, { cause: e });
      }
      this.logger.debug(`Token rejected: ${message}`);
      return null;
    }
  }

  async getVerifiedPrimaryEmail(subject: string): Promise<string | null> {
    let user;
    try {
      user = await this.clerk.users.getUser(subject);
    } catch (e) {
      if (!apiUnavailable(e)) throw e;
      this.logger.warn(`Couldn't load the Clerk user for a first sign-in: ${describe(e)}`);
      throw new IdentityUnavailableError(`Clerk user lookup unavailable: ${describe(e)}`, { cause: e });
    }
    const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
    if (!primary || primary.verification?.status !== 'verified') return null;
    return primary.emailAddress.toLowerCase();
  }

  async createInvitation(email: string, redirectUrl: string): Promise<{ id: string; url: string }> {
    const invitation = await this.clerk.invitations.createInvitation({
      emailAddress: email,
      redirectUrl,
      notify: false,
      ignoreExisting: true,
    });
    if (!invitation.url) throw new Error('Clerk returned an invitation without a URL');
    return { id: invitation.id, url: invitation.url };
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    await this.clerk.invitations.revokeInvitation(invitationId);
  }

  async revokeAccess(subject: string): Promise<void> {
    await this.clerk.users.banUser(subject);
  }
}

function describe(e: unknown): string {
  if (e instanceof TokenVerificationError) return `${e.reason}: ${e.message}`;
  if (e instanceof Error) return e.cause instanceof Error ? `${e.message} (${e.cause.message})` : e.message;
  return String(e);
}
