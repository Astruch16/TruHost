import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  addDamagePhoto,
  createDamageReport,
  damageReportDetail,
  damageReportList,
  damageReportQuery,
  damageStayList,
  damageStaysQuery,
  setDamageStatus,
  updateDamageReport,
  type AddDamagePhoto,
  type SetDamageStatus,
  type UpdateDamageReport,
} from '@truhost/shared';
import type { z } from 'zod';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { uuidParam } from '../common/params.js';
import { ZodBody, ZodPipe, ZodQuery, ZodResponse } from '../common/zod.js';
import { DamageService } from './damage.service.js';

@ApiTags('damage')
@Controller()
export class DamageController {
  constructor(private readonly damage: DamageService) {}

  /** Admins: across properties (or one), OPEN / RESOLVED / ALL. */
  @Get('damage-reports')
  @ZodQuery(damageReportQuery)
  @ZodResponse(damageReportList)
  listAll(
    @CurrentActor() actor: Actor,
    @Query(new ZodPipe(damageReportQuery)) query: z.output<typeof damageReportQuery>,
  ) {
    return this.damage.listAll(actor, query);
  }

  @Get('properties/:id/damage-reports')
  @ZodResponse(damageReportList)
  list(@CurrentActor() actor: Actor, @Param('id', uuidParam) propertyId: string) {
    return this.damage.listForProperty(actor, propertyId);
  }

  /** Report damage: a DRAFT, sent once it has photos. */
  @Post('properties/:id/damage-reports')
  @ZodBody(createDamageReport)
  @ZodResponse(damageReportDetail, 201)
  create(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Body(new ZodPipe(createDamageReport)) body: z.output<typeof createDamageReport>,
  ) {
    return this.damage.create(actor, propertyId, body);
  }

  /** Stays a report could blame, around the day the damage was found. */
  @Get('properties/:id/damage-report-stays')
  @ZodQuery(damageStaysQuery)
  @ZodResponse(damageStayList)
  stays(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Query(new ZodPipe(damageStaysQuery)) query: z.output<typeof damageStaysQuery>,
  ) {
    return this.damage.stays(actor, propertyId, query.on);
  }

  @Get('damage-reports/:id')
  @ZodResponse(damageReportDetail)
  get(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.damage.get(actor, id);
  }

  @Patch('damage-reports/:id')
  @ZodBody(updateDamageReport)
  @ZodResponse(damageReportDetail)
  update(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(updateDamageReport)) body: UpdateDamageReport,
  ) {
    return this.damage.update(actor, id, body);
  }

  @Post('damage-reports/:id/photos')
  @ZodBody(addDamagePhoto)
  @ZodResponse(damageReportDetail, 201)
  addPhoto(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(addDamagePhoto)) body: AddDamagePhoto,
  ) {
    return this.damage.addPhoto(actor, id, body);
  }

  @Post('damage-reports/:id/submit')
  @HttpCode(200)
  @ZodResponse(damageReportDetail)
  submit(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.damage.submit(actor, id);
  }

  @Post('damage-reports/:id/status')
  @HttpCode(200)
  @ZodBody(setDamageStatus)
  @ZodResponse(damageReportDetail)
  setStatus(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(setDamageStatus)) body: SetDamageStatus,
  ) {
    return this.damage.setStatus(actor, id, body);
  }
}
