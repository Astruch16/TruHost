import { ParseUUIDPipe } from '@nestjs/common';
import { notFound } from './problem.js';

/** Path ids are UUIDs; anything else is simply "not found" (never a 500 from Postgres). */
export const uuidParam = new ParseUUIDPipe({ exceptionFactory: () => notFound() });
