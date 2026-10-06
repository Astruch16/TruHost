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
