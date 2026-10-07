import { ApiError } from '@truhost/api-client';

/** Field-level messages from a 400 VALIDATION_FAILED problem. */
export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError ? error.fieldErrors() : {};
}

/** Statuses whose problem detail is written for the user (validation, conflicts, refusals). */
const ACTIONABLE = new Set([400, 403, 409, 413, 422, 429]);

/**
 * The message to show for an error. Server or framework text is only shown for actionable client errors; anything
 * else (network failures, 5xx, unknown routes) gets a plain message.
 */
export function userMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError && ACTIONABLE.has(error.status)) return error.problem.detail ?? error.problem.title;
  if (error instanceof Error && error.name === 'UploadError') return error.message;
  return fallback;
}
