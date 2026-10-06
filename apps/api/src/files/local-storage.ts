import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { GET_TTL_SECONDS, PUT_TTL_SECONDS, type FileStorage, type ObjectInfo, type PutTarget } from './storage.js';

interface StoredMeta {
  contentType: string;
  sizeBytes: number;
  sha256Hex: string;
}

/**
 * Disk-backed storage for development and tests, with the same guarantees as R2: links are HMAC-signed and expire,
 * and a PUT is rejected unless type, length and SHA-256 match what was signed. Served by LocalStorageController.
 */
export class LocalStorage implements FileStorage {
  private readonly root: string;

  constructor(
    dir: string,
    private readonly secret: string,
    private readonly publicUrl: string,
  ) {
    this.root = resolve(dir);
  }

  presignPut(o: { key: string; contentType: string; sizeBytes: number; sha256Hex: string }): Promise<PutTarget> {
    const exp = Math.floor(Date.now() / 1000) + PUT_TTL_SECONDS;
    const params = { op: 'put', exp: String(exp), ct: o.contentType, len: String(o.sizeBytes), sha: o.sha256Hex };
    return Promise.resolve({
      url: this.url(o.key, params),
      method: 'PUT',
      headers: { 'Content-Type': o.contentType },
      expiresAt: new Date(exp * 1000).toISOString(),
    });
  }

  async head(key: string): Promise<ObjectInfo | null> {
    const meta = await this.readMeta(key);
    return meta ? { sizeBytes: meta.sizeBytes, contentType: meta.contentType, sha256Hex: meta.sha256Hex } : null;
  }

  presignGet(key: string, o: { contentType: string; filename: string | null }) {
    const exp = Math.floor(Date.now() / 1000) + GET_TTL_SECONDS;
    const url = this.url(key, { op: 'get', exp: String(exp), name: o.filename ?? '' });
    return Promise.resolve({ url, expiresAt: new Date(exp * 1000).toISOString() });
  }

  // ── used by LocalStorageController ──

  /** Validates a signed link; returns its parameters or null if forged or expired. */
  verify(key: string, query: Record<string, string | undefined>): Record<string, string> | null {
    const { sig, ...rest } = query;
    if (!sig) return null;
    const params = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as Record<
      string,
      string
    >;
    const expected = this.sign(key, params);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (Number(params.exp) < Math.floor(Date.now() / 1000)) return null;
    return params;
  }

  async write(key: string, body: Buffer, meta: StoredMeta): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    await writeFile(`${path}.meta.json`, JSON.stringify(meta));
  }

  async read(key: string): Promise<{ body: Buffer; meta: StoredMeta } | null> {
    const meta = await this.readMeta(key);
    if (!meta) return null;
    return { body: await readFile(this.pathFor(key)), meta };
  }

  static sha256Hex(body: Buffer): string {
    return createHash('sha256').update(body).digest('hex');
  }

  private async readMeta(key: string): Promise<StoredMeta | null> {
    try {
      return JSON.parse(await readFile(`${this.pathFor(key)}.meta.json`, 'utf8')) as StoredMeta;
    } catch {
      return null;
    }
  }

  private pathFor(key: string): string {
    const path = resolve(join(this.root, key));
    if (!path.startsWith(this.root + '/')) throw new Error('Invalid object key');
    return path;
  }

  private url(key: string, params: Record<string, string>): string {
    const query = new URLSearchParams({ ...params, sig: this.sign(key, params) });
    return `${this.publicUrl}/v1/local-storage/${key}?${query.toString()}`;
  }

  private sign(key: string, params: Record<string, string>): string {
    const canonical = [
      key,
      ...Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`),
    ].join('\n');
    return createHmac('sha256', this.secret).update(canonical).digest('base64url');
  }
}
