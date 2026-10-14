import { ApiError } from '@truhost/api-client';

/**
 * Why the signed-in user's account (GET /v1/me) couldn't load, which decides what the screen offers:
 * - notInvited: signed in with Clerk, but TruHost never invited this email (403 NOT_INVITED). Sign out.
 * - sessionEnded: the API rejected the session (401). Sign in again.
 * - authUnavailable: the API couldn't reach the sign-in service to check the session (503 AUTH_UNAVAILABLE). Temporary.
 * - offline: the API couldn't be reached at all (no response). Temporary.
 * - other: anything else (a 5xx). Temporary as far as the person can tell.
 */
export type AccountLoadFailure = 'notInvited' | 'sessionEnded' | 'authUnavailable' | 'offline' | 'other';

export function accountLoadFailure(error: unknown): AccountLoadFailure {
  if (!(error instanceof ApiError)) return 'offline';
  if (error.problem.code === 'NOT_INVITED') return 'notInvited';
  if (error.problem.code === 'AUTH_UNAVAILABLE') return 'authUnavailable';
  if (error.status === 401) return 'sessionEnded';
  return 'other';
}

export const FAILURE_TEXT: Record<AccountLoadFailure, { title: string; subtitle: string }> = {
  notInvited: {
    title: 'No access yet',
    subtitle: 'TruHost is invite only. Ask your TruHost contact to invite this email address, then sign in again.',
  },
  sessionEnded: {
    title: 'Your session has ended',
    subtitle: 'Sign in again to carry on where you left off.',
  },
  authUnavailable: {
    title: 'We couldn’t check your sign-in',
    subtitle: 'Your account is fine. The sign-in service didn’t answer just now, usually a brief network hiccup.',
  },
  offline: {
    title: 'We couldn’t reach TruHost',
    subtitle: 'Check your internet connection, then try again.',
  },
  other: {
    title: 'We couldn’t load your account',
    subtitle: 'Something went wrong on our side. Try again in a moment.',
  },
};
