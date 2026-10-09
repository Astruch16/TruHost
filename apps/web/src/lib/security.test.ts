import { describe, expect, it } from 'vitest';
import { centreSquare } from './avatar';
import { applyMotion } from './preferences';
import { backupCodesFile, cleanCode, deviceLabel, formatSecret, placeLabel, timeAgo } from './security';

describe('security helpers', () => {
  const now = new Date('2026-10-09T18:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it('says how long ago a device was active', () => {
    expect(timeAgo(ago(30_000), now)).toBe('Active now');
    expect(timeAgo(ago(5 * 60_000), now)).toBe('5 minutes ago');
    expect(timeAgo(ago(60 * 60_000), now)).toBe('1 hour ago');
    expect(timeAgo(ago(26 * 3600_000), now)).toBe('1 day ago');
    expect(timeAgo(ago(3 * 86400_000), now)).toBe('3 days ago');
    expect(timeAgo(new Date('2026-08-01T12:00:00Z'), now)).toBe('Aug 1, 2026');
  });

  it('names devices and places from whatever is known', () => {
    expect(deviceLabel({ browserName: 'Chrome', deviceType: 'Macintosh' })).toBe('Chrome on Macintosh');
    expect(deviceLabel({ browserName: 'Safari', isMobile: true })).toBe('Safari on a phone');
    expect(deviceLabel({})).toBe('Unknown device');
    expect(placeLabel({ city: 'Vancouver', country: 'CA' })).toBe('Vancouver, CA');
    expect(placeLabel({})).toBeNull();
  });

  it('formats an authenticator key and cleans typed codes', () => {
    expect(formatSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
    expect(formatSecret('ABCDEF')).toBe('ABCD EF');
    expect(cleanCode(' 123 456 ')).toBe('123456');
    expect(cleanCode('abcd-efgh')).toBe('abcdefgh');
  });

  it('writes backup codes to a file with instructions', () => {
    const text = backupCodesFile(['aaaa1111', 'bbbb2222'], 'sam@example.com', new Date(2026, 9, 9));
    expect(text).toContain('For sam@example.com');
    expect(text.split('\n')).toEqual(expect.arrayContaining(['aaaa1111', 'bbbb2222']));
  });
});

describe('avatar crop', () => {
  it('takes the largest centred square', () => {
    expect(centreSquare(4000, 3000)).toEqual({ x: 500, y: 0, side: 3000 });
    expect(centreSquare(1080, 1920)).toEqual({ x: 0, y: 420, side: 1080 });
    expect(centreSquare(301, 300)).toEqual({ x: 0, y: 0, side: 300 });
  });
});

describe('reduce motion', () => {
  it('marks the page while chosen and clears it afterwards', () => {
    const root = document.createElement('html');
    const undo = applyMotion('REDUCED', root);
    expect(root.dataset.motion).toBe('reduced');
    undo();
    expect(root.dataset.motion).toBeUndefined();
    applyMotion('SYSTEM', root);
    expect(root.dataset.motion).toBeUndefined();
  });
});
