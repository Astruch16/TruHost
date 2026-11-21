import { linkWindow } from './storage.js';
import { LocalStorage } from './local-storage.js';

/** A clock the test moves by hand, set years before the real date so a real-time check would fail. */
function testClock(iso: string) {
  let now = new Date(iso);
  return { now: () => now, set: (next: string) => (now = new Date(next)) };
}

/** The key and query of a local link, as LocalStorageController hands them to verify(). */
function parse(url: string) {
  const u = new URL(url);
  const key = u.pathname.replace(/^\/v1\/local-storage\//, '');
  return { key, query: Object.fromEntries(u.searchParams) };
}

describe('LocalStorage links on the app clock', () => {
  const clock = testClock('2020-01-01T12:00:00Z');
  const storage = new LocalStorage('/tmp/unused', 'test-secret', 'http://api.test', clock);
  const opts = { contentType: 'image/webp', filename: null };

  afterEach(() => clock.set('2020-01-01T12:00:00Z'));

  it('accepts a windowed link while the app clock is inside its window, whatever the real date', async () => {
    const { url, expiresAt } = await storage.presignGet('avatars/u/f', { ...opts, window: linkWindow(clock.now()) });
    expect(expiresAt).toBe('2020-01-01T12:05:00.000Z');
    const { key, query } = parse(url);
    expect(storage.verify(key, query)).toMatchObject({ op: 'get' });
  });

  it('refuses it once the app clock passes its expiry', async () => {
    const { url } = await storage.presignGet('avatars/u/f', { ...opts, window: linkWindow(clock.now()) });
    clock.set('2020-01-01T12:05:01Z');
    const { key, query } = parse(url);
    expect(storage.verify(key, query)).toBeNull();
  });

  it('times plain links and uploads from the app clock too', async () => {
    const get = await storage.presignGet('receipts/r/f', opts);
    expect(get.expiresAt).toBe('2020-01-01T12:05:00.000Z');
    const put = await storage.presignPut({
      key: 'receipts/r/f',
      contentType: 'image/webp',
      sizeBytes: 3,
      sha256Hex: 'ab',
    });
    const { key, query } = parse(put.url);
    expect(storage.verify(key, query)).toMatchObject({ op: 'put' });
    clock.set('2020-01-01T12:10:01Z');
    expect(storage.verify(key, query)).toBeNull();
  });

  it('refuses a link whose signature was tampered with', async () => {
    const { url } = await storage.presignGet('avatars/u/f', opts);
    const { key, query } = parse(url);
    expect(storage.verify(key, { ...query, exp: String(Number(query.exp) + 3600) })).toBeNull();
    expect(storage.verify('avatars/u/other', query)).toBeNull();
  });
});
