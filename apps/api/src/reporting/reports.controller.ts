import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { monthFigures, monthlySeries, monthQuery, portfolioReport, yearQuery } from '@truhost/shared';
import type { z } from 'zod';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { uuidParam } from '../common/params.js';
import { ZodPipe, ZodQuery, ZodResponse } from '../common/zod.js';
import { ReportsService } from './reports.service.js';

@ApiTags('reports')
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('properties/:id/summary')
  @ZodQuery(monthQuery)
  @ZodResponse(monthFigures)
  month(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Query(new ZodPipe(monthQuery)) q: z.output<typeof monthQuery>,
  ) {
    return this.reports.propertyMonth(actor, propertyId, q.month);
  }

  @Get('properties/:id/summary/monthly')
  @ZodQuery(yearQuery)
  @ZodResponse(monthlySeries)
  year(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Query(new ZodPipe(yearQuery)) q: z.output<typeof yearQuery>,
  ) {
    return this.reports.propertyYear(actor, propertyId, q.year);
  }

  @Get('reports/portfolio')
  @ZodQuery(monthQuery)
  @ZodResponse(portfolioReport)
  portfolio(@CurrentActor() actor: Actor, @Query(new ZodPipe(monthQuery)) q: z.output<typeof monthQuery>) {
    return this.reports.portfolio(actor, q.month);
  }
}
