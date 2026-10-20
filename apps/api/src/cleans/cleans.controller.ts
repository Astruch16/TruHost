import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { addCleanPhoto, clean, cleanList, cleanPhotoList, cleanQuery, type AddCleanPhoto } from '@truhost/shared';
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

  /** IN_PROGRESS → COMPLETE (422 CLEAN_MISSING_PHOTOS lists the rooms and phases still missing). */
  @Post(':id/complete')
  @HttpCode(200)
  @ZodResponse(clean)
  complete(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.cleans.complete(actor, id);
  }
}
