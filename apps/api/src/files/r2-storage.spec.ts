import { linkWindow, type LinkWindow } from './storage.js';
import { R2Storage } from './r2-storage.js';

describe('R2Storage.presignPut', () => {
  const storage = new R2Storage({ accountId: 'acct', accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'secret' }, 'bucket');
  const sha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  it('signs type, length and checksum, keeping the checksum a required header', async () => {
    const target = await storage.presignPut({
      key: 'properties/p/receipt/f',
      contentType: 'application/pdf',
      sizeBytes: 10,
      sha256Hex: sha,
    });
    const url = new URL(target.url);
    expect(url.host).toBe('bucket.acct.r2.cloudflarestorage.com');
    const signed = url.searchParams.get('X-Amz-SignedHeaders')!.split(';');
    expect(signed).toEqual(expect.arrayContaining(['content-type', 'content-length', 'x-amz-checksum-sha256']));
    expect(url.searchParams.has('x-amz-checksum-sha256')).toBe(false);
    expect(target.headers).toEqual({
      'Content-Type': 'application/pdf',
      'x-amz-checksum-sha256': Buffer.from(sha, 'hex').toString('base64'),
    });
    expect(Number(url.searchParams.get('X-Amz-Expires'))).toBe(600);
  });
});

describe('R2Storage.presignGet', () => {
  const storage = new R2Storage({ accountId: 'acct', accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'secret' }, 'bucket');
  const get = (window?: LinkWindow) =>
    storage.presignGet('properties/p/property_photo/f', { contentType: 'image/jpeg', filename: null, window });

  it('signs windowed links at the window start, identically for everyone in it, and lets the browser cache them', async () => {
    const w = linkWindow(new Date('2026-10-08T12:03:10Z'));
    const [a, b] = [await get(w), await get(linkWindow(new Date('2026-10-08T12:01:00Z')))];
    expect(a.url).toBe(b.url);
    const url = new URL(a.url);
    expect(url.searchParams.get('X-Amz-Date')).toBe('20261008T120000Z');
    expect(Number(url.searchParams.get('X-Amz-Expires'))).toBe(300);
    expect(url.searchParams.get('response-cache-control')).toBe('private, max-age=240, immutable');
    expect(a.expiresAt).toBe('2026-10-08T12:05:00.000Z');
  });

  it('keeps plain links (receipts) uncached and signed now', async () => {
    const url = new URL((await get()).url);
    expect(url.searchParams.has('response-cache-control')).toBe(false);
    expect(Number(url.searchParams.get('X-Amz-Expires'))).toBe(300);
  });
});

describe('linkWindow', () => {
  it.each([
    ['2026-10-08T12:00:00Z', '2026-10-08T12:00:00.000Z', '2026-10-08T12:05:00.000Z'],
    ['2026-10-08T12:03:59Z', '2026-10-08T12:00:00.000Z', '2026-10-08T12:05:00.000Z'],
    ['2026-10-08T12:04:00Z', '2026-10-08T12:04:00.000Z', '2026-10-08T12:09:00.000Z'],
  ])('at %s signs at %s and expires at %s', (now, signedAt, expiresAt) => {
    const w = linkWindow(new Date(now));
    expect(w.signedAt.toISOString()).toBe(signedAt);
    expect(w.expiresAt.toISOString()).toBe(expiresAt);
  });

  it('never lives longer than five minutes, and always has at least one left', () => {
    for (let s = 0; s < 600; s += 7) {
      const now = new Date(Date.UTC(2026, 9, 8, 12) + s * 1000);
      const w = linkWindow(now);
      expect(w.expiresAt.getTime() - w.signedAt.getTime()).toBe(300_000);
      expect(w.expiresAt.getTime() - now.getTime()).toBeGreaterThanOrEqual(60_000);
      expect(w.signedAt.getTime()).toBeLessThanOrEqual(now.getTime());
    }
  });
});
