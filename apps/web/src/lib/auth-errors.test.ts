import { describe, expect, it } from 'vitest';
import { ClerkAPIResponseError, ClerkRuntimeError } from '@clerk/react/errors';
import { signInErrorMessage } from './auth-errors';

const apiError = (code: string, status = 422, meta?: Record<string, unknown>, retryAfter?: number) =>
  new ClerkAPIResponseError('Clerk says something internal about Clerk', {
    data: [{ code, message: 'Clerk internal message', long_message: 'Clerk long message', meta }],
    status,
    retryAfter,
  });

describe('signInErrorMessage', () => {
  it.each([
    ['form_password_incorrect', /password isn’t right/],
    ['form_identifier_not_found', /no TruHost account for that email.*invite only/],
    ['external_account_not_found', /no TruHost account/],
    ['form_param_format_invalid', /valid email/],
    ['form_code_incorrect', /code isn’t right/],
    ['verification_expired', /expired/],
    ['form_password_pwned', /data breach/],
    ['strategy_for_user_invalid', /Continue with Google/],
  ])('%s → plain words', (code, message) => {
    expect(signInErrorMessage(apiError(code))).toMatch(message);
  });

  it('says how long a locked account stays locked', () => {
    expect(signInErrorMessage(apiError('user_locked', 403, undefined, 1800))).toBe(
      'Too many attempts. This account is locked for 30 minutes.',
    );
    expect(signInErrorMessage(apiError('user_locked', 403, undefined, 60))).toMatch(/locked for 1 minute\./);
    expect(signInErrorMessage(apiError('user_locked', 403))).toMatch(/locked for now/);
  });

  it('treats rate limiting as too many attempts', () => {
    expect(signInErrorMessage(apiError('too_many_requests', 429))).toMatch(/Too many attempts/);
    expect(signInErrorMessage(apiError('anything_else', 429))).toMatch(/Too many attempts/);
  });

  it('never shows Clerk’s own wording', () => {
    for (const e of [apiError('some_new_code'), new Error('Clerk: failed'), 'nope', null]) {
      const message = signInErrorMessage(e);
      expect(message).not.toMatch(/clerk/i);
      expect(message).toBe('Something went wrong signing in. Please try again.');
    }
  });

  it('explains a lost connection', () => {
    expect(signInErrorMessage(new ClerkRuntimeError('offline', { code: 'network_error' }))).toMatch(/connection/);
  });
});
