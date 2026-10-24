import { Injectable } from '@nestjs/common';
import type { CreateSupplyItem, RecordSupplyLevels, UpdateSupplyItem } from '@truhost/shared';
import { AccessService } from '../access/access.service.js';
import type { Actor } from '../auth/actor.js';
import { conflict, notFound, unprocessable } from '../common/problem.js';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificationsService, type PendingEmail } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { restockUrgency, supplyAlert, supplyState } from './alerts.js';

/** Enough for any rental's consumables; also the most one setup call can add. */
const MAX_ACTIVE_ITEMS = 60;
export const SUPPLY_ORDER = [
  { position: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.SupplyItemOrderByWithRelationInput[];
/** Newest reading first; uuid7 ids break a tie in time. */
const LATEST = [{ reportedAt: 'desc' }, { id: 'desc' }] satisfies Prisma.SupplyStatusOrderByWithRelationInput[];
export const WITH_LATEST = { readings: { orderBy: LATEST, take: 1 } } satisfies Prisma.SupplyItemInclude;

type Tx = Prisma.TransactionClient;
type ItemRow = Prisma.SupplyItemGetPayload<{ include: typeof WITH_LATEST }>;

/**
 * Supplies: the consumables a property keeps stocked (toilet paper, coffee pods…), each with a level from 0 to 100%
 * and a restock point. Levels are an append-only series of readings (the latest is the current level). A reading that
 * takes an item to its restock point, or to empty, notifies the admins and the property's owners
 * (supplyAlert); one that doesn't cross a line sends nothing, so repeating "¼" never re-alerts.
 */
@Injectable()
export class SuppliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(actor: Actor, propertyId: string) {
    this.access.assert(actor, 'supply:read', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    const items = await this.prisma.supplyItem.findMany({
      where: { propertyId, archivedAt: null },
      orderBy: SUPPLY_ORDER,
      include: WITH_LATEST,
    });
    return { items: items.map(toItem) };
  }

  async create(actor: Actor, propertyId: string, input: CreateSupplyItem) {
    const { items, created } = await this.createItems(actor, propertyId, [input]);
    return items.find((i) => i.id === created[0])!;
  }

  /** Setup: several items at once (e.g. the common list), added at the end in the order given. Returns them all. */
  async createMany(actor: Actor, propertyId: string, input: CreateSupplyItem[]) {
    const { items } = await this.createItems(actor, propertyId, input);
    return { items };
  }

  async update(actor: Actor, id: string, input: UpdateSupplyItem) {
    const found = await this.findItem(actor, id, 'supply:write');
    return this.prisma.$transaction(async (tx) => {
      const active = await this.lockItems(tx, found.propertyId);
      if (input.name !== undefined && !found.archivedAt) {
        assertUniqueNames([...active.filter((i) => i.id !== id).map((i) => i.name), input.name]);
      }
      // A new restock point applies to the next reading; changing it never sends an alert by itself.
      const saved = await tx.supplyItem.update({
        where: { id },
        data: { name: input.name, category: input.category, thresholdPct: input.thresholdPct },
        include: WITH_LATEST,
      });
      return toItem(saved);
    });
  }

  /** Stops tracking an item. Its readings stay (they're history). */
  async archive(actor: Actor, id: string) {
    const item = await this.findItem(actor, id, 'supply:write');
    const saved = item.archivedAt
      ? item
      : await this.prisma.supplyItem.update({ where: { id }, data: { archivedAt: new Date() }, include: WITH_LATEST });
    return toItem(saved);
  }

  /**
   * Readings from a walkthrough (or an admin's "Restocked"): one per item, all at this property. Each is compared
   * with the item's previous reading under the property lock, so two people reporting at once can't both (or neither)
   * send the alert. Emails go out after the readings commit. Returns the property's supplies.
   */
  async record(actor: Actor, propertyId: string, input: RecordSupplyLevels) {
    this.access.assert(actor, 'supply:record', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    return this.recordReadings(actor, propertyId, input.readings);
  }

  /**
   * Records one reading per item in one transaction, alerting where one crosses a line. A clean's stock count passes
   * `count`: its readings carry the clean, every active item must be in it (422 STOCK_COUNT_INCOMPLETE), and `before`
   * runs first inside the transaction (the clean's own checks). Callers check access.
   */
  async recordReadings(
    actor: Actor,
    propertyId: string,
    readings: RecordSupplyLevels['readings'],
    count?: { cleanId: string; before: (tx: Tx) => Promise<void> },
  ) {
    const ids = readings.map((r) => r.supplyItemId);
    if (new Set(ids).size !== ids.length) {
      throw unprocessable('DUPLICATE_SUPPLY_ITEM', 'Report each item once.');
    }
    let emails: PendingEmail[] = [];
    const result = await this.prisma.$transaction(async (tx) => {
      await count?.before(tx);
      const active = await this.lockItems(tx, propertyId);
      const byId = new Map(active.map((i) => [i.id, i]));
      const unknown = ids.find((id) => !byId.has(id));
      if (unknown) {
        throw unprocessable('UNKNOWN_SUPPLY_ITEM', 'One of these items isn’t tracked at this property any more.', {
          supplyItemId: unknown,
        });
      }
      if (count) {
        const given = new Set(ids);
        const missing = active.filter((i) => !given.has(i.id)).map((i) => i.id);
        if (missing.length) {
          throw unprocessable('STOCK_COUNT_INCOMPLETE', 'Give a level for every item.', { missing });
        }
      }
      const property = await tx.property.findUniqueOrThrow({
        where: { id: propertyId },
        select: { id: true, name: true },
      });
      for (const r of readings) {
        const item = byId.get(r.supplyItemId)!;
        const reading = await tx.supplyStatus.create({
          data: {
            supplyItemId: item.id,
            levelPct: r.levelPct,
            note: r.note ?? null,
            reportedById: actor.userId,
            cleanId: count?.cleanId ?? null,
          },
        });
        const kind = supplyAlert(item.readings[0]?.levelPct ?? null, r.levelPct, item.thresholdPct);
        if (kind) {
          emails = emails.concat(
            await this.notifications.supplyAlert(tx, {
              kind,
              property,
              item,
              reading: { id: reading.id, levelPct: r.levelPct },
            }),
          );
        }
      }
      const items = await tx.supplyItem.findMany({
        where: { propertyId, archivedAt: null },
        orderBy: SUPPLY_ORDER,
        include: WITH_LATEST,
      });
      return { items: items.map(toItem) };
    });
    await this.notifications.sendAfterCommit(emails);
    return result;
  }

  /** An item's readings, newest first (at most 100). Archived items keep theirs. */
  async history(actor: Actor, id: string) {
    await this.findItem(actor, id, 'supply:history');
    const readings = await this.prisma.supplyStatus.findMany({
      where: { supplyItemId: id },
      orderBy: LATEST,
      take: 100,
      include: { reportedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    return {
      items: readings.map((r) => ({
        id: r.id,
        levelPct: r.levelPct,
        note: r.note,
        reportedBy: r.reportedBy,
        reportedAt: r.reportedAt,
      })),
    };
  }

  /**
   * The restock list across active properties: what needs restocking now (out, then low) and what's close to it
   * (restockUrgency). Within each, the item furthest below (or closest to) its restock point comes first.
   */
  async restock(actor: Actor) {
    this.access.assert(actor, 'supply:restock');
    const items = await this.prisma.supplyItem.findMany({
      where: { archivedAt: null, property: { archivedAt: null } },
      orderBy: SUPPLY_ORDER,
      include: { ...WITH_LATEST, property: { select: { id: true, name: true } } },
    });
    const rank = { OUT: 0, LOW: 1, SOON: 2 } as const;
    return {
      items: items
        .map((i) => {
          const item = toItem(i);
          return { ...item, property: i.property, urgency: restockUrgency(item.levelPct, item.thresholdPct) };
        })
        .filter((i): i is typeof i & { urgency: NonNullable<typeof i.urgency> } => i.urgency !== null)
        .sort(
          (a, b) =>
            rank[a.urgency] - rank[b.urgency] ||
            a.levelPct! - a.thresholdPct - (b.levelPct! - b.thresholdPct) ||
            a.property.name.localeCompare(b.property.name) ||
            a.position - b.position,
        ),
    };
  }

  private async createItems(actor: Actor, propertyId: string, input: CreateSupplyItem[]) {
    this.access.assert(actor, 'supply:write', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    return this.prisma.$transaction(async (tx) => {
      const active = await this.lockItems(tx, propertyId);
      if (active.length + input.length > MAX_ACTIVE_ITEMS) {
        throw unprocessable('TOO_MANY_SUPPLY_ITEMS', `A property can track at most ${MAX_ACTIVE_ITEMS} supplies.`);
      }
      assertUniqueNames([...active.map((i) => i.name), ...input.map((i) => i.name)]);
      const start = active.reduce((max, i) => Math.max(max, i.position), -1) + 1;
      const created: string[] = [];
      for (const [index, i] of input.entries()) {
        const row = await tx.supplyItem.create({
          data: {
            propertyId,
            name: i.name,
            category: i.category,
            thresholdPct: i.thresholdPct,
            position: start + index,
          },
        });
        created.push(row.id);
      }
      const items = await tx.supplyItem.findMany({
        where: { propertyId, archivedAt: null },
        orderBy: SUPPLY_ORDER,
        include: WITH_LATEST,
      });
      return { items: items.map(toItem), created };
    });
  }

  /** Locks the property (so changes and readings queue) and returns its active items with their latest readings. */
  private async lockItems(tx: Tx, propertyId: string): Promise<ItemRow[]> {
    await tx.$queryRaw`SELECT 1 FROM "Property" WHERE id = ${propertyId}::uuid FOR UPDATE`;
    return tx.supplyItem.findMany({
      where: { propertyId, archivedAt: null },
      orderBy: SUPPLY_ORDER,
      include: WITH_LATEST,
    });
  }

  private async findItem(actor: Actor, id: string, action: 'supply:write' | 'supply:history') {
    const item = await this.prisma.supplyItem.findUnique({ where: { id }, include: WITH_LATEST });
    if (!item || !this.access.can(actor, action, item.propertyId)) throw notFound('Supply item');
    return item;
  }

  private async assertPropertyExists(id: string) {
    const exists = await this.prisma.property.count({ where: { id } });
    if (!exists) throw notFound('Property');
  }
}

/** An item with its current level (the latest reading), as the API returns it. */
export function toItem(i: ItemRow) {
  const latest = i.readings[0] ?? null;
  return {
    id: i.id,
    propertyId: i.propertyId,
    name: i.name,
    category: i.category,
    thresholdPct: i.thresholdPct,
    position: i.position,
    levelPct: latest?.levelPct ?? null,
    state: supplyState(latest?.levelPct ?? null, i.thresholdPct),
    lastCheckedAt: latest?.reportedAt ?? null,
    archivedAt: i.archivedAt,
  };
}

/** Names are unique per property among active items, ignoring case (backed by supply_item_name_unique). */
function assertUniqueNames(names: string[]) {
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      throw conflict('SUPPLY_NAME_TAKEN', `“${name}” is already on this property’s supplies list.`, { name });
    }
    seen.add(key);
  }
}
