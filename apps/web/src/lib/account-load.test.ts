import { describe, expect, it } from 'vitest';
import { ApiError } from '@truhost/api-client';
import { accountLoadFailure } from './account-load';

const api = (status: number, code: string) => new ApiError(status, { type: 'about:blank', title: '', status, code });

describe('why the account couldn’t load', () => {
  it.each([
    ['not invited', api(403, 'NOT_INVITED'), 'notInvited'],
    ['an invalid or ended session', api(401, 'UNAUTHORIZED'), 'sessionEnded'],
    ['the sign-in service unreachable', api(503, 'AUTH_UNAVAILABLE'), 'authUnavailable'],
    ['no response at all', new TypeError('Failed to fetch'), 'offline'],
    ['a server error', api(500, 'INTERNAL'), 'other'],
  ])('%s → %s', (_case, error, failure) => {
    expect(accountLoadFailure(error)).toBe(failure);
  });
});
