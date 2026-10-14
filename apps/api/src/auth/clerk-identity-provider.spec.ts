import { createSign, generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClerkAPIResponseError, TokenVerificationError } from '@clerk/backend/errors';
import type { Env } from '../config/env.js';
import { apiUnavailable, ClerkIdentityProvider, verificationUnavailable } from './clerk-identity-provider.js';
import { IdentityUnavailableError } from './identity-provider.js';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
/** An RS256 session token signed with this file's key (or garbage for the signature). */
function token(claims: Record<string, unknown>, sign = true): string {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'RS256', typ: 'JWT', kid: 'ins_test' })}.${b64({ sub: 'user_1', iat: now - 5, nbf: now - 5, exp: now + 60, ...claims })}`;
  const signature = sign
    ? createSign('RSA-SHA256').update(body).sign(privateKey).toString('base64url')
    : Buffer.from('forged').toString('base64url');
  return `${body}.${signature}`;
}

const provider = (env: Partial<Env>) =>
  new ClerkIdentityProvider({ CLERK_SECRET_KEY: 'sk_test_unit', CORS_ORIGINS: [], ...env } as Env);

const reason = (r: string) => new TokenVerificationError({ message: r, reason: r });

describe('telling "couldn’t check" from "invalid token"', () => {
  it.each([
    ['a network failure', new TypeError('fetch failed'), true],
    ['Clerk’s keys failing to load', reason('jwk-remote-failed-to-load'), true],
    ['a wrong secret key', reason('secret-key-invalid'), true],
    ['no key to check with', reason('jwk-failed-to-resolve'), true],
    ['an expired token', reason('token-expired'), false],
    ['a bad signature', reason('token-invalid-signature'), false],
    ['an unknown key id', reason('jwk-kid-mismatch'), false],
    ['another app’s token', reason('token-invalid-authorized-parties'), false],
  ])('%s → unavailable: %s', (_case, error, unavailable) => {
    expect(verificationUnavailable(error)).toBe(unavailable);
  });

  it.each([
    ['a network failure', new TypeError('fetch failed'), true],
    ['Clerk down', new ClerkAPIResponseError('down', { data: [], status: 503 }), true],
    ['our secret key rejected', new ClerkAPIResponseError('key', { data: [], status: 401 }), true],
    ['rate limited', new ClerkAPIResponseError('slow', { data: [], status: 429 }), true],
    ['no such user', new ClerkAPIResponseError('missing', { data: [], status: 404 }), false],
  ])('a user lookup failing with %s → unavailable: %s', (_case, error, unavailable) => {
    expect(apiUnavailable(error)).toBe(unavailable);
  });
});

describe('ClerkIdentityProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('with CLERK_JWT_KEY (networkless)', () => {
    const fetchSpy = () => {
      const spy = vi.fn(() => Promise.reject(new TypeError('fetch failed')));
      vi.stubGlobal('fetch', spy);
      return spy;
    };

    it('accepts a valid token without calling Clerk', async () => {
      const fetch = fetchSpy();
      await expect(provider({ CLERK_JWT_KEY: PEM }).verifySessionToken(token({}))).resolves.toBe('user_1');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects expired and forged tokens as invalid (null), not unavailable', async () => {
      const fetch = fetchSpy();
      const p = provider({ CLERK_JWT_KEY: PEM });
      const past = Math.floor(Date.now() / 1000) - 3600;
      await expect(p.verifySessionToken(token({ iat: past - 60, nbf: past - 60, exp: past }))).resolves.toBeNull();
      await expect(p.verifySessionToken(token({}, false))).resolves.toBeNull();
      await expect(p.verifySessionToken('not.a.token')).resolves.toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it('without CLERK_JWT_KEY, a network failure fetching Clerk’s keys is "unavailable", not a bad token', async () => {
    const fetch = vi.fn(() => Promise.reject(new TypeError('fetch failed')));
    vi.stubGlobal('fetch', fetch);
    await expect(provider({}).verifySessionToken(token({}))).rejects.toBeInstanceOf(IdentityUnavailableError);
    expect(fetch).toHaveBeenCalled();
  });
});
