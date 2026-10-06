import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createMembership, membership, membershipListQuery, page, type CreateMembership } from '@truhost/shared';
import type { z } from 'zod';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { uuidParam } from '../common/params.js';
import { ZodBody, ZodPipe, ZodQuery, ZodResponse } from '../common/zod.js';
import { MembershipsService } from './memberships.service.js';

@ApiTags('memberships')
@Controller()
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get('properties/:id/memberships')
  @ZodQuery(membershipListQuery)
  @ZodResponse(page(membership))
  list(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Query(new ZodPipe(membershipListQuery)) query: z.output<typeof membershipListQuery>,
  ) {
    return this.memberships.list(actor, propertyId, query.includeRevoked);
  }

  @Post('properties/:id/memberships')
  @ZodBody(createMembership)
  @ZodResponse(membership, 201)
  create(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Body(new ZodPipe(createMembership)) body: CreateMembership,
  ) {
    return this.memberships.create(actor, propertyId, body);
  }

  @Post('memberships/:id/revoke')
  @HttpCode(200)
  @ZodResponse(membership)
  revoke(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.memberships.revoke(actor, id);
  }
}
