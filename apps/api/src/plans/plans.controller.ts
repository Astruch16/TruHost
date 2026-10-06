import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  assignPlan,
  createPlan,
  page,
  plan,
  propertyPlanHistory,
  updatePlan,
  type AssignPlan,
  type UpdatePlan,
} from '@truhost/shared';
import type { z } from 'zod';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { uuidParam } from '../common/params.js';
import { ZodBody, ZodPipe, ZodResponse } from '../common/zod.js';
import { PlansService } from './plans.service.js';

@ApiTags('plans')
@Controller()
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get('plans')
  @ZodResponse(page(plan))
  list(@CurrentActor() actor: Actor) {
    return this.plans.list(actor);
  }

  @Post('plans')
  @ZodBody(createPlan)
  @ZodResponse(plan, 201)
  create(@CurrentActor() actor: Actor, @Body(new ZodPipe(createPlan)) body: z.output<typeof createPlan>) {
    return this.plans.create(actor, body);
  }

  @Patch('plans/:id')
  @ZodBody(updatePlan)
  @ZodResponse(plan)
  update(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(updatePlan)) body: UpdatePlan,
  ) {
    return this.plans.update(actor, id, body);
  }

  @Post('plans/:id/archive')
  @HttpCode(200)
  @ZodResponse(plan)
  archive(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.plans.archive(actor, id);
  }

  @Get('properties/:id/plan')
  @ZodResponse(propertyPlanHistory)
  propertyPlan(@CurrentActor() actor: Actor, @Param('id', uuidParam) propertyId: string) {
    return this.plans.propertyPlan(actor, propertyId);
  }

  @Post('properties/:id/plan')
  @HttpCode(200)
  @ZodBody(assignPlan)
  @ZodResponse(propertyPlanHistory)
  assign(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Body(new ZodPipe(assignPlan)) body: AssignPlan,
  ) {
    return this.plans.assign(actor, propertyId, body);
  }
}
