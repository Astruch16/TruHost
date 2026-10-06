import { Prisma } from '../generated/prisma/client.js';

/**
 * The Postgres SQLSTATE behind a Prisma error, if any. With driver adapters, constraint violations Prisma has no
 * code for (e.g. exclusion constraints, 23P01) arrive as P2039 with the original code in meta.
 */
export function pgErrorCode(e: unknown): string | undefined {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return undefined;
  const meta = e.meta as { driverAdapterError?: { cause?: { originalCode?: string; code?: string } } } | undefined;
  return meta?.driverAdapterError?.cause?.originalCode ?? meta?.driverAdapterError?.cause?.code;
}

export const PG = {
  checkViolation: '23514',
  exclusionViolation: '23P01',
  uniqueViolation: '23505',
} as const;
