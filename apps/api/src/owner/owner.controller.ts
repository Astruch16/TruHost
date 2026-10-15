import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  fileUrl,
  ownerCalendar,
  ownerCalendarQuery,
  ownerHome,
  ownerProperties,
  ownerScopeQuery,
  ownerStatement,
  ownerStatementList,
} from '@truhost/shared';
import type { z } from 'zod';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { uuidParam } from '../common/params.js';
import { ZodPipe, ZodQuery, ZodResponse } from '../common/zod.js';
import { OwnerService } from './owner.service.js';

/** The owner portal's API: the caller's owned properties only (OwnerService scopes every read). */
@ApiTags('owner')
@Controller('owner')
export class OwnerController {
  constructor(private readonly owner: OwnerService) {}

  @Get('properties')
  @ZodResponse(ownerProperties)
  properties(@CurrentActor() actor: Actor) {
    return this.owner.properties(actor);
  }

  @Get('home')
  @ZodQuery(ownerScopeQuery)
  @ZodResponse(ownerHome)
  home(@CurrentActor() actor: Actor, @Query(new ZodPipe(ownerScopeQuery)) q: z.output<typeof ownerScopeQuery>) {
    return this.owner.home(actor, q.propertyId);
  }

  /** Released statements only, newest first. */
  @Get('statements')
  @ZodQuery(ownerScopeQuery)
  @ZodResponse(ownerStatementList)
  statements(@CurrentActor() actor: Actor, @Query(new ZodPipe(ownerScopeQuery)) q: z.output<typeof ownerScopeQuery>) {
    return this.owner.statements(actor, q.propertyId);
  }

  @Get('statements/:id')
  @ZodResponse(ownerStatement)
  statement(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.owner.statement(actor, id);
  }

  /** A short-lived link to the statement's stored PDF. */
  @Get('statements/:id/pdf')
  @ZodResponse(fileUrl)
  pdf(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.owner.statementPdf(actor, id);
  }

  @Get('calendar')
  @ZodQuery(ownerCalendarQuery)
  @ZodResponse(ownerCalendar)
  calendar(
    @CurrentActor() actor: Actor,
    @Query(new ZodPipe(ownerCalendarQuery)) q: z.output<typeof ownerCalendarQuery>,
  ) {
    return this.owner.calendar(actor, q.month, q.propertyId);
  }
}
