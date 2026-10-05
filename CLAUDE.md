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
  - `apps/web`: Vite + React SPA (TanStack Router, TanStack Query, Tailwind 4),
    deployed as static files to Cloudflare Pages. A **thin client** of the API:
    it never computes money or decides access, it only displays what the API
    returns.
  - `packages/shared`: zod schemas and TS types used by api, web and mobile.
    Contains no business logic that needs to be trusted. The API recomputes and
    re-validates everything.
  - `apps/mobile` (later): Expo. Reuses the same API unchanged, so never build
    a web-only backend path.
- **Auth:** Clerk proves identity only. The SPA uses `@clerk/react` and sends
  `Authorization: Bearer <session token>` on every call. The API verifies it
  on every request. Roles and property access live in *our* database
  (`User.staffRole`, `Membership`). Never read roles from Clerk metadata.
  An invited user is linked to their Clerk account on their first
  authenticated request, by verified email.
- **Hosting:** API on Railway (US West). Postgres on Neon (same region).
  Web on Cloudflare Pages. Local Postgres in WSL for tests; CI runs its own
  Postgres service.
- **Files:** Cloudflare R2, private bucket. Clients upload with presigned PUT
  URLs and view with short-lived signed GET URLs (5 min or less). Never make
  objects public.
- **Owner payouts:** monthly `OwnerStatement` per property (DRAFT → FINALIZED
  → RELEASED). There are no client invoices and no Stripe. Finalizing locks
  that month's bookings and expenses; corrections become adjustments on the
  next statement.

## Rules (non-negotiable)

1. **Authorization lives in one place:** `apps/api/src/access/`. Every
   query for property-scoped data goes through the access service in the
   **service layer**. Controllers and the frontend never decide access.
   A resource outside the caller's scope returns 404, not 403. Every new route
   must be added to the authorization test matrix
   (`apps/api/test/authz/`), and that test fails if a route is missing.
2. **No entered totals.** Admins enter per-booking payout and cleaning fee,
   and per-expense amounts. Nights, owner gross (payout − cleaning fee),
   the TruPlan fee (22% of the month's gross), net and ADR are always
   computed in the `reporting` module. The only stored totals are the copy
   the server writes into a FINALIZED statement.
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
- Money formulas, allocation (per-night split, largest remainder) and
  rounding live only in `apps/api/src/reporting/`. Never re-implement them in
  the web app.
- Tax fields stay disabled unless `TAX_FIELDS_ENABLED=true`.
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
apps/web/src/
  routes/        TanStack Router file routes (routeTree.gen.ts is generated
                 by the Vite plugin and committed)
  lib/api.ts     typed API client (openapi-fetch) with the Clerk token
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
| Build | `pnpm build` | `pnpm --filter @truhost/web build` (static output in `apps/web/dist`) |
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
- **web:** Vite 8, React 19, TanStack Router (file-based, via
  `@tanstack/router-plugin`) and TanStack Query, Tailwind 4 (`@tailwindcss/vite`),
  `@clerk/react` v6 (use `<Show when="signed-in">`, which replaced
  `SignedIn`/`SignedOut`), ESLint, Vitest with jsdom. Env vars must be
  prefixed `VITE_` and are public.
- **shared:** compiled with `tsc` to `dist/`. Turbo builds it before
  dependents. Run `pnpm --filter @truhost/shared dev` for watch mode
  (`pnpm dev` does this already).

Prisma commands (after Phase 1 adds Prisma) will be documented here.

## Environment

Each app has an `.env.example`. Copy it to `.env` and never commit `.env`
files.
