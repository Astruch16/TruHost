import { unwrap, type ApiClient } from '@truhost/api-client';
import type { PhotoPhase } from '@truhost/shared';
import { renderDamagePhoto } from './damage-photo';
import { uploadBytes } from './upload';

/** For the camera button: phone cameras (and photo libraries, if the phone offers them). */
export const CLEAN_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

/**
 * Prepares, uploads and attaches one room photo to a clean: the same two JPEG renditions as damage photos (the
 * evidence copy and a thumbnail), made in the browser. Returns the clean as it now stands.
 */
export async function addCleanPhoto(
  api: ApiClient,
  clean: { id: string; property: { id: string } },
  roomId: string,
  phase: PhotoPhase,
  file: File,
) {
  const { large, thumb } = await renderDamagePhoto(file);
  const declare = {
    purpose: 'CLEAN_PHOTO',
    propertyId: clean.property.id,
    contentType: 'image/jpeg',
    filename: file.name || null,
  } as const;
  const [fileId, thumbFileId] = await Promise.all([uploadBytes(api, declare, large), uploadBytes(api, declare, thumb)]);
  return unwrap(
    api.POST('/v1/cleans/{id}/photos', {
      params: { path: { id: clean.id } },
      body: { roomId, phase, fileId, thumbFileId },
    }),
  );
}
