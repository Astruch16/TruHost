import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createRoom,
  page,
  reorderRooms,
  room,
  updateRoom,
  type CreateRoom,
  type ReorderRooms,
  type UpdateRoom,
} from '@truhost/shared';
import { z } from 'zod';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { uuidParam } from '../common/params.js';
import { ZodBody, ZodPipe, ZodQuery, ZodResponse } from '../common/zod.js';
import { RoomsService } from './rooms.service.js';

const roomListQuery = z.object({
  includeArchived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(false),
});

@ApiTags('rooms')
@Controller()
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get('properties/:id/rooms')
  @ZodQuery(roomListQuery)
  @ZodResponse(page(room))
  list(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Query(new ZodPipe(roomListQuery)) query: z.output<typeof roomListQuery>,
  ) {
    return this.rooms.list(actor, propertyId, query.includeArchived);
  }

  @Post('properties/:id/rooms')
  @ZodBody(createRoom)
  @ZodResponse(room, 201)
  create(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Body(new ZodPipe(createRoom)) body: CreateRoom,
  ) {
    return this.rooms.create(actor, propertyId, body);
  }

  @Put('properties/:id/rooms/order')
  @ZodBody(reorderRooms)
  @ZodResponse(page(room))
  reorder(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Body(new ZodPipe(reorderRooms)) body: ReorderRooms,
  ) {
    return this.rooms.reorder(actor, propertyId, body);
  }

  @Patch('rooms/:id')
  @ZodBody(updateRoom)
  @ZodResponse(room)
  update(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(updateRoom)) body: UpdateRoom,
  ) {
    return this.rooms.update(actor, id, body);
  }

  @Post('rooms/:id/archive')
  @HttpCode(200)
  @ZodResponse(room)
  archive(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.rooms.archive(actor, id);
  }
}
