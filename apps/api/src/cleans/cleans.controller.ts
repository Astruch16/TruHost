import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  addCleanPhoto,
  clean,
  cleanDamageCheck,
  cleanList,
  cleanPhotoList,
  cleanQuery,
  cleanStockCount,
  type AddCleanPhoto,
  type CleanDamageCheck,
} from '@truhost/shared';
import type { z } from 'zod';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { uuidParam } from '../common/params.js';
import { ZodBody, ZodPipe, ZodQuery, ZodResponse } from '../common/zod.js';
import { CleansService } from './cleans.service.js';

@ApiTags('cleans')
@Controller('cleans')
export class CleansController {
  constructor(private readonly cleans: CleansService) {}

  /** Cleans at the properties the caller can see; `assignee=me` for a cleaner's own. */
  @Get()
  @ZodQuery(cleanQuery)
  @ZodResponse(cleanList)
  list(@CurrentActor() actor: Actor, @Query(new ZodPipe(cleanQuery)) query: z.output<typeof cleanQuery>) {
    return this.cleans.list(actor, query);
  }

  /** One clean with its room checklist and photos. */
  @Get(':id')
  @ZodResponse(clean)
  get(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.cleans.get(actor, id);
  }

  @Get(':id/photos')
  @ZodResponse(cleanPhotoList)
  photos(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.cleans.photos(actor, id);
  }

  /** SCHEDULED → IN_PROGRESS (a cleaner: on the scheduled day only, 422 CLEAN_NOT_TODAY). */
  @Post(':id/start')
  @HttpCode(200)
  @ZodResponse(clean)
  start(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.cleans.start(actor, id);
  }

  /** A room's BEFORE or AFTER photo (a CLEAN_PHOTO upload, both renditions), while in progress. */
  @Post(':id/photos')
  @ZodBody(addCleanPhoto)
  @ZodResponse(clean, 201)
  addPhoto(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(addCleanPhoto)) body: AddCleanPhoto,
  ) {
    return this.cleans.addPhoto(actor, id, body);
  }

  /** The checklist's damage question (after every before photo). Yes is done once a report is sent from the clean. */
  @Post(':id/damage-check')
  @HttpCode(200)
  @ZodBody(cleanDamageCheck)
  @ZodResponse(clean)
  checkDamage(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(cleanDamageCheck)) body: CleanDamageCheck,
  ) {
    return this.cleans.checkDamage(actor, id, body);
  }

  /** The checklist's stock count: a level for every active supply (after the damage question). */
  @Post(':id/stock-count')
  @HttpCode(200)
  @ZodBody(cleanStockCount)
  @ZodResponse(clean)
  countStock(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(cleanStockCount)) body: z.output<typeof cleanStockCount>,
  ) {
    return this.cleans.countStock(actor, id, body);
  }

  /**
   * IN_PROGRESS → COMPLETE, "Clean finished": every step done (422 CLEAN_MISSING_PHOTOS lists the photos missing, 422
   * CLEAN_CHECKLIST_INCOMPLETE the step waited on). Notifies the admins and the property's owners.
   */
  @Post(':id/complete')
  @HttpCode(200)
  @ZodResponse(clean)
  complete(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.cleans.complete(actor, id);
  }
}
