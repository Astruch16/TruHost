import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { Problem } from '@truhost/shared';
import { Prisma } from '../generated/prisma/client.js';
import { PG, pgErrorCode } from './pg-errors.js';
import { ProblemException } from './problem.js';

const TITLES: Partial<Record<number, string>> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

/** Renders every error as application/problem+json (RFC 9457). */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: string }>();
    const res = http.getResponse<Response>();

    const body = this.toProblem(exception);
    body.instance = req.originalUrl;
    if (req.id) body.requestId = req.id;

    if (body.status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    res.status(body.status).type('application/problem+json').json(body);
  }

  private toProblem(exception: unknown): Problem & Record<string, unknown> {
    if (exception instanceof ProblemException) {
      const p = exception.problem;
      return {
        ...p.extras,
        type: 'about:blank',
        title: p.title ?? TITLES[p.status] ?? 'Error',
        status: p.status,
        code: p.code,
        detail: p.detail,
      };
    }
    if (exception instanceof ThrottlerException) {
      return this.simple(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', 'Too many requests');
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrisma(exception);
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      // Nest's router answers unmatched paths with "Cannot GET /path"; never echo framework text to clients.
      if (status === HttpStatus.NOT_FOUND && /^Cannot [A-Z]+ /.test(exception.message)) {
        return this.simple(status, 'ROUTE_NOT_FOUND', 'This endpoint does not exist');
      }
      return this.simple(status, HttpStatus[status] ?? 'ERROR', exception.message);
    }
    return this.simple(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL', undefined);
  }

  /** Database constraint violations that slip past service checks still map to a sane status. */
  private fromPrisma(e: Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case 'P2002':
        return this.simple(HttpStatus.CONFLICT, 'UNIQUE_VIOLATION', 'A record with these values already exists');
      case 'P2025':
        return this.simple(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Resource not found');
      case 'P2004':
      case 'P2010':
        return this.simple(HttpStatus.CONFLICT, 'CONSTRAINT_VIOLATION', 'The change violates a data constraint');
      case 'P2039': {
        // Driver-adapter errors: map the underlying Postgres constraint violations.
        const pg = pgErrorCode(e);
        if (pg === PG.exclusionViolation || pg === PG.checkViolation || pg === PG.uniqueViolation) {
          return this.simple(HttpStatus.CONFLICT, 'CONSTRAINT_VIOLATION', 'The change violates a data constraint');
        }
        this.logger.error(`Unhandled driver error ${pg ?? '?'}: ${e.message}`);
        return this.simple(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL', undefined);
      }
      default:
        this.logger.error(`Unhandled Prisma error ${e.code}: ${e.message}`);
        return this.simple(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL', undefined);
    }
  }

  private simple(status: number, code: string, detail: string | undefined) {
    return { type: 'about:blank', title: TITLES[status] ?? 'Error', status, code, detail };
  }
}
