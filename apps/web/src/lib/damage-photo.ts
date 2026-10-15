import { unwrap, type ApiClient } from '@truhost/api-client';
import { MAX_DAMAGE_PHOTO_BYTES } from '@truhost/shared';
import { decode, renderJpeg } from './property-photo';
import { uploadBytes } from './upload';

/** For the file picker: phone cameras and photo libraries. */
export const DAMAGE_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
/** The evidence copy: big enough to show detail in a claim. */
export const EVIDENCE_EDGE = 2400;
export const THUMB_EDGE = 480;

/** Decodes a photo and renders the evidence copy and a thumbnail as JPEGs. */
export async function renderDamagePhoto(file: File): Promise<{ large: ArrayBuffer; thumb: ArrayBuffer }> {
  const image = await decode(file);
  try {
    return {
      large: await renderJpeg(image, EVIDENCE_EDGE, MAX_DAMAGE_PHOTO_BYTES),
      thumb: await renderJpeg(image, THUMB_EDGE),
    };
  } finally {
    image.close();
  }
}

/** Prepares, uploads and attaches one photo to a damage report. Returns the report as it now stands. */
export async function addDamagePhoto(api: ApiClient, report: { id: string; propertyId: string }, file: File) {
  const { large, thumb } = await renderDamagePhoto(file);
  const declare = {
    purpose: 'DAMAGE_PHOTO',
    propertyId: report.propertyId,
    contentType: 'image/jpeg',
    filename: file.name || null,
  } as const;
  const [fileId, thumbFileId] = await Promise.all([uploadBytes(api, declare, large), uploadBytes(api, declare, thumb)]);
  return unwrap(
    api.POST('/v1/damage-reports/{id}/photos', { params: { path: { id: report.id } }, body: { fileId, thumbFileId } }),
  );
}
