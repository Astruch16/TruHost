import { ApiError } from '@truhost/api-client';

/** Field-level messages from a 400 VALIDATION_FAILED problem. */
export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError ? error.fieldErrors() : {};
}
