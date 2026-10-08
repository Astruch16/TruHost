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
  /**
   * A short-lived GET for viewing. With `window`, the link is signed at the window's start instead of now, so every
   * request in that window gets the identical URL and the browser can cache the image (see `linkWindow`).
   */
  presignGet(
    key: string,
    o: { contentType: string; filename: string | null; window?: LinkWindow },
  ): Promise<{ url: string; expiresAt: string }>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');

export const PUT_TTL_SECONDS = 10 * 60;
export const GET_TTL_SECONDS = 5 * 60;

/** Cacheable links are re-signed every 4 minutes and live 5, so a fresh one always has at least a minute left. */
export const LINK_WINDOW_SECONDS = 4 * 60;
/** How long the browser may keep an image fetched through a windowed link. Objects never change (new photo, new key). */
export const WINDOWED_CACHE_CONTROL = `private, max-age=${LINK_WINDOW_SECONDS}, immutable`;

export interface LinkWindow {
  signedAt: Date;
  expiresAt: Date;
}

/** The signing window containing `now`: links signed at its start expire GET_TTL_SECONDS later (never more). */
export function linkWindow(now: Date): LinkWindow {
  const start = Math.floor(now.getTime() / 1000 / LINK_WINDOW_SECONDS) * LINK_WINDOW_SECONDS;
  return { signedAt: new Date(start * 1000), expiresAt: new Date((start + GET_TTL_SECONDS) * 1000) };
}

export const hexToBase64 = (hex: string) => Buffer.from(hex, 'hex').toString('base64');
export const base64ToHex = (b64: string) => Buffer.from(b64, 'base64').toString('hex');

/** Safe `Content-Disposition` for viewing in the browser. */
export function inlineDisposition(filename: string | null): string {
  if (!filename) return 'inline';
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
