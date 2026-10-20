import { z } from 'zod';
import { OnboardingRole, TourStatus } from '../enums.js';

/**
 * Each welcome tour's version. Bump one when its tour changes materially: anyone who finished or skipped an older
 * version is offered it once more. OWNER 2 (2026-10-20): every section of the home page, and each page's content. CLEANER 2
 * (2026-10-21): the schedule and the photo checklist.
 */
export const TOUR_VERSIONS: Record<OnboardingRole, number> = { ADMIN: 1, OWNER: 2, CLEANER: 2 };

export const onboardingTour = z.object({
  role: OnboardingRole,
  status: TourStatus,
  /** The last step seen, so an interrupted tour resumes there. */
  step: z.number().int().nullable(),
  /** Offer the welcome: never finished or skipped (or interrupted), or the tour has changed since. */
  offer: z.boolean(),
});
export type OnboardingTour = z.infer<typeof onboardingTour>;

/** The caller's tours, one per role they hold, admin first. */
export const onboarding = z.object({ tours: z.array(onboardingTour) });
export type Onboarding = z.infer<typeof onboarding>;

export const TourAction = z.enum(['START', 'STEP', 'COMPLETE', 'SKIP', 'RESET']);
export type TourAction = z.infer<typeof TourAction>;

/** Progress through a tour. `step` is the step now on screen: required for STEP, optional for START and SKIP. */
export const updateTour = z
  .object({ action: TourAction, step: z.number().int().min(0).max(99).optional() })
  .refine((v) => v.action !== 'STEP' || v.step !== undefined, { message: 'A step is required', path: ['step'] })
  .refine((v) => v.step === undefined || ['START', 'STEP', 'SKIP'].includes(v.action), {
    message: 'Only START, STEP and SKIP take a step',
    path: ['step'],
  });
export type UpdateTour = z.infer<typeof updateTour>;
