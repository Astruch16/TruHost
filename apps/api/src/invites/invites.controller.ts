import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createInvite, invite, page, pageQuery, type PageQuery } from '@truhost/shared';
import type { z } from 'zod';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { uuidParam } from '../common/params.js';
import { ZodBody, ZodPipe, ZodQuery, ZodResponse } from '../common/zod.js';
import { RateTier } from '../throttling/throttling.js';
import { InvitesService } from './invites.service.js';

@ApiTags('invites')
@Controller('invites')
@RateTier('auth')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Post()
  @ZodBody(createInvite)
  @ZodResponse(invite, 201)
  create(@CurrentActor() actor: Actor, @Body(new ZodPipe(createInvite)) body: z.output<typeof createInvite>) {
    return this.invites.create(actor, body);
  }

  @Get()
  @ZodQuery(pageQuery)
  @ZodResponse(page(invite))
  list(@CurrentActor() actor: Actor, @Query(new ZodPipe(pageQuery)) query: PageQuery) {
    return this.invites.list(actor, query);
  }

  @Post(':id/resend')
  @HttpCode(200)
  @ZodResponse(invite)
  resend(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.invites.resend(actor, id);
  }

  @Post(':id/revoke')
  @HttpCode(200)
  @ZodResponse(invite)
  revoke(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.invites.revoke(actor, id);
  }
}
