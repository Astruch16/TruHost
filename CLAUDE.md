# TruHost

Internal app for a short-term rental management company in BC, Canada. Three
invite-only roles: **Admin** (TruHost staff), **Owner** (read-only view of
their own properties) and **Cleaner** (assigned cleans, photos, supplies,
damage reports; mobile-first).

The full data model, API surface, permissions matrix and build order are in
[docs/spec.md](docs/spec.md). Read it before you add a model, route or screen.
Change the spec in the same PR as the code that departs from it.

## Architecture (decided: flag before changing)

- **Monorepo:** pnpm workspaces + Turborepo.
  - `apps/api`: NestJS REST API with OpenAPI, Prisma and Postgres (Neon).
    The only thing that touches the database.
  - `apps/web`: Next.js App Router. A **thin client** of the API: no database
    access, and no server actions or route handlers containing business logic.
  - `packages/shared`: zod schemas and TS types used by api, web and mobile.
    Contains no business logic that needs to be trusted. The API recomputes and
    re-validates everything.
  - `apps/mobile` (later): Expo. Reuses the same API unchanged, so never build
    a web-only backend path.
- **Auth:** Clerk proves identity only. Roles and property access live in
  *our* database (`User.staffRole`, `Membership`). Never read roles from
  Clerk metadata.
- **Files:** Cloudflare R2, private bucket. Clients upload with presigned PUT
  URLs and view with short-lived signed GET URLs (5 min or less). Never make
  objects public.
- **Invoices:** Stripe Invoicing later. Out of scope until scheduled.

## Rules (non-negotiable)

1. **Authorization lives in one place:** `apps/api/src/access/`. Every
   query for property-scoped data goes through the access service in the
   **service layer**. Controllers and the frontend never decide access.
   A resource outside the caller's scope returns 404, not 403. Every new route
   must be added to the authorization test matrix
   (`apps/api/test/authz/`), and that test fails if a route is missing.
2. **No stored totals.** Admins enter bookings and expenses. Nights booked,
   gross, net and ADR are always computed from records (`reporting` module).
3. **Bookings have `source`** (`MANUAL | ICAL | PMS`) and `channel` (where the
   guest booked). Data is manual now, iCal next, a PMS API later.
4. **Money is integer cents** (`Int`, CAD). Never floats, never `Decimal` in JS
   math. Rates are basis points (`Int`). Rounding rules live in one helper
   in the API.
5. **Photos are evidence:** server timestamp, uploader, SHA-256, immutable.
   There are no update or delete routes for photos, and DB triggers reject
   UPDATE/DELETE on them.
6. **State machines are enforced in the API.** A clean cannot reach `COMPLETE`
   unless every active room has a BEFORE and an AFTER photo. A damage report
   cannot be submitted without at least one photo. Transitions use conditional
   updates (`WHERE status = ...`) to avoid races.
7. **Audit log** for every admin mutation of money or documents. It is
   written in the same transaction as the change and is append-only.
8. **Rate limiting** on every endpoint, with stricter tiers on auth-adjacent
   routes (invites, webhooks, upload URL issuance).

Also:

- Tests are required for anything touching permissions, money or state
  machines. Money calculations get table-driven tests with exact expected cents.
- Never hard-delete records with money, documents or evidence. Use
  `archivedAt`, `voidedAt` or `revokedAt` instead.
- Dates of stay are `@db.Date` in property-local time. Instants are
  `timestamptz` in UTC. Property timezone is on `Property.timeZone`.

## Layout

```
apps/api/src/
  access/        AccessService + policy table (the single authz source)
  auth/          Clerk token guard, @Actor() decorator, Clerk webhook
  audit/         AuditService (call inside the mutating transaction)
  prisma/        PrismaService
  files/         R2 presign, verification, signed view URLs
  <domain>/      controller (thin) + service (logic + access) + *.spec.ts
apps/api/test/   e2e and authz matrix tests (*.e2e-spec.ts)
apps/web/src/    Next.js app. Talks to the API through the generated client
packages/shared/src/  zod schemas, enums, types
docs/spec.md     data model, API, permissions, phases, open questions
```

Controllers parse input with zod schemas from `@truhost/shared`, take the
actor from `@Actor()`, call one service method, and return its result. They
contain no queries and no authorization logic.

## Commands

Requires Node 24+ and pnpm (`corepack enable`). Run from the repo root.

| Task | All packages | One package |
|---|---|---|
| Install | `pnpm install` | |
| Dev servers | `pnpm dev` (api :3000, web :3001) | `pnpm --filter @truhost/api dev` |
| Build | `pnpm build` | `pnpm --filter @truhost/web build` |
| Lint | `pnpm lint` | `pnpm --filter @truhost/api lint` |
| Typecheck | `pnpm typecheck` | `pnpm --filter @truhost/shared typecheck` |
| Unit tests | `pnpm test` | `pnpm --filter @truhost/api test` |
| E2E tests (api) | `pnpm test:e2e` | `pnpm --filter @truhost/api test:e2e` |
| Single test file | | `pnpm --filter @truhost/api exec vitest run src/health` |
| Format | `pnpm format` | |

Tooling per package:

- **api:** NestJS 12 (ESM, `nodenext`, so relative imports use `.js`
  suffixes), Vitest (`*.spec.ts` unit, `test/*.e2e-spec.ts` e2e), oxlint
  (type-aware).
- **web:** Next.js 16 (App Router, Turbopack), Tailwind 4, ESLint, Vitest.
  This Next version differs from older docs: read
  `apps/web/node_modules/next/dist/docs/` before using unfamiliar APIs (see
  `apps/web/AGENTS.md`).
- **shared:** compiled with `tsc` to `dist/`. Turbo builds it before
  dependents. Run `pnpm --filter @truhost/shared dev` for watch mode
  (`pnpm dev` does this already).

Prisma commands (after Phase 1 adds Prisma) will be documented here.

## Environment

Each app has an `.env.example`. Copy it to `.env` and never commit `.env`
files.
