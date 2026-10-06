import { Module } from '@nestjs/common';
import { ReportingModule } from '../reporting/reporting.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({ imports: [ReportingModule], controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
