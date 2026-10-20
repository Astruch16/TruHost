import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OnboardingRole, onboarding, updateTour, type Onboarding, type UpdateTour } from '@truhost/shared';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { ZodBody, ZodPipe, ZodResponse } from '../common/zod.js';
import { OnboardingService } from './onboarding.service.js';

@ApiTags('onboarding')
@Controller('me/onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  @ZodResponse(onboarding)
  get(@CurrentActor() actor: Actor): Promise<Onboarding> {
    return this.onboarding.get(actor);
  }

  @Post('tours/:role')
  @HttpCode(200)
  @ZodBody(updateTour)
  @ZodResponse(onboarding)
  update(
    @CurrentActor() actor: Actor,
    @Param('role', new ZodPipe(OnboardingRole)) role: OnboardingRole,
    @Body(new ZodPipe(updateTour)) body: UpdateTour,
  ): Promise<Onboarding> {
    return this.onboarding.update(actor, role, body);
  }
}
