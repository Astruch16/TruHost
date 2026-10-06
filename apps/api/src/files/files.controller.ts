import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createUpload, fileUrl, uploadTarget } from '@truhost/shared';
import type { z } from 'zod';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { uuidParam } from '../common/params.js';
import { ZodBody, ZodPipe, ZodResponse } from '../common/zod.js';
import { RateTier } from '../throttling/throttling.js';
import { FilesService } from './files.service.js';

@ApiTags('files')
@Controller()
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('uploads')
  @RateTier('upload')
  @ZodBody(createUpload)
  @ZodResponse(uploadTarget, 201)
  createUpload(@CurrentActor() actor: Actor, @Body(new ZodPipe(createUpload)) body: z.output<typeof createUpload>) {
    return this.files.createUpload(actor, body);
  }

  @Get('files/:id/url')
  @ZodResponse(fileUrl)
  url(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.files.viewUrl(actor, id);
  }
}
