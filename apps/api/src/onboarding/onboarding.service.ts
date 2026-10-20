import { Injectable } from '@nestjs/common';
import {
  TOUR_VERSIONS,
  type Onboarding,
  type OnboardingRole,
  type OnboardingTour,
  type UpdateTour,
} from '@truhost/shared';
import type { Actor } from '../auth/actor.js';
import { notFound } from '../common/problem.js';
import type { TourStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * The tours a user is offered: admins get the admin tour; owners who aren't admins get the owner portal's; anyone who
 * cleans a property gets the cleaner's. (An admin who owns a property uses the admin pages, so has no owner tour.)
 */
export function tourRoles(actor: Pick<Actor, 'staffRole' | 'memberships'>): OnboardingRole[] {
  const roles: OnboardingRole[] = [];
  if (actor.staffRole === 'ADMIN') roles.push('ADMIN');
  else if (actor.memberships.some((m) => m.role === 'OWNER')) roles.push('OWNER');
  if (actor.memberships.some((m) => m.role === 'CLEANER')) roles.push('CLEANER');
  return roles;
}

/**
 * Welcome tour progress (docs/spec.md, Phase 4b). Self-scoped: each user reads and moves only their own, for the
 * roles they hold; another role's tour is not found. UI progress only, never used for access.
 */
@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async get(actor: Actor): Promise<Onboarding> {
    const roles = tourRoles(actor);
    const rows = await this.prisma.onboardingProgress.findMany({
      where: { userId: actor.userId, role: { in: roles } },
    });
    return {
      tours: roles.map((role) => {
        const row = rows.find((r) => r.role === role);
        return toTour(role, row?.tourStatus ?? 'NOT_STARTED', row?.tourStep ?? null, row?.tourVersion ?? 1);
      }),
    };
  }

  async update(actor: Actor, role: OnboardingRole, input: UpdateTour): Promise<Onboarding> {
    if (!tourRoles(actor).includes(role)) throw notFound('Tour');
    const version = TOUR_VERSIONS[role];
    const data: { tourStatus: TourStatus; tourStep: number | null; tourVersion?: number } = (() => {
      switch (input.action) {
        case 'START':
          return { tourStatus: 'IN_PROGRESS', tourStep: input.step ?? 0, tourVersion: version };
        case 'STEP':
          return { tourStatus: 'IN_PROGRESS', tourStep: input.step! };
        case 'COMPLETE':
          return { tourStatus: 'COMPLETED', tourStep: null, tourVersion: version };
        case 'SKIP':
          return { tourStatus: 'SKIPPED', tourStep: input.step ?? null, tourVersion: version };
        case 'RESET':
          return { tourStatus: 'NOT_STARTED', tourStep: null };
      }
    })();
    await this.prisma.onboardingProgress.upsert({
      where: { userId_role: { userId: actor.userId, role } },
      create: { userId: actor.userId, role, ...data, tourVersion: data.tourVersion ?? version },
      update: data,
    });
    return this.get(actor);
  }
}

/** A stored tour as the API shows it: offered until finished or skipped, and again once the tour is newer. */
export function toTour(
  role: OnboardingRole,
  status: TourStatus,
  step: number | null,
  version: number,
  current = TOUR_VERSIONS[role],
): OnboardingTour {
  const finished = status === 'COMPLETED' || status === 'SKIPPED';
  return { role, status, step, offer: !finished || version < current };
}
