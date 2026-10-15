import { Body, Controller, Get, HttpCode, Param, Post, Query, StreamableFile } from '@nestjs/common';
import { ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import {
  createAdjustment,
  createStatement,
  finalizeStatement,
  generatedStatements,
  generateStatements,
  releaseStatement,
  statement,
  statementList,
  statementMonth,
  statementMonthQuery,
  voidRecord,
} from '@truhost/shared';
import type { z } from 'zod';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { inlineDisposition } from '../files/storage.js';
import { uuidParam } from '../common/params.js';
import { ZodBody, ZodPipe, ZodQuery, ZodResponse } from '../common/zod.js';
import { StatementsService } from './statements.service.js';

@ApiTags('statements')
@Controller()
export class StatementsController {
  constructor(private readonly statements: StatementsService) {}

  /** Every property's statement for a month (admins). */
  @Get('statements')
  @ZodQuery(statementMonthQuery)
  @ZodResponse(statementMonth)
  month(
    @CurrentActor() actor: Actor,
    @Query(new ZodPipe(statementMonthQuery)) q: z.output<typeof statementMonthQuery>,
  ) {
    return this.statements.month(actor, q.month);
  }

  /** Starts a draft for every active property that has none for the month. */
  @Post('statements/generate')
  @HttpCode(200)
  @ZodBody(generateStatements)
  @ZodResponse(generatedStatements)
  generate(
    @CurrentActor() actor: Actor,
    @Body(new ZodPipe(generateStatements)) body: z.output<typeof generateStatements>,
  ) {
    return this.statements.generate(actor, body.month);
  }

  @Get('properties/:id/statements')
  @ZodResponse(statementList)
  list(@CurrentActor() actor: Actor, @Param('id', uuidParam) propertyId: string) {
    return this.statements.listForProperty(actor, propertyId);
  }

  /** Starts the property's draft for a month (idempotent). */
  @Post('properties/:id/statements')
  @HttpCode(200)
  @ZodBody(createStatement)
  @ZodResponse(statement)
  create(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) propertyId: string,
    @Body(new ZodPipe(createStatement)) body: z.output<typeof createStatement>,
  ) {
    return this.statements.create(actor, propertyId, body.month);
  }

  @Get('statements/:id')
  @ZodResponse(statement)
  get(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.statements.get(actor, id);
  }

  /** The PDF as it would print now, for a draft or a finalized statement. Released ones have their stored PDF. */
  @Get('statements/:id/preview')
  @ApiProduces('application/pdf')
  @ApiOkResponse({ content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } })
  async preview(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    const pdf = await this.statements.previewPdf(actor, id);
    return new StreamableFile(pdf.body, {
      type: 'application/pdf',
      disposition: inlineDisposition(pdf.filename),
      length: pdf.body.length,
    });
  }

  @Post('statements/:id/finalize')
  @HttpCode(200)
  @ZodBody(finalizeStatement)
  @ZodResponse(statement)
  finalize(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(finalizeStatement)) body: z.output<typeof finalizeStatement>,
  ) {
    return this.statements.finalize(actor, id, body);
  }

  @Post('statements/:id/release')
  @HttpCode(200)
  @ZodBody(releaseStatement)
  @ZodResponse(statement)
  release(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(releaseStatement)) body: z.output<typeof releaseStatement>,
  ) {
    return this.statements.release(actor, id, body);
  }

  /** Adds an adjustment to a draft; returns the statement with it. */
  @Post('statements/:id/adjustments')
  @HttpCode(200)
  @ZodBody(createAdjustment)
  @ZodResponse(statement)
  addAdjustment(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(createAdjustment)) body: z.output<typeof createAdjustment>,
  ) {
    return this.statements.addAdjustment(actor, id, body);
  }

  /** Voids an adjustment on a draft (with a reason); returns its statement. */
  @Post('adjustments/:id/void')
  @HttpCode(200)
  @ZodBody(voidRecord)
  @ZodResponse(statement)
  voidAdjustment(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(voidRecord)) body: z.output<typeof voidRecord>,
  ) {
    return this.statements.voidAdjustment(actor, id, body.reason);
  }
}
