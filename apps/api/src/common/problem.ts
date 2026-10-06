import { HttpException, HttpStatus } from '@nestjs/common';

export interface ProblemInit {
  status: HttpStatus;
  /** Stable machine-readable code, e.g. NOT_FOUND, PLAN_RATE_LOCKED. */
  code: string;
  title?: string;
  detail?: string;
  /** Extra members merged into the problem body (e.g. `missing: [...]`). */
  extras?: Record<string, unknown>;
}

/** Throw this from services for any expected failure; the filter renders it as RFC 9457. */
export class ProblemException extends HttpException {
  constructor(readonly problem: ProblemInit) {
    super(problem.detail ?? problem.code, problem.status);
  }
}

export const notFound = (what = 'Resource'): ProblemException =>
  new ProblemException({ status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', detail: `${what} not found` });

export const conflict = (code: string, detail: string, extras?: Record<string, unknown>) =>
  new ProblemException({ status: HttpStatus.CONFLICT, code, detail, extras });

export const unprocessable = (code: string, detail: string, extras?: Record<string, unknown>) =>
  new ProblemException({ status: HttpStatus.UNPROCESSABLE_ENTITY, code, detail, extras });
