import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getStorageToken, type ThrottlerStorage } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProblemException } from '../common/problem.js';
import { ENV, type Env } from '../config/env.js';
import { IS_PUBLIC, type Actor, type ActorRequest } from './actor.js';
import { IDENTITY_PROVIDER, type IdentityProvider } from './identity-provider.js';

const LINK_LIMIT = { ttlMs: 60_000, limit: 10 };

/**
 * Global guard: verifies the bearer token with the identity provider and resolves our own User
 * and memberships. Roles never come from the token. An unknown identity is linked to an INVITED
 * user by verified email on first sign-in (docs/spec.md §5).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    @Inject(getStorageToken()) private readonly throttlerStorage: ThrottlerStorage,
    @Inject(IDENTITY_PROVIDER) private readonly identity: IdentityProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<ActorRequest>();
    const token = bearer(req.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    const subject = await this.identity.verifySessionToken(token);
    if (!subject) throw new UnauthorizedException('Invalid session token');

    const user =
      (await this.prisma.user.findUnique({ where: { clerkUserId: subject } })) ??
      (await this.linkOnFirstSignIn(subject, req));

    if (user.status !== 'ACTIVE') throw new UnauthorizedException('User is not active');

    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id, revokedAt: null },
      select: { propertyId: true, role: true },
    });

    const actor: Actor = {
      userId: user.id,
      staffRole: user.staffRole,
      memberships,
      requestId: req.id,
      ip: req.ip,
    };
    req.actor = actor;
    return true;
  }

  private async linkOnFirstSignIn(subject: string, req: ActorRequest) {
    // Linking calls the identity provider's API, so it has its own tight per-IP limit.
    const { isBlocked } = await this.throttlerStorage.increment(
      `link:${req.ip ?? 'unknown'}`,
      LINK_LIMIT.ttlMs,
      Math.ceil(LINK_LIMIT.limit * this.env.RATE_LIMIT_MULTIPLIER),
      LINK_LIMIT.ttlMs,
      'link',
    );
    if (isBlocked) {
      throw new ProblemException({ status: HttpStatus.TOO_MANY_REQUESTS, code: 'RATE_LIMITED' });
    }

    const email = await this.identity.getVerifiedPrimaryEmail(subject);
    const notInvited = new ProblemException({
      status: HttpStatus.FORBIDDEN,
      code: 'NOT_INVITED',
      detail: 'This account has not been invited to TruHost',
    });
    if (!email) throw notInvited;

    return this.prisma.$transaction(async (tx) => {
      const invited = await tx.user.findUnique({ where: { email } });
      if (!invited || invited.status !== 'INVITED' || invited.clerkUserId) throw notInvited;

      const user = await tx.user.update({
        where: { id: invited.id },
        data: { clerkUserId: subject, status: 'ACTIVE' },
      });
      await tx.invite.updateMany({
        where: { userId: user.id, status: 'PENDING' },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorType: 'USER',
          actorId: user.id,
          action: 'user.link',
          entityType: 'User',
          entityId: user.id,
          after: { status: 'ACTIVE' },
          requestId: req.id,
          ipAddress: req.ip,
        },
      });
      return user;
    });
  }
}

function bearer(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') return null;
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : null;
}
