import { Inject, Injectable, Logger } from '@nestjs/common';
import { NOTIFICATION_CATALOGUE, type MarkNotificationsRead } from '@truhost/shared';
import type { Actor } from '../auth/actor.js';
import { ENV, type Env } from '../config/env.js';
import { EMAIL_SENDER, type EmailSender } from '../email/email-sender.js';
import { supplyAlertEmail } from '../email/templates.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

/** An email decided inside a transaction and sent after it commits. */
export interface PendingEmail {
  notificationId: string | null;
  to: { email: string; firstName: string };
  alert: Parameters<typeof supplyAlertEmail>[1];
}

const SUPPLY_DEFAULTS = NOTIFICATION_CATALOGUE.find((c) => c.category === 'SUPPLY_ALERTS')!.defaults;

/**
 * Notifications: who hears about an event, written in the event's transaction (in-app) and emailed after it commits.
 * Each person's Settings → Notifications choices decide in-app and email (defaults from NOTIFICATION_CATALOGUE).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * A supply reached its restock point or ran out: tell the active admins and the property's active owners (each
   * once). Returns the emails to send after commit.
   */
  async supplyAlert(
    tx: Tx,
    event: {
      kind: 'SUPPLY_LOW' | 'SUPPLY_OUT';
      property: { id: string; name: string };
      item: { id: string; name: string; thresholdPct: number };
      reading: { id: string; levelPct: number };
    },
  ): Promise<PendingEmail[]> {
    const recipients = await tx.user.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { staffRole: 'ADMIN' },
          { memberships: { some: { propertyId: event.property.id, role: 'OWNER', revokedAt: null } } },
        ],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        notificationSettings: { where: { category: 'SUPPLY_ALERTS' }, select: { email: true, inApp: true } },
      },
    });
    const out = event.kind === 'SUPPLY_OUT';
    const title = out ? `${event.item.name} has run out` : `${event.item.name} is running low`;
    const body = out
      ? `${event.property.name} · marked empty`
      : `${event.property.name} · ${event.reading.levelPct}% left (restocked at ${event.item.thresholdPct}%)`;
    const pending: PendingEmail[] = [];
    for (const user of recipients) {
      const choice = user.notificationSettings[0] ?? SUPPLY_DEFAULTS;
      let notificationId: string | null = null;
      if (choice.inApp) {
        const row = await tx.notification.create({
          data: {
            userId: user.id,
            kind: event.kind,
            propertyId: event.property.id,
            entityType: 'SupplyItem',
            entityId: event.item.id,
            sourceId: event.reading.id,
            title,
            body,
          },
        });
        notificationId = row.id;
      }
      if (choice.email) {
        pending.push({
          notificationId,
          to: { email: user.email, firstName: user.firstName },
          alert: {
            out,
            item: event.item.name,
            property: event.property.name,
            levelPct: event.reading.levelPct,
            thresholdPct: event.item.thresholdPct,
            url: `${this.env.WEB_URL}/properties/${event.property.id}`,
          },
        });
      }
    }
    return pending;
  }

  /** Sends emails decided in a committed transaction. A failure is logged and never undoes the event. */
  async sendAfterCommit(pending: PendingEmail[]): Promise<void> {
    for (const p of pending) {
      try {
        await this.email.send(supplyAlertEmail(p.to, p.alert));
        if (p.notificationId) {
          await this.prisma.notification.update({ where: { id: p.notificationId }, data: { emailSentAt: new Date() } });
        }
      } catch (e) {
        this.logger.warn(`Supply alert email to ${p.to.email} failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  /** The caller's own notifications, newest first (at most 50), and how many are unread. */
  async list(actor: Actor, unreadOnly: boolean) {
    const where = { userId: actor.userId, ...(unreadOnly ? { readAt: null } : {}) };
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { property: { select: { id: true, name: true } } },
      }),
      this.prisma.notification.count({ where: { userId: actor.userId, readAt: null } }),
    ]);
    return {
      items: rows.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        property: n.property,
        entityType: n.entityType,
        entityId: n.entityId,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      unread,
    };
  }

  /** Marks the caller's own notifications read (others' ids are ignored). */
  async markRead(actor: Actor, input: MarkNotificationsRead) {
    await this.prisma.notification.updateMany({
      where: { userId: actor.userId, readAt: null, ...('ids' in input ? { id: { in: input.ids } } : {}) },
      data: { readAt: new Date() },
    });
    return this.list(actor, false);
  }
}
