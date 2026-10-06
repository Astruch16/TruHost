import { Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { appConfig, me, updateMe, type AppConfig, type Me, type UpdateMe } from '@truhost/shared';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { ZodBody, ZodPipe, ZodResponse } from '../common/zod.js';
import { ENV, type Env } from '../config/env.js';
import { RateTier } from '../throttling/throttling.js';
import { MeService } from './me.service.js';

@ApiTags('me')
@Controller()
export class MeController {
  constructor(
    private readonly me: MeService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get('me')
  @ZodResponse(me)
  get(@CurrentActor() actor: Actor): Promise<Me> {
    return this.me.get(actor);
  }

  @Patch('me')
  @RateTier('auth')
  @ZodBody(updateMe)
  @ZodResponse(me)
  update(@CurrentActor() actor: Actor, @Body(new ZodPipe(updateMe)) body: UpdateMe): Promise<Me> {
    return this.me.update(actor, body);
  }

  @Get('config')
  @ZodResponse(appConfig)
  config(): AppConfig {
    return { taxFieldsEnabled: this.env.TAX_FIELDS_ENABLED };
  }
}
