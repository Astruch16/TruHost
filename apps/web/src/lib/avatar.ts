import { unwrap, type ApiClient } from '@truhost/api-client';
import { UploadError, uploadBytes } from './upload';

/**
 * Profile photos are cropped to a centred square and re-encoded in the browser as one small JPEG (256px, usually
 * 15–40 KB), so storage holds a thumbnail per person rather than a phone photo, and replacing a photo deletes the old
 * one (API).
 */
export const AVATAR_INPUT_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
export const MAX_AVATAR_INPUT_BYTES = 20 * 1024 * 1024;
export const AVATAR_EDGE = 256;
/** Must match MAX_AVATAR_BYTES in @truhost/shared. */
const MAX_AVATAR_BYTES = 1024 * 1024;

/** The largest centred square in a width × height image: its top-left corner and side. */
export function centreSquare(width: number, height: number): { x: number; y: number; side: number } {
  const side = Math.min(width, height);
  return { x: Math.floor((width - side) / 2), y: Math.floor((height - side) / 2), side };
}

/** Decodes a photo and renders the square avatar JPEG. */
export async function renderAvatar(file: File): Promise<ArrayBuffer> {
  if (file.size > MAX_AVATAR_INPUT_BYTES) throw new UploadError('Photos can be at most 20 MB.');
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new UploadError('This photo couldn’t be read. Use a JPEG, PNG or WebP image.');
  }
  try {
    const { x, y, side } = centreSquare(image.width, image.height);
    const edge = Math.min(AVATAR_EDGE, side);
    const canvas = document.createElement('canvas');
    canvas.width = edge;
    canvas.height = edge;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new UploadError('This browser can’t prepare photos. Try another browser.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, x, y, side, side, 0, 0, edge, edge);
    for (const quality of [0.86, 0.7]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= MAX_AVATAR_BYTES) return blob.arrayBuffer();
    }
    throw new UploadError('This photo couldn’t be made small enough. Try a different photo.');
  } finally {
    image.close();
  }
}

/** Prepares, uploads and sets the caller's profile photo. Returns the updated profile. */
export async function uploadAvatar(api: ApiClient, file: File) {
  const bytes = await renderAvatar(file);
  const fileId = await uploadBytes(api, { purpose: 'AVATAR', contentType: 'image/jpeg', filename: null }, bytes);
  return unwrap(api.PUT('/v1/me/avatar', { body: { fileId } }));
}
