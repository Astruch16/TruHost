import { Inject, Injectable, Logger } from '@nestjs/common';
import { createClerkClient, verifyToken, type ClerkClient } from '@clerk/backend';
import { ENV, type Env } from '../config/env.js';
import type { IdentityProvider } from './identity-provider.js';

@Injectable()
export class ClerkIdentityProvider implements IdentityProvider {
  private readonly logger = new Logger(ClerkIdentityProvider.name);
  private readonly clerk: ClerkClient;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
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
      this.logger.debug(`Token rejected: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  async getVerifiedPrimaryEmail(subject: string): Promise<string | null> {
    const user = await this.clerk.users.getUser(subject);
    const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
    if (!primary || primary.verification?.status !== 'verified') return null;
    return primary.emailAddress.toLowerCase();
  }

  async sendInvitation(email: string): Promise<{ id: string }> {
    const invitation = await this.clerk.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: this.env.INVITE_REDIRECT_URL,
      notify: true,
      ignoreExisting: true,
    });
    return { id: invitation.id };
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    await this.clerk.invitations.revokeInvitation(invitationId);
  }

  async revokeAccess(subject: string): Promise<void> {
    await this.clerk.users.banUser(subject);
  }
}
