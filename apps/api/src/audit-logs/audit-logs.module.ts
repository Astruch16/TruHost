import { Module } from '@nestjs/common';
import { AuditLogsController, AuditLogsService } from './audit-logs.controller.js';

@Module({ controllers: [AuditLogsController], providers: [AuditLogsService] })
export class AuditLogsModule {}
