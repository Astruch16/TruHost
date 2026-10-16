import { Module } from '@nestjs/common';
import { DamageModule } from '../damage/damage.module.js';
import { ReportingModule } from '../reporting/reporting.module.js';
import { OwnerController } from './owner.controller.js';
import { OwnerService } from './owner.service.js';

@Module({ imports: [ReportingModule, DamageModule], controllers: [OwnerController], providers: [OwnerService] })
export class OwnerModule {}
