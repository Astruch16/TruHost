import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createTimeOff, decideTimeOff, timeOffList, timeOffQuery, timeOffRequest } from '@truhost/shared';
import type { z } from 'zod';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { uuidParam } from '../common/params.js';
import { ZodBody, ZodPipe, ZodQuery, ZodResponse } from '../common/zod.js';
import { TimeOffService } from './time-off.service.js';

@ApiTags('time off')
@Controller('time-off')
export class TimeOffController {
  constructor(private readonly timeOff: TimeOffService) {}

  /** Admins: every cleaner's requests; a cleaner: their own. */
  @Get()
  @ZodQuery(timeOffQuery)
  @ZodResponse(timeOffList)
  list(@CurrentActor() actor: Actor, @Query(new ZodPipe(timeOffQuery)) query: z.output<typeof timeOffQuery>) {
    return this.timeOff.list(actor, query);
  }

  /** A cleaner asks for days off (422 TIME_OFF_IN_PAST / TIME_OFF_TOO_LONG / TIME_OFF_OVERLAPS). Tells the admins. */
  @Post()
  @ZodBody(createTimeOff)
  @ZodResponse(timeOffRequest, 201)
  create(@CurrentActor() actor: Actor, @Body(new ZodPipe(createTimeOff)) body: z.output<typeof createTimeOff>) {
    return this.timeOff.create(actor, body);
  }

  /** Its cleaner withdraws it (pending, or approved and not over). */
  @Post(':id/cancel')
  @HttpCode(200)
  @ZodResponse(timeOffRequest)
  cancel(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.timeOff.cancel(actor, id);
  }

  /** Admins: approve or decline a pending request. */
  @Post(':id/decision')
  @HttpCode(200)
  @ZodBody(decideTimeOff)
  @ZodResponse(timeOffRequest)
  decide(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(decideTimeOff)) body: z.output<typeof decideTimeOff>,
  ) {
    return this.timeOff.decide(actor, id, body);
  }
}
