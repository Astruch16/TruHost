import { unwrap, type ApiClient } from '@truhost/api-client';
import type { CreateUpload } from '@truhost/shared';

/** Lowercase hex SHA-256 of a file, computed in the browser. Storage refuses any other bytes. */
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'] as const;
/** For a file picker's `accept`: the receipt types above. */
export const RECEIPT_ACCEPT = RECEIPT_TYPES.join(',');
export const MAX_RECEIPT_BYTES = 20 * 1024 * 1024;

/** A failure whose message is written for the user (shown as-is by ErrorAlert). */
export class UploadError extends Error {
  override name = 'UploadError';
}

/** What the client declares before uploading; size and hash are computed from the bytes. */
type Declared<T = CreateUpload> = T extends unknown ? Omit<T, 'sizeBytes' | 'sha256'> : never;

/**
 * Uploads bytes straight to storage: ask the API for a signed PUT (declaring type, size and hash), then PUT the
 * bytes. Returns the file id to attach to its domain row.
 */
export async function uploadBytes(api: ApiClient, declare: Declared, bytes: ArrayBuffer): Promise<string> {
  const target = await unwrap(
    api.POST('/v1/uploads', {
      body: { ...declare, sizeBytes: bytes.byteLength, sha256: await sha256Hex(bytes) } satisfies CreateUpload,
    }),
  );
  const res = await fetch(target.upload.url, { method: 'PUT', headers: target.upload.headers, body: bytes });
  if (!res.ok) throw new UploadError('The upload failed. Please try again.');
  return target.fileId;
}

/** Uploads a receipt file. Returns the file id to attach with POST /receipts. */
export async function uploadReceipt(api: ApiClient, propertyId: string, file: File): Promise<string> {
  const contentType = file.type as (typeof RECEIPT_TYPES)[number];
  if (!RECEIPT_TYPES.includes(contentType)) throw new UploadError('Use a PDF or a photo (JPEG, PNG, WebP or HEIC).');
  if (file.size > MAX_RECEIPT_BYTES) throw new UploadError('Files can be at most 20 MB.');
  return uploadBytes(
    api,
    { purpose: 'RECEIPT', propertyId, contentType, filename: file.name },
    await file.arrayBuffer(),
  );
}

/** Opens a short-lived viewing link for a stored file in a new tab. */
export async function openFile(api: ApiClient, fileId: string): Promise<void> {
  // Open synchronously (popup blockers), then point it at the signed URL once we have it.
  const tab = window.open('', '_blank');
  try {
    const { url } = await unwrap(api.GET('/v1/files/{id}/url', { params: { path: { id: fileId } } }));
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (e) {
    tab?.close();
    throw e;
  }
}
