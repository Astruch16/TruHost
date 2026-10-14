import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createSupplyItem,
  createSupplyItems,
  recordSupplyLevels,
  restockList,
  supplyHistory,
  supplyItem,
  supplyList,
  updateSupplyItem,
  type CreateSupplyItem,
  type CreateSupplyItems,
  type RecordSupplyLevels,
  type UpdateSupplyItem,
} from '@truhost/shared';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { uuidParam } from '../common/params.js';
import { ZodBody, ZodPipe, ZodResponse } from '../common/zod.js';
import { SuppliesService } from './supplies.service.js';

@ApiTags('supplies')
@Controller()
export class SuppliesController {
  constructor(private readonly supplies: SuppliesService) {}

  @Get('properties/:id/supplies')
  @ZodResponse(supplyList)
  list(@CurrentActor() actor: Actor, @Param('id', uuidParam) propertyId: string) {
    return this.supplies.list(actor, propertyId);
  }

  @Post('properties/:id/supplies')
  @ZodBody(createSupplyItem)
  @ZodResponse(supplyItem, 201)
  create(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Body(new ZodPipe(createSupplyItem)) body: CreateSupplyItem,
  ) {
    return this.supplies.create(actor, propertyId, body);
  }

  /** Setup: several items at once (e.g. picked from the common list). */
  @Post('properties/:id/supplies/bulk')
  @ZodBody(createSupplyItems)
  @ZodResponse(supplyList, 201)
  createMany(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Body(new ZodPipe(createSupplyItems)) body: CreateSupplyItems,
  ) {
    return this.supplies.createMany(actor, propertyId, body.items);
  }

  /** Report levels (one or more items). Crossing an item's restock point notifies admins and owners. */
  @Post('properties/:id/supply-statuses')
  @ZodBody(recordSupplyLevels)
  @ZodResponse(supplyList, 201)
  record(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Body(new ZodPipe(recordSupplyLevels)) body: RecordSupplyLevels,
  ) {
    return this.supplies.record(actor, propertyId, body);
  }

  @Patch('supply-items/:id')
  @ZodBody(updateSupplyItem)
  @ZodResponse(supplyItem)
  update(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(updateSupplyItem)) body: UpdateSupplyItem,
  ) {
    return this.supplies.update(actor, id, body);
  }

  @Post('supply-items/:id/archive')
  @HttpCode(200)
  @ZodResponse(supplyItem)
  archive(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.supplies.archive(actor, id);
  }

  @Get('supply-items/:id/history')
  @ZodResponse(supplyHistory)
  history(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.supplies.history(actor, id);
  }

  /** Admins: everything at or below its restock point, across properties. */
  @Get('supplies/restock')
  @ZodResponse(restockList)
  restock(@CurrentActor() actor: Actor) {
    return this.supplies.restock(actor);
  }
}
