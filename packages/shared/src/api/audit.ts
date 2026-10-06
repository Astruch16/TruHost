import { z } from 'zod';
import { ActorType } from '../enums.js';
import { id, isoDateTime } from '../primitives.js';

export const auditLog = z.object({
  id,
  actorType: ActorType,
  actorId: id.nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: id,
  propertyId: id.nullable(),
  before: z.unknown(),
  after: z.unknown(),
  createdAt: isoDateTime,
});
export type AuditLog = z.infer<typeof auditLog>;

export const auditLogQuery = z.object({
  entityType: z.string().max(50).optional(),
  entityId: id.optional(),
  propertyId: id.optional(),
  actorId: id.optional(),
});
export type AuditLogQuery = z.infer<typeof auditLogQuery>;
