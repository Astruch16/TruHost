import type { paths } from '@truhost/api-client';

/** Response body of a GET route, straight from the generated OpenAPI types. */
type Ok<P extends keyof paths> = paths[P] extends {
  get: { responses: { 200: { content: { 'application/json': infer T } } } };
}
  ? T
  : never;

export type Booking = Ok<'/v1/bookings/{id}'>;
export type Property = Ok<'/v1/properties/{id}'>;
