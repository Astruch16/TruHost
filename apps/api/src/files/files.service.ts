import { Inject, Injectable, Logger } from '@nestjs/common';
import type { createUpload } from '@truhost/shared';
import type { z } from 'zod';
import { AccessService } from '../access/access.service.js';
import type { Actor } from '../auth/actor.js';
import { notFound, unprocessable } from '../common/problem.js';
import { uuidv7 } from '../common/uuid.js';
import type { FilePurpose, StoredFile } from '../generated/prisma/client.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { FILE_STORAGE, type FileStorage } from './storage.js';

type UploadInput = z.output<typeof createUpload>;

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  /** Records a PENDING file and returns a signed PUT for exactly the declared bytes. */
  async createUpload(actor: Actor, input: UploadInput) {
    this.access.assert(actor, 'receipt:write', input.propertyId, 'Property');
    if (!(await this.prisma.property.count({ where: { id: input.propertyId } }))) throw notFound('Property');

    const id = uuidv7();
    const file = await this.prisma.storedFile.create({
      data: {
        id,
        purpose: input.purpose,
        propertyId: input.propertyId,
        objectKey: `properties/${input.propertyId}/${input.purpose.toLowerCase()}/${id}`,
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
  async verifyForAttach(tx: Tx, actor: Actor, fileId: string, expect: { propertyId: string; purpose: FilePurpose }) {
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

  /** Short-lived viewing link. Access is decided by what the file is attached to. */
  async viewUrl(actor: Actor, fileId: string) {
    const file = await this.prisma.storedFile.findUnique({
      where: { id: fileId },
      include: { receipt: { include: { expense: { select: { bearer: true, voidedAt: true } } } } },
    });
    if (!file || !this.canView(actor, file)) throw notFound('File');
    if (file.status !== 'VERIFIED' && file.uploadedById !== actor.userId) throw notFound('File');
    return this.storage.presignGet(file.objectKey, { contentType: file.contentType, filename: file.originalFilename });
  }

  private canView(
    actor: Actor,
    file: StoredFile & {
      receipt: { voidedAt: Date | null; expense: { bearer: string; voidedAt: Date | null } | null } | null;
    },
  ): boolean {
    // Unattached uploads are visible only to whoever uploaded them.
    if (!file.receipt) return file.uploadedById === actor.userId;
    if (this.access.can(actor, 'expense:readAdminFields', file.propertyId)) return true;
    if (!this.access.can(actor, 'receipt:read', file.propertyId)) return false;
    // Owners: only active receipts on active owner-borne expenses.
    const r = file.receipt;
    return !r.voidedAt && !!r.expense && r.expense.bearer === 'OWNER' && !r.expense.voidedAt;
  }
}
