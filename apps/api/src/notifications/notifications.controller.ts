import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  markNotificationsRead,
  notificationList,
  notificationQuery,
  type MarkNotificationsRead,
} from '@truhost/shared';
import type { z } from 'zod';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { ZodBody, ZodPipe, ZodQuery, ZodResponse } from '../common/zod.js';
import { NotificationsService } from './notifications.service.js';

/** The caller's own notifications. Self-scoped: there is nobody else's to see. */
@ApiTags('notifications')
@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ZodQuery(notificationQuery)
  @ZodResponse(notificationList)
  list(@CurrentActor() actor: Actor, @Query(new ZodPipe(notificationQuery)) query: z.output<typeof notificationQuery>) {
    return this.notifications.list(actor, query.unread);
  }

  @Post('read')
  @HttpCode(200)
  @ZodBody(markNotificationsRead)
  @ZodResponse(notificationList)
  markRead(@CurrentActor() actor: Actor, @Body(new ZodPipe(markNotificationsRead)) body: MarkNotificationsRead) {
    return this.notifications.markRead(actor, body);
  }
}
