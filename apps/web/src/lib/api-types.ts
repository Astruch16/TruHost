import type { paths } from '@truhost/api-client';

/** Response body of a GET route, straight from the generated OpenAPI types. */
type Ok<P extends keyof paths> = paths[P] extends {
  get: { responses: { 200: { content: { 'application/json': infer T } } } };
}
  ? T
  : never;

export type Booking = Ok<'/v1/bookings/{id}'>;
export type Property = Ok<'/v1/properties/{id}'>;
export type Dashboard = Ok<'/v1/dashboard'>;
export type Statement = Ok<'/v1/statements/{id}'>;
export type StatementMonth = Ok<'/v1/statements'>;
export type StatementRow = StatementMonth['items'][number];
export type StatementLine = Statement['lines'][number];

type Created<P extends keyof paths> = paths[P] extends {
  post: { responses: { 201: { content: { 'application/json': infer T } } } };
}
  ? T
  : never;

export type Expense = Created<'/v1/properties/{id}/expenses'>;
