import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Tags each request with an id (honouring a sane inbound X-Request-Id) for logs, errors and audit rows. */
export function requestId(req: Request & { id?: string }, res: Response, next: NextFunction): void {
  const inbound = req.header('x-request-id');
  req.id = inbound && /^[\w-]{8,64}$/.test(inbound) ? inbound : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
