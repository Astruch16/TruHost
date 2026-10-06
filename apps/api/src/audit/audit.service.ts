import { Injectable } from '@nestjs/common';
import type { Actor } from '../auth/actor.js';
import type { Tx } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  propertyId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/**
 * Append-only audit trail (CLAUDE.md rule 7). Takes the transaction client so the entry commits
 * or rolls back with the change it describes.
 */
@Injectable()
export class AuditService {
  async record(tx: Tx, actor: Actor, entry: AuditEntry): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorType: 'USER',
        actorId: actor.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        propertyId: entry.propertyId ?? null,
        before: toJson(entry.before),
        after: toJson(entry.after),
        requestId: actor.requestId,
        ipAddress: actor.ip,
      },
    });
  }

  /** Records an update with only the fields that actually changed. Skips no-op updates. */
  async recordUpdate(
    tx: Tx,
    actor: Actor,
    entry: Omit<AuditEntry, 'before' | 'after'>,
    before: object,
    after: object,
  ): Promise<void> {
    const diff = changedFields(before, after);
    if (!diff) return;
    await this.record(tx, actor, { ...entry, ...diff });
  }
}

export function changedFields(
  before: object,
  after: object,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  const prev = before as Record<string, unknown>;
  for (const [key, value] of Object.entries(after)) {
    if (key === 'updatedAt') continue;
    if (JSON.stringify(prev[key]) !== JSON.stringify(value)) {
      b[key] = prev[key] ?? null;
      a[key] = value ?? null;
    }
  }
  return Object.keys(a).length ? { before: b, after: a } : null;
}

function toJson(value: Record<string, unknown> | null | undefined) {
  return value == null ? Prisma.DbNull : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);
}
