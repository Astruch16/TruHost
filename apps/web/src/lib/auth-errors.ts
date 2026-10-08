import { isClerkAPIResponseError, isClerkRuntimeError } from '@clerk/react/errors';

/**
 * Turns a sign-in error into wording for the user. Clerk's own messages are never shown (they can name Clerk and
 * aren't written for our users); unknown errors get a generic line.
 */
export function signInErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return GENERIC;
  if (isClerkRuntimeError(error) && error.code === 'network_error') {
    return 'We can’t reach the sign-in service. Check your connection and try again.';
  }
  if (!isClerkAPIResponseError(error)) return GENERIC;
  const first = error.errors[0];
  const code = first?.code;
  switch (code) {
    case 'form_password_incorrect':
      return 'That password isn’t right. Try again, or reset it with “Forgot password?”.';
    case 'form_identifier_not_found':
    case 'external_account_not_found':
    case 'sign_up_restricted_waitlist':
    case 'not_allowed_access':
      return 'There’s no TruHost account for that email. TruHost is invite only: use the link in your invitation email, or ask your TruHost contact.';
    case 'user_locked': {
      // Clerk's parser drops the lockout time from the error details; Retry-After is what survives.
      const seconds = Number(error.retryAfter);
      const minutes = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : null;
      return minutes
        ? `Too many attempts. This account is locked for ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`
        : 'Too many attempts. This account is locked for now. Try again later.';
    }
    case 'too_many_requests':
      return 'Too many attempts. Wait a minute and try again.';
    case 'form_param_format_invalid':
      return 'Enter a valid email address.';
    case 'form_param_missing':
      return 'Fill in both your email and password.';
    case 'form_code_incorrect':
      return 'That code isn’t right. Check the email we sent and try again.';
    case 'verification_expired':
      return 'That code has expired. Send a new one.';
    case 'verification_failed':
      return 'Too many wrong codes. Send a new one.';
    case 'form_password_pwned':
      return 'That password has appeared in a data breach elsewhere. Choose a different one.';
    case 'form_password_length_too_short':
    case 'form_password_not_strong_enough':
    case 'form_password_validation_failed':
      return 'Choose a stronger password: at least 8 characters, not easy to guess.';
    case 'strategy_for_user_invalid':
      return 'This account doesn’t use a password. Try “Continue with Google”.';
    case 'oauth_access_denied':
      return 'Google sign-in was cancelled.';
  }
  if (error.status === 429) return 'Too many attempts. Wait a minute and try again.';
  return GENERIC;
}

const GENERIC = 'Something went wrong signing in. Please try again.';
