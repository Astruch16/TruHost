import { unwrap, type ApiClient } from '@truhost/api-client';

/** Lowercase hex SHA-256 of a file, computed in the browser. Storage refuses any other bytes. */
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'] as const;
export const MAX_RECEIPT_BYTES = 20 * 1024 * 1024;

export class UploadError extends Error {}

/**
 * Uploads a receipt file straight to storage: ask the API for a signed PUT (declaring type, size and hash), then
 * PUT the bytes. Returns the file id to attach with POST /receipts.
 */
export async function uploadReceipt(api: ApiClient, propertyId: string, file: File): Promise<string> {
  const contentType = file.type as (typeof RECEIPT_TYPES)[number];
  if (!RECEIPT_TYPES.includes(contentType)) throw new UploadError('Use a PDF or a photo (JPEG, PNG, WebP or HEIC).');
  if (file.size > MAX_RECEIPT_BYTES) throw new UploadError('Files can be at most 20 MB.');

  const bytes = await file.arrayBuffer();
  const target = await unwrap(
    api.POST('/v1/uploads', {
      body: {
        purpose: 'RECEIPT',
        propertyId,
        contentType,
        sizeBytes: file.size,
        sha256: await sha256Hex(bytes),
        filename: file.name,
      },
    }),
  );
  const res = await fetch(target.upload.url, { method: 'PUT', headers: target.upload.headers, body: bytes });
  if (!res.ok) throw new UploadError('The upload failed. Please try again.');
  return target.fileId;
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
