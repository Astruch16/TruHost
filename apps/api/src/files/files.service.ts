import { Inject, Injectable, Logger } from '@nestjs/common';
import type { createUpload } from '@truhost/shared';
import type { z } from 'zod';
import { AccessService } from '../access/access.service.js';
import type { Action } from '../access/policy.js';
import type { Actor } from '../auth/actor.js';
import { CLOCK, type Clock } from '../common/clock.js';
import { notFound, unprocessable } from '../common/problem.js';
import { uuidv7 } from '../common/uuid.js';
import type { FilePurpose, StoredFile } from '../generated/prisma/client.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { FILE_STORAGE, linkWindow, type FileStorage } from './storage.js';

type UploadInput = z.output<typeof createUpload>;

/** Who may upload a file of each purpose (and so to which properties). */
const UPLOAD_ACTION: Record<Exclude<UploadInput['purpose'], 'AVATAR'>, Action> = {
  RECEIPT: 'receipt:write',
  PROPERTY_PHOTO: 'property:write',
};

type FileRef = { objectKey: string; contentType: string };

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Records a PENDING file and returns a signed PUT for exactly the declared bytes. */
  async createUpload(actor: Actor, input: UploadInput) {
    // Avatars belong to the signed-in user (anyone may upload their own); everything else to a property.
    const propertyId = input.purpose === 'AVATAR' ? null : input.propertyId;
    if (input.purpose !== 'AVATAR') {
      this.access.assert(actor, UPLOAD_ACTION[input.purpose], input.propertyId, 'Property');
      if (!(await this.prisma.property.count({ where: { id: input.propertyId } }))) throw notFound('Property');
    }

    const id = uuidv7();
    const file = await this.prisma.storedFile.create({
      data: {
        id,
        purpose: input.purpose,
        propertyId,
        objectKey: propertyId
          ? `properties/${propertyId}/${input.purpose.toLowerCase()}/${id}`
          : `users/${actor.userId}/avatar/${id}`,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        sha256: input.sha256,
        uploadedById: actor.userId,
        originalFilename: input.filename,
      },
    });

    const upload = await this.storage.presignPut({
      key: file.objectKey,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      sha256Hex: file.sha256,
    });
    return { fileId: file.id, upload };
  }

  /**
   * Confirms a PENDING upload is in storage exactly as declared and marks it VERIFIED. Called inside the
   * transaction that attaches the file to its domain row, so a file is never verified without an owner.
   */
  async verifyForAttach(
    tx: Tx,
    actor: Actor,
    fileId: string,
    expect: { propertyId: string | null; purpose: FilePurpose },
  ) {
    const file = await tx.storedFile.findUnique({ where: { id: fileId } });
    if (!file || file.uploadedById !== actor.userId) throw unprocessable('UNKNOWN_FILE', 'Upload not found');
    if (file.propertyId !== expect.propertyId || file.purpose !== expect.purpose) {
      throw unprocessable('FILE_MISMATCH', 'This upload belongs to a different property or purpose');
    }
    if (file.status !== 'PENDING') throw unprocessable('FILE_ALREADY_USED', 'This upload is already attached');

    const info = await this.storage.head(file.objectKey);
    if (!info) throw unprocessable('UPLOAD_MISSING', 'The file has not finished uploading');
    const mismatch =
      info.sizeBytes !== file.sizeBytes ||
      (info.sha256Hex !== null && info.sha256Hex !== file.sha256) ||
      (info.contentType !== null && info.contentType !== file.contentType);
    if (mismatch) {
      this.logger.warn(`Stored object for file ${file.id} does not match its declaration`);
      throw unprocessable('UPLOAD_MISMATCH', 'The uploaded file does not match what was declared');
    }
    return tx.storedFile.update({ where: { id: file.id }, data: { status: 'VERIFIED', verifiedAt: new Date() } });
  }

  /**
   * Links to a property photo, for anyone who may read the property (the caller has already checked that). Signed
   * per window, so a list of many properties costs no extra requests and the browser can cache the images.
   */
  async photoLinks(photo: { id: string; file: FileRef; thumbFile: FileRef }) {
    const window = linkWindow(this.clock.now());
    const sign = (f: FileRef) =>
      this.storage.presignGet(f.objectKey, { contentType: f.contentType, filename: null, window });
    const [large, thumb] = await Promise.all([sign(photo.file), sign(photo.thumbFile)]);
    return { id: photo.id, url: large.url, thumbUrl: thumb.url, expiresAt: large.expiresAt };
  }

  /**
   * Removes objects from storage after their rows are gone (a deleted property). Best effort: a failure is logged
   * and the rest carry on, since the rows (the source of truth) are already deleted and nothing can reach them.
   */
  async deleteObjects(keys: string[]) {
    const results = await Promise.allSettled(keys.map((key) => this.storage.delete(key)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) this.logger.error(`Could not delete ${failed} of ${keys.length} stored objects; they are orphaned`);
  }

  /** A windowed (cacheable) signed link to a user's avatar; the caller has already decided they may see it. */
  async avatarLink(file: FileRef) {
    const { url, expiresAt } = await this.storage.presignGet(file.objectKey, {
      contentType: file.contentType,
      filename: null,
      window: linkWindow(this.clock.now()),
    });
    return { url, expiresAt };
  }

  /** Short-lived viewing link. Access is decided by what the file is attached to. */
  async viewUrl(actor: Actor, fileId: string) {
    const file = await this.prisma.storedFile.findUnique({
      where: { id: fileId },
      include: {
        receipt: { include: { expense: { select: { bearer: true, voidedAt: true } } } },
        propertyPhoto: { select: { id: true } },
        propertyPhotoThumb: { select: { id: true } },
        avatarOf: { select: { id: true } },
      },
    });
    if (!file || !this.canView(actor, file)) throw notFound('File');
    if (file.status !== 'VERIFIED' && file.uploadedById !== actor.userId) throw notFound('File');
    return this.storage.presignGet(file.objectKey, { contentType: file.contentType, filename: file.originalFilename });
  }

  private canView(
    actor: Actor,
    file: StoredFile & {
      receipt: { voidedAt: Date | null; expense: { bearer: string; voidedAt: Date | null } | null } | null;
      propertyPhoto: { id: string } | null;
      propertyPhotoThumb: { id: string } | null;
      avatarOf: { id: string } | null;
    },
  ): boolean {
    // Avatars: their owner and admins (who see everyone on the team page).
    if (file.purpose === 'AVATAR') return file.uploadedById === actor.userId || this.access.isAdmin(actor);
    if (!file.propertyId) return false;
    // Property photos: anyone who can see the property.
    if (file.propertyPhoto || file.propertyPhotoThumb) return this.access.can(actor, 'property:read', file.propertyId);
    // Unattached uploads are visible only to whoever uploaded them.
    if (!file.receipt) return file.uploadedById === actor.userId;
    if (this.access.can(actor, 'expense:readAdminFields', file.propertyId)) return true;
    if (!this.access.can(actor, 'receipt:read', file.propertyId)) return false;
    // Owners: only active receipts on active owner-borne expenses.
    const r = file.receipt;
    return !r.voidedAt && !!r.expense && r.expense.bearer === 'OWNER' && !r.expense.voidedAt;
  }
}
