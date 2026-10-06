import createClient, { type Client } from 'openapi-fetch';
import type { Problem } from '@truhost/shared';
import type { components, paths } from './schema.js';

export type { components, paths };
export type ApiClient = Client<paths>;

export interface ApiClientOptions {
  baseUrl: string;
  /** Returns the current Clerk session token, or null when signed out. Called per request. */
  getToken: () => Promise<string | null>;
}

/**
 * Typed client for the TruHost API, generated from its OpenAPI document. Used by apps/web now
 * and apps/mobile later, so it must stay free of browser- or React-specific code.
 */
export function createApiClient({ baseUrl, getToken }: ApiClientOptions): ApiClient {
  const client = createClient<paths>({ baseUrl });
  client.use({
    async onRequest({ request }) {
      const token = await getToken();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    },
  });
  return client;
}

/** Thrown by `unwrap` for any non-2xx response; carries the RFC 9457 problem body. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: Problem,
  ) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
  }

  /** Per-field validation messages keyed by path, for forms. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.problem.errors ?? []).map((e) => [e.path, e.message]));
  }
}

/** Turns an openapi-fetch result into data-or-throw, which suits TanStack Query. */
export async function unwrap<T>(call: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await call;
  if (response.ok) return data as T;
  const problem = (error ?? {}) as Partial<Problem>;
  throw new ApiError(response.status, {
    type: problem.type ?? 'about:blank',
    title: problem.title ?? response.statusText,
    status: response.status,
    code: problem.code ?? 'UNKNOWN',
    detail: problem.detail,
    errors: problem.errors,
    requestId: problem.requestId,
  });
}
