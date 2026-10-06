import { ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerOptions, type ThrottlerRequest } from '@nestjs/throttler';
import { IS_PUBLIC, type ActorRequest } from '../auth/actor.js';
import type { Env } from '../config/env.js';

/**
 * Rate-limit tiers (CLAUDE.md rule 8, docs/spec.md §5). Two guards share one storage:
 * - PreAuthThrottlerGuard runs before authentication and applies the per-IP `ip-*` tiers, so
 *   unauthenticated floods are cut off before token verification.
 * - PostAuthThrottlerGuard runs after authentication and applies per-user `user-*` tiers.
 */
export const RATE_TIER = 'truhost:rate-tier';
export type RateTier = 'auth';
/** Puts a route on a stricter tier (e.g. invites, profile changes). */
export const RateTier = (tier: RateTier) => SetMetadata(RATE_TIER, tier);

const meta = <T>(ctx: ExecutionContext, key: string): T | undefined =>
  (Reflect.getMetadata(key, ctx.getHandler()) ?? Reflect.getMetadata(key, ctx.getClass())) as T | undefined;

const isWrite = (ctx: ExecutionContext) =>
  !['GET', 'HEAD', 'OPTIONS'].includes(ctx.switchToHttp().getRequest<{ method: string }>().method);

const byIp = (req: Record<string, unknown>) => (typeof req.ip === 'string' ? req.ip : 'unknown');
const byUser = (req: Record<string, unknown>) => (req as unknown as ActorRequest).actor?.userId ?? `ip:${byIp(req)}`;

export function throttlers(env: Env): ThrottlerOptions[] {
  const n = (limit: number) => Math.ceil(limit * env.RATE_LIMIT_MULTIPLIER);
  return [
    { name: 'ip-global', ttl: 60_000, limit: n(300), getTracker: byIp },
    {
      name: 'ip-public',
      ttl: 60_000,
      limit: n(30),
      getTracker: byIp,
      skipIf: (ctx) => !meta<boolean>(ctx, IS_PUBLIC),
    },
    { name: 'user-default', ttl: 60_000, limit: n(120), getTracker: byUser },
    { name: 'user-write', ttl: 60_000, limit: n(30), getTracker: byUser, skipIf: (ctx) => !isWrite(ctx) },
    {
      name: 'user-auth',
      ttl: 60_000,
      limit: n(10),
      getTracker: byUser,
      skipIf: (ctx) => meta<RateTier>(ctx, RATE_TIER) !== 'auth',
    },
  ];
}

@Injectable()
export class PreAuthThrottlerGuard extends ThrottlerGuard {
  protected override async handleRequest(props: ThrottlerRequest): Promise<boolean> {
    return props.throttler.name?.startsWith('ip-') ? super.handleRequest(props) : true;
  }
}

@Injectable()
export class PostAuthThrottlerGuard extends ThrottlerGuard {
  protected override async handleRequest(props: ThrottlerRequest): Promise<boolean> {
    return props.throttler.name?.startsWith('user-') ? super.handleRequest(props) : true;
  }
}
