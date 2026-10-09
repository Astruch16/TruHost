import { Body, Controller, Delete, Get, Inject, Patch, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  appConfig,
  me,
  notificationSettings,
  setAvatar,
  updateMe,
  updateNotificationSettings,
  type AppConfig,
  type Me,
  type NotificationSettings,
  type SetAvatar,
  type UpdateMe,
  type UpdateNotificationSettings,
} from '@truhost/shared';
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

  @Put('me/avatar')
  @ZodBody(setAvatar)
  @ZodResponse(me)
  setAvatar(@CurrentActor() actor: Actor, @Body(new ZodPipe(setAvatar)) body: SetAvatar): Promise<Me> {
    return this.me.setAvatar(actor, body);
  }

  @Delete('me/avatar')
  @ZodResponse(me)
  removeAvatar(@CurrentActor() actor: Actor): Promise<Me> {
    return this.me.removeAvatar(actor);
  }

  @Get('me/notification-settings')
  @ZodResponse(notificationSettings)
  notificationSettings(@CurrentActor() actor: Actor): Promise<NotificationSettings> {
    return this.me.notificationSettings(actor);
  }

  @Put('me/notification-settings')
  @ZodBody(updateNotificationSettings)
  @ZodResponse(notificationSettings)
  updateNotificationSettings(
    @CurrentActor() actor: Actor,
    @Body(new ZodPipe(updateNotificationSettings)) body: UpdateNotificationSettings,
  ): Promise<NotificationSettings> {
    return this.me.updateNotificationSettings(actor, body);
  }

  @Get('config')
  @ZodResponse(appConfig)
  config(): AppConfig {
    return { taxFieldsEnabled: this.env.TAX_FIELDS_ENABLED };
  }
}
