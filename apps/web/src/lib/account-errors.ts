import { isClerkAPIResponseError, isClerkRuntimeError, isReverificationCancelledError } from '@clerk/react/errors';

/**
 * Turns an error from a Settings → Security action (password, two-step verification, devices) into wording for
 * the user. Like sign-in, Clerk's own messages are never shown. Returns null when the user simply cancelled.
 */
export function accountErrorMessage(error: unknown): string | null {
  if (isReverificationCancelledError(error)) return null;
  if (!(error instanceof Error)) return GENERIC;
  if (isClerkRuntimeError(error) && error.code === 'network_error') {
    return 'We can’t reach the sign-in service. Check your connection and try again.';
  }
  if (!isClerkAPIResponseError(error)) return GENERIC;
  switch (error.errors[0]?.code) {
    case 'form_password_incorrect':
      return 'That password isn’t right.';
    case 'form_password_pwned':
      return 'That password has appeared in a data breach elsewhere. Choose a different one.';
    case 'form_password_length_too_short':
    case 'form_password_not_strong_enough':
    case 'form_password_validation_failed':
    case 'form_password_size_in_bytes_exceeded':
      return 'Choose a stronger password: at least 8 characters, not easy to guess.';
    case 'form_code_incorrect':
      return 'That code isn’t right. Codes change every 30 seconds, so use the newest one.';
    case 'verification_expired':
      return 'That code has expired. Start again.';
    case 'verification_failed':
      return 'Too many wrong codes. Start again.';
    case 'too_many_requests':
      return 'Too many attempts. Wait a minute and try again.';
    case 'feature_not_enabled':
    case 'mfa_totp_not_enabled':
      return 'Authenticator apps aren’t switched on for TruHost yet. Please contact TruHost.';
  }
  if (error.status === 429) return 'Too many attempts. Wait a minute and try again.';
  return GENERIC;
}

const GENERIC = 'Something went wrong. Please try again.';
