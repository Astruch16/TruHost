import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  allExpensesQuery,
  createExpense,
  createReceipt,
  expense,
  expenseList,
  expenseRangeQuery,
  receipt,
  receiptList,
  updateExpense,
  voidRecord,
  type AllExpensesQuery,
  type ExpenseRangeQuery,
  type UpdateExpense,
  type VoidRecord,
} from '@truhost/shared';
import type { z } from 'zod';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { uuidParam } from '../common/params.js';
import { ZodBody, ZodPipe, ZodQuery, ZodResponse } from '../common/zod.js';
import { ExpensesService } from './expenses.service.js';

@ApiTags('expenses')
@Controller()
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get('expenses')
  @ZodQuery(allExpensesQuery)
  @ZodResponse(expenseList)
  listAll(@CurrentActor() actor: Actor, @Query(new ZodPipe(allExpensesQuery)) q: AllExpensesQuery) {
    return this.expenses.listAll(actor, q);
  }

  @Get('properties/:id/expenses')
  @ZodQuery(expenseRangeQuery)
  @ZodResponse(expenseList)
  list(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Query(new ZodPipe(expenseRangeQuery)) q: ExpenseRangeQuery,
  ) {
    return this.expenses.listForProperty(actor, propertyId, q);
  }

  @Post('properties/:id/expenses')
  @ZodBody(createExpense)
  @ZodResponse(expense, 201)
  create(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Body(new ZodPipe(createExpense)) body: z.output<typeof createExpense>,
  ) {
    return this.expenses.create(actor, propertyId, body);
  }

  @Patch('expenses/:id')
  @ZodBody(updateExpense)
  @ZodResponse(expense)
  update(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(updateExpense)) body: UpdateExpense,
  ) {
    return this.expenses.update(actor, id, body);
  }

  @Post('expenses/:id/void')
  @HttpCode(200)
  @ZodBody(voidRecord)
  @ZodResponse(expense)
  void(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(voidRecord)) body: VoidRecord,
  ) {
    return this.expenses.void(actor, id, body.reason);
  }

  @Get('properties/:id/receipts')
  @ZodQuery(expenseRangeQuery)
  @ZodResponse(receiptList)
  receipts(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Query(new ZodPipe(expenseRangeQuery)) q: ExpenseRangeQuery,
  ) {
    return this.expenses.listReceipts(actor, propertyId, q);
  }

  @Post('properties/:id/receipts')
  @ZodBody(createReceipt)
  @ZodResponse(receipt, 201)
  createReceipt(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Body(new ZodPipe(createReceipt)) body: z.output<typeof createReceipt>,
  ) {
    return this.expenses.createReceipt(actor, propertyId, body);
  }

  @Post('receipts/:id/void')
  @HttpCode(200)
  @ZodBody(voidRecord)
  @ZodResponse(receipt)
  voidReceipt(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(voidRecord)) body: VoidRecord,
  ) {
    return this.expenses.voidReceipt(actor, id, body.reason);
  }
}
