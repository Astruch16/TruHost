import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  allBookingsQuery,
  booking,
  bookingList,
  bookingRangeQuery,
  cancelBooking,
  createBooking,
  updateBooking,
  type AllBookingsQuery,
  type BookingRangeQuery,
  type UpdateBooking,
} from '@truhost/shared';
import type { z } from 'zod';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { uuidParam } from '../common/params.js';
import { ZodBody, ZodPipe, ZodQuery, ZodResponse } from '../common/zod.js';
import { BookingsService } from './bookings.service.js';

@ApiTags('bookings')
@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('bookings')
  @ZodQuery(allBookingsQuery)
  @ZodResponse(bookingList)
  listAll(@CurrentActor() actor: Actor, @Query(new ZodPipe(allBookingsQuery)) q: AllBookingsQuery) {
    return this.bookings.listAll(actor, q);
  }

  @Get('properties/:id/bookings')
  @ZodQuery(bookingRangeQuery)
  @ZodResponse(bookingList)
  list(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Query(new ZodPipe(bookingRangeQuery)) q: BookingRangeQuery,
  ) {
    return this.bookings.listForProperty(actor, propertyId, q);
  }

  @Post('properties/:id/bookings')
  @ZodBody(createBooking)
  @ZodResponse(booking, 201)
  create(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Body(new ZodPipe(createBooking)) body: z.output<typeof createBooking>,
  ) {
    return this.bookings.create(actor, propertyId, body);
  }

  @Get('bookings/:id')
  @ZodResponse(booking)
  get(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.bookings.get(actor, id);
  }

  @Patch('bookings/:id')
  @ZodBody(updateBooking)
  @ZodResponse(booking)
  update(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(updateBooking)) body: UpdateBooking,
  ) {
    return this.bookings.update(actor, id, body);
  }

  @Post('bookings/:id/cancel')
  @HttpCode(200)
  @ZodBody(cancelBooking)
  @ZodResponse(booking)
  cancel(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(cancelBooking)) body: z.output<typeof cancelBooking>,
  ) {
    return this.bookings.cancel(actor, id, body);
  }
}
