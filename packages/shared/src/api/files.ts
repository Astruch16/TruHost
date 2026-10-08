import { z } from 'zod';
import { id, isoDateTime } from '../primitives.js';

export const RECEIPT_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
] as const;
export const MAX_RECEIPT_BYTES = 20 * 1024 * 1024;

/** Property photos are resized and re-encoded as JPEG in the browser before upload (large and card renditions). */
export const PROPERTY_PHOTO_CONTENT_TYPES = ['image/jpeg'] as const;
export const MAX_PROPERTY_PHOTO_BYTES = 5 * 1024 * 1024;

const declared = {
  propertyId: id,
  /** Hex SHA-256 of the file; storage rejects any other body. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/, 'Expected a lowercase hex SHA-256'),
  filename: z.string().trim().min(1).max(200).nullable().default(null),
};

/** Ask for an upload URL. Type and size limits depend on the purpose; clean and damage photos arrive in Phase 3. */
export const createUpload = z.discriminatedUnion('purpose', [
  z.object({
    purpose: z.literal('RECEIPT'),
    contentType: z.enum(RECEIPT_CONTENT_TYPES),
    sizeBytes: z.number().int().min(1).max(MAX_RECEIPT_BYTES),
    ...declared,
  }),
  z.object({
    purpose: z.literal('PROPERTY_PHOTO'),
    contentType: z.enum(PROPERTY_PHOTO_CONTENT_TYPES),
    sizeBytes: z.number().int().min(1).max(MAX_PROPERTY_PHOTO_BYTES),
    ...declared,
  }),
]);
export type CreateUpload = z.input<typeof createUpload>;

export const uploadTarget = z.object({
  fileId: id,
  upload: z.object({
    url: z.string(),
    method: z.literal('PUT'),
    headers: z.record(z.string(), z.string()),
    expiresAt: isoDateTime,
  }),
});
export type UploadTarget = z.infer<typeof uploadTarget>;

export const fileUrl = z.object({ url: z.string(), expiresAt: isoDateTime });
export type FileUrl = z.infer<typeof fileUrl>;
