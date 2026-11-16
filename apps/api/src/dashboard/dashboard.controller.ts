import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  dashboard,
  dashboardQuery,
  dashboardYear,
  dashboardYearQuery,
  type DashboardQuery,
  type DashboardYearQuery,
} from '@truhost/shared';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { ZodPipe, ZodQuery, ZodResponse } from '../common/zod.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ZodQuery(dashboardQuery)
  @ZodResponse(dashboard)
  get(@CurrentActor() actor: Actor, @Query(new ZodPipe(dashboardQuery)) q: DashboardQuery) {
    return this.dashboard.get(actor, q);
  }

  /** Year to date: January through `through`, month by month and together. */
  @Get('year')
  @ZodQuery(dashboardYearQuery)
  @ZodResponse(dashboardYear)
  year(@CurrentActor() actor: Actor, @Query(new ZodPipe(dashboardYearQuery)) q: DashboardYearQuery) {
    return this.dashboard.year(actor, q);
  }
}
