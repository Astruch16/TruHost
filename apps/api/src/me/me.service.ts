import { Injectable } from '@nestjs/common';
import {
  NOTIFICATION_CATALOGUE,
  type Me,
  type NotificationRole,
  type NotificationSettings,
  type SetAvatar,
  type UpdateMe,
  type UpdateNotificationSettings,
} from '@truhost/shared';
import type { Actor } from '../auth/actor.js';
import { unprocessable } from '../common/problem.js';
import { FilesService } from '../files/files.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async get(actor: Actor): Promise<Me> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
      include: {
        memberships: {
          where: { revokedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, property: { select: { id: true, name: true } } },
        },
        avatarFile: { select: { objectKey: true, contentType: true } },
      },
    });
    const { avatarFile, weekStartsOn, ...rest } = user;
    return {
      ...rest,
      weekStartsOn: weekStartsOn === 1 ? 1 : 0,
      avatar: avatarFile ? await this.files.avatarLink(avatarFile) : null,
    };
  }

  async update(actor: Actor, input: UpdateMe): Promise<Me> {
    await this.prisma.user.update({ where: { id: actor.userId }, data: input });
    return this.get(actor);
  }

  /**
   * Makes a fresh AVATAR upload the caller's profile photo. The previous one (row and stored object) is deleted, so
   * each user keeps exactly one small image.
   */
  async setAvatar(actor: Actor, input: SetAvatar): Promise<Me> {
    const old = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actor.userId}::uuid FOR UPDATE`;
      const before = await tx.user.findUniqueOrThrow({
        where: { id: actor.userId },
        select: { avatarFile: { select: { id: true, objectKey: true } } },
      });
      if (before.avatarFile?.id === input.fileId) {
        throw unprocessable('FILE_ALREADY_USED', 'This upload is already your photo');
      }
      await this.files.verifyForAttach(tx, actor, input.fileId, { propertyId: null, purpose: 'AVATAR' });
      await tx.user.update({ where: { id: actor.userId }, data: { avatarFileId: input.fileId } });
      if (before.avatarFile) await tx.storedFile.delete({ where: { id: before.avatarFile.id } });
      return before.avatarFile;
    });
    if (old) await this.files.deleteObjects([old.objectKey]);
    return this.get(actor);
  }

  /** Removes the caller's profile photo, row and object. */
  async removeAvatar(actor: Actor): Promise<Me> {
    const old = await this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findUniqueOrThrow({
        where: { id: actor.userId },
        select: { avatarFile: { select: { id: true, objectKey: true } } },
      });
      if (!before.avatarFile) return null;
      await tx.user.update({ where: { id: actor.userId }, data: { avatarFileId: null } });
      await tx.storedFile.delete({ where: { id: before.avatarFile.id } });
      return before.avatarFile;
    });
    if (old) await this.files.deleteObjects([old.objectKey]);
    return this.get(actor);
  }

  /** The caller's notification choices, for the categories that apply to their roles (defaults filled in). */
  async notificationSettings(actor: Actor): Promise<NotificationSettings> {
    const applicable = await this.applicableCategories(actor);
    const saved = await this.prisma.notificationSetting.findMany({ where: { userId: actor.userId } });
    return {
      items: applicable.map((c) => {
        const row = saved.find((s) => s.category === c.category);
        return {
          category: c.category,
          email: c.channels.includes('email') ? (row?.email ?? c.defaults.email) : false,
          inApp: c.channels.includes('inApp') ? (row?.inApp ?? c.defaults.inApp) : false,
        };
      }),
    };
  }

  async updateNotificationSettings(actor: Actor, input: UpdateNotificationSettings): Promise<NotificationSettings> {
    const applicable = await this.applicableCategories(actor);
    for (const item of input.items) {
      const entry = applicable.find((c) => c.category === item.category);
      if (!entry) {
        throw unprocessable('NOT_YOUR_NOTIFICATION', `“${item.category}” isn’t a notification for your role`);
      }
      if ((item.email && !entry.channels.includes('email')) || (item.inApp && !entry.channels.includes('inApp'))) {
        throw unprocessable('CHANNEL_NOT_AVAILABLE', `“${entry.label}” can’t be sent that way`);
      }
    }
    await this.prisma.$transaction(
      input.items.map((item) =>
        this.prisma.notificationSetting.upsert({
          where: { userId_category: { userId: actor.userId, category: item.category } },
          create: { userId: actor.userId, ...item },
          update: { email: item.email, inApp: item.inApp },
        }),
      ),
    );
    return this.notificationSettings(actor);
  }

  private async applicableCategories(actor: Actor) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: { staffRole: true, memberships: { where: { revokedAt: null }, select: { role: true } } },
    });
    const roles = new Set<NotificationRole>(user.memberships.map((m) => m.role));
    if (user.staffRole === 'ADMIN') roles.add('ADMIN');
    return NOTIFICATION_CATALOGUE.filter((c) => c.roles.some((r) => roles.has(r)));
  }
}
