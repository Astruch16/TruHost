/** Where uploaded files live. R2 in deployed environments; local disk for development and tests. */
export interface PutTarget {
  url: string;
  method: 'PUT';
  /** Headers the client must send with the PUT (they are part of the signature). */
  headers: Record<string, string>;
  expiresAt: string;
}

export interface ObjectInfo {
  sizeBytes: number;
  contentType: string | null;
  /** Hex SHA-256 as recorded by the store, or null if it didn't record one. */
  sha256Hex: string | null;
}

export interface FileStorage {
  /** A short-lived PUT that only accepts exactly this type, length and SHA-256. */
  presignPut(o: { key: string; contentType: string; sizeBytes: number; sha256Hex: string }): Promise<PutTarget>;
  head(key: string): Promise<ObjectInfo | null>;
  /** A short-lived GET for viewing. */
  presignGet(
    key: string,
    o: { contentType: string; filename: string | null },
  ): Promise<{ url: string; expiresAt: string }>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');

export const PUT_TTL_SECONDS = 10 * 60;
export const GET_TTL_SECONDS = 5 * 60;

export const hexToBase64 = (hex: string) => Buffer.from(hex, 'hex').toString('base64');
export const base64ToHex = (b64: string) => Buffer.from(b64, 'base64').toString('hex');

/** Safe `Content-Disposition` for viewing in the browser. */
export function inlineDisposition(filename: string | null): string {
  if (!filename) return 'inline';
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
