import { Inject, Injectable, Logger } from '@nestjs/common';
import { NOTIFICATION_CATALOGUE, type MarkNotificationsRead, type NotificationKind } from '@truhost/shared';
import type { Actor } from '../auth/actor.js';
import { ENV, type Env } from '../config/env.js';
import { EMAIL_SENDER, type EmailMessage, type EmailSender } from '../email/email-sender.js';
import { cleanCompletedEmail, damageReportEmail, supplyAlertEmail, timeOffRequestedEmail } from '../email/templates.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

/** An email decided inside a transaction and sent after it commits. */
export interface PendingEmail {
  notificationId: string | null;
  message: EmailMessage;
}

type Category = (typeof NOTIFICATION_CATALOGUE)[number]['category'];
const defaultsFor = (category: Category) => NOTIFICATION_CATALOGUE.find((c) => c.category === category)!.defaults;

/** One event to tell people about: at a property (its owners and the admins), or for the admins alone. */
interface Event {
  category: Category;
  kind: NotificationKind;
  /** Null: the admins alone hear about it (nothing goes to owners). */
  property: { id: string; name: string } | null;
  /** What the notification links to (e.g. SupplyItem + id), and the row that caused it (one per person). */
  entityType: string;
  entityId: string;
  sourceId: string;
  title: string;
  body: string;
  /** Who caused it, if a person: they aren't told about their own action. */
  actorId?: string;
  /** `admin`: the recipient is staff (their link opens the admin pages; owners' open the owner portal). */
  email: (to: { email: string; firstName: string; admin: boolean }) => EmailMessage;
}

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
  supplyAlert(
    tx: Tx,
    event: {
      kind: 'SUPPLY_LOW' | 'SUPPLY_OUT';
      property: { id: string; name: string };
      item: { id: string; name: string; thresholdPct: number };
      reading: { id: string; levelPct: number };
    },
  ): Promise<PendingEmail[]> {
    const out = event.kind === 'SUPPLY_OUT';
    return this.notify(tx, {
      category: 'SUPPLY_ALERTS',
      kind: event.kind,
      property: event.property,
      entityType: 'SupplyItem',
      entityId: event.item.id,
      sourceId: event.reading.id,
      title: out ? `${event.item.name} has run out` : `${event.item.name} is running low`,
      body: out
        ? `${event.property.name} · marked empty`
        : `${event.property.name} · ${event.reading.levelPct}% left (restocked at ${event.item.thresholdPct}%)`,
      email: (to) =>
        supplyAlertEmail(to, {
          out,
          item: event.item.name,
          property: event.property.name,
          levelPct: event.reading.levelPct,
          thresholdPct: event.item.thresholdPct,
          // Admins: the property's page (supplies are managed there); owners: their home's Supplies card.
          url: to.admin ? `${this.env.WEB_URL}/admin/properties/${event.property.id}` : `${this.env.WEB_URL}/owner`,
        }),
    });
  }

  /**
   * Damage was reported (a report was sent): tell the active admins and the property's active owners, except whoever
   * reported it. Returns the emails to send after commit.
   */
  damageReported(
    tx: Tx,
    event: {
      property: { id: string; name: string };
      report: { id: string; title: string; severity: string; discoveredOn: string; photoCount: number };
      reporter: { id: string; firstName: string; lastName: string };
    },
  ): Promise<PendingEmail[]> {
    const severity = event.report.severity.charAt(0) + event.report.severity.slice(1).toLowerCase();
    const reporter = `${event.reporter.firstName} ${event.reporter.lastName}`.trim();
    return this.notify(tx, {
      category: 'DAMAGE_REPORTS',
      kind: 'DAMAGE_REPORTED',
      property: event.property,
      entityType: 'DamageReport',
      entityId: event.report.id,
      sourceId: event.report.id,
      actorId: event.reporter.id,
      title: `Damage reported: ${event.report.title}`,
      body: `${event.property.name} · ${severity} · by ${reporter}`,
      email: (to) =>
        damageReportEmail(to, {
          title: event.report.title,
          property: event.property.name,
          severity,
          reporter,
          discoveredOn: event.report.discoveredOn,
          photoCount: event.report.photoCount,
          url: to.admin ? `${this.env.WEB_URL}/admin/damage` : `${this.env.WEB_URL}/owner/damage`,
        }),
    });
  }

  /**
   * A cleaner finished a clean (every step of its checklist done): the place is ready. Tell the active admins and the
   * property's active owners, except whoever finished it. Returns the emails to send after commit.
   */
  cleanCompleted(
    tx: Tx,
    event: {
      property: { id: string; name: string };
      clean: { id: string; rooms: number; damageReports: number; restock: number };
      cleaner: { id: string; firstName: string; lastName: string };
    },
  ): Promise<PendingEmail[]> {
    const cleaner = `${event.cleaner.firstName} ${event.cleaner.lastName}`.trim();
    const { rooms, damageReports, restock } = event.clean;
    const notes = [
      `${rooms} room${rooms === 1 ? '' : 's'} photographed before and after`,
      damageReports ? `${damageReports} damage report${damageReports === 1 ? '' : 's'}` : 'no damage',
      restock ? `${restock} item${restock === 1 ? '' : 's'} to restock` : 'supplies counted',
    ];
    return this.notify(tx, {
      category: 'CLEAN_COMPLETED',
      kind: 'CLEAN_COMPLETED',
      property: event.property,
      entityType: 'Clean',
      entityId: event.clean.id,
      sourceId: event.clean.id,
      actorId: event.cleaner.id,
      title: `${event.property.name} is ready for guests`,
      body: `Cleaned by ${cleaner} · ${notes.join(' · ')}`,
      email: (to) =>
        cleanCompletedEmail(to, {
          property: event.property.name,
          cleaner,
          notes,
          url: to.admin ? `${this.env.WEB_URL}/admin/properties/${event.property.id}` : `${this.env.WEB_URL}/owner`,
        }),
    });
  }

  /**
   * A cleaner asked for time off: tell the active admins (never owners). Returns the emails to send after commit.
   */
  timeOffRequested(
    tx: Tx,
    event: {
      request: { id: string; startDate: string; endDate: string; days: number; reason: string; note: string | null };
      cleaner: { id: string; firstName: string; lastName: string };
      dates: string;
    },
  ): Promise<PendingEmail[]> {
    const cleaner = `${event.cleaner.firstName} ${event.cleaner.lastName}`.trim();
    const days = `${event.request.days} day${event.request.days === 1 ? '' : 's'}`;
    return this.notify(tx, {
      category: 'TIME_OFF_REQUESTS',
      kind: 'TIME_OFF_REQUESTED',
      property: null,
      entityType: 'TimeOffRequest',
      entityId: event.request.id,
      sourceId: event.request.id,
      actorId: event.cleaner.id,
      title: `${cleaner} asked for time off`,
      body: `${event.dates} · ${days} · ${event.request.reason}`,
      email: (to) =>
        timeOffRequestedEmail(to, {
          cleaner,
          dates: event.dates,
          days,
          reason: event.request.reason,
          note: event.request.note,
          url: `${this.env.WEB_URL}/admin/time-off`,
        }),
    });
  }

  /** Sends emails decided in a committed transaction. A failure is logged and never undoes the event. */
  async sendAfterCommit(pending: PendingEmail[]): Promise<void> {
    for (const p of pending) {
      try {
        await this.email.send(p.message);
        if (p.notificationId) {
          await this.prisma.notification.update({ where: { id: p.notificationId }, data: { emailSentAt: new Date() } });
        }
      } catch (e) {
        this.logger.warn(`Notification email to ${p.message.to} failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  /**
   * The active admins and (for an event at a property) its active owners, each once, per their choices for the
   * category.
   */
  private async notify(tx: Tx, event: Event): Promise<PendingEmail[]> {
    const recipients = await tx.user.findMany({
      where: {
        status: 'ACTIVE',
        ...(event.actorId ? { id: { not: event.actorId } } : {}),
        OR: [
          { staffRole: 'ADMIN' },
          ...(event.property
            ? [{ memberships: { some: { propertyId: event.property.id, role: 'OWNER' as const, revokedAt: null } } }]
            : []),
        ],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        staffRole: true,
        notificationSettings: { where: { category: event.category }, select: { email: true, inApp: true } },
      },
    });
    const defaults = defaultsFor(event.category);
    const pending: PendingEmail[] = [];
    for (const user of recipients) {
      const choice = user.notificationSettings[0] ?? defaults;
      let notificationId: string | null = null;
      if (choice.inApp) {
        const row = await tx.notification.create({
          data: {
            userId: user.id,
            kind: event.kind,
            propertyId: event.property?.id ?? null,
            entityType: event.entityType,
            entityId: event.entityId,
            sourceId: event.sourceId,
            title: event.title,
            body: event.body,
          },
        });
        notificationId = row.id;
      }
      if (choice.email) {
        pending.push({
          notificationId,
          message: event.email({ email: user.email, firstName: user.firstName, admin: user.staffRole === 'ADMIN' }),
        });
      }
    }
    return pending;
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
