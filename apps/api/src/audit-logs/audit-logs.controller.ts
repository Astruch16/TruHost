import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { auditLog, auditLogQuery, page, pageQuery, type AuditLogQuery, type PageQuery } from '@truhost/shared';
import { AccessService } from '../access/access.service.js';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { cursorPage } from '../common/pagination.js';
import { ZodPipe, ZodQuery, ZodResponse } from '../common/zod.js';
import { PrismaService } from '../prisma/prisma.service.js';

const query = auditLogQuery.extend(pageQuery.shape);

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(actor: Actor, q: AuditLogQuery & PageQuery) {
    this.access.assert(actor, 'audit:read');
    const p = cursorPage(q, 'desc');
    const rows = await this.prisma.auditLog.findMany({
      ...p.args,
      where: { entityType: q.entityType, entityId: q.entityId, propertyId: q.propertyId, actorId: q.actorId },
    });
    return p.page(rows);
  }
}

@ApiTags('audit')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly logs: AuditLogsService) {}

  @Get()
  @ZodQuery(query)
  @ZodResponse(page(auditLog))
  list(@CurrentActor() actor: Actor, @Query(new ZodPipe(query)) q: AuditLogQuery & PageQuery) {
    return this.logs.list(actor, q);
  }
}
