import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createProperty, page, property, propertyListQuery, setCoverPhoto, updateProperty } from '@truhost/shared';
import type { z } from 'zod';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { uuidParam } from '../common/params.js';
import { ZodBody, ZodPipe, ZodQuery, ZodResponse } from '../common/zod.js';
import { PropertiesService } from './properties.service.js';

@ApiTags('properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  @ZodQuery(propertyListQuery)
  @ZodResponse(page(property))
  list(@CurrentActor() actor: Actor, @Query(new ZodPipe(propertyListQuery)) query: z.output<typeof propertyListQuery>) {
    return this.properties.list(actor, query.includeArchived);
  }

  @Post()
  @ZodBody(createProperty)
  @ZodResponse(property, 201)
  create(@CurrentActor() actor: Actor, @Body(new ZodPipe(createProperty)) body: z.output<typeof createProperty>) {
    return this.properties.create(actor, body);
  }

  @Get(':id')
  @ZodResponse(property)
  get(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.properties.get(actor, id);
  }

  @Patch(':id')
  @ZodBody(updateProperty)
  @ZodResponse(property)
  update(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(updateProperty)) body: z.output<typeof updateProperty>,
  ) {
    return this.properties.update(actor, id, body);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ZodResponse(property)
  archive(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.properties.archive(actor, id);
  }

  @Put(':id/cover-photo')
  @ZodBody(setCoverPhoto)
  @ZodResponse(property)
  setCoverPhoto(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(setCoverPhoto)) body: z.output<typeof setCoverPhoto>,
  ) {
    return this.properties.setCoverPhoto(actor, id, body);
  }

  @Delete(':id/cover-photo')
  @ZodResponse(property)
  removeCoverPhoto(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.properties.removeCoverPhoto(actor, id);
  }
}
