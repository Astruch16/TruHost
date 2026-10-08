import { unwrap, type ApiClient } from '@truhost/api-client';
import { UploadError, uploadBytes } from './upload';

/**
 * Property cover photos are resized and re-encoded as JPEG in the browser, so storage holds two small files (a large
 * one for the property page, a card-sized one for lists) instead of a 10 MB original, and a page of many properties
 * downloads only card-sized images.
 */
export const PHOTO_INPUT_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
export const MAX_PHOTO_INPUT_BYTES = 40 * 1024 * 1024;
/** Long edge of each rendition, in pixels. Cards are at most ~300px wide, so 640 covers 2x screens. */
export const LARGE_EDGE = 1600;
export const CARD_EDGE = 640;
/** Must match MAX_PROPERTY_PHOTO_BYTES in @truhost/shared. */
const MAX_RENDITION_BYTES = 5 * 1024 * 1024;

/** Scales width × height so the long edge is at most `max`, never enlarging. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function decode(file: File): Promise<ImageBitmap> {
  if (file.size > MAX_PHOTO_INPUT_BYTES) throw new UploadError('Photos can be at most 40 MB.');
  try {
    // Applies the camera's EXIF rotation, so portrait phone photos stay upright.
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new UploadError('This photo couldn’t be read. Use a JPEG, PNG or WebP image.');
  }
}

async function renderJpeg(image: ImageBitmap, maxEdge: number): Promise<ArrayBuffer> {
  const { width, height } = fitWithin(image.width, image.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new UploadError('This browser can’t prepare photos. Try another browser.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);
  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) break;
    if (blob.size <= MAX_RENDITION_BYTES) return blob.arrayBuffer();
  }
  throw new UploadError('This photo couldn’t be made small enough. Try a different photo.');
}

/** Decodes a photo and renders the two JPEG renditions (large and card), resized and size-checked. */
export async function renderRenditions(file: File): Promise<{ large: ArrayBuffer; card: ArrayBuffer }> {
  const image = await decode(file);
  try {
    return { large: await renderJpeg(image, LARGE_EDGE), card: await renderJpeg(image, CARD_EDGE) };
  } finally {
    image.close();
  }
}

/** Prepares both renditions, uploads them and makes them the property's cover. Returns the updated property. */
export async function uploadCoverPhoto(api: ApiClient, propertyId: string, file: File) {
  const { large, card } = await renderRenditions(file);
  const declare = { purpose: 'PROPERTY_PHOTO', propertyId, contentType: 'image/jpeg', filename: null } as const;
  const [fileId, thumbFileId] = await Promise.all([uploadBytes(api, declare, large), uploadBytes(api, declare, card)]);
  return unwrap(
    api.PUT('/v1/properties/{id}/cover-photo', {
      params: { path: { id: propertyId } },
      body: { fileId, thumbFileId },
    }),
  );
}
