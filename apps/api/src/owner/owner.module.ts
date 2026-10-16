import { Module } from '@nestjs/common';
import { ReportingModule } from '../reporting/reporting.module.js';
import { OwnerController } from './owner.controller.js';
import { OwnerService } from './owner.service.js';

@Module({ imports: [ReportingModule], controllers: [OwnerController], providers: [OwnerService] })
export class OwnerModule {}
