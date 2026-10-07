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
  - `packages/api-client`: typed API client (`openapi-fetch`) generated from
    the API's OpenAPI document. Web and mobile call the API only through it.
  - `apps/mobile` (later): Expo. Reuses the same API unchanged, so never build
    a web-only backend path.
- **Auth:** Clerk proves identity only. The SPA uses `@clerk/react` and sends
  `Authorization: Bearer <session token>` on every call. The API verifies it
  on every request. Roles and property access live in _our_ database
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
   the TruPlan fee (22% of the month's gross), net and avg. nightly earnings
   (never labelled "ADR") are always computed in the `reporting` module. The
   only stored totals are the copy the server writes into a FINALIZED
   statement.
   - **No secrets in the app:** lockbox and door codes are not stored until
     proper secret handling exists (see the spec's "Later" section).
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
   routes (invites, webhooks, upload URL issuance). The tiers live in
   `apps/api/src/throttling/`. Put a route on the strict tier with
   `@RateTier('auth')`.

Also:

- **CHECK constraints and NULL:** a CHECK passes when its expression is NULL. Wrap anything that can be NULL
  (`coalesce(x, '')`) when the rule is "must be present".
- **Files:** never trust the client. An upload declares type, size and SHA-256. Storage (R2, or the local driver
  in dev and tests) refuses other bytes, and the API re-checks with `head()` when attaching. Viewing goes
  through `GET /v1/files/:id/url`, authorised by what the file is attached to.

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
apps/api/
  prisma/schema.prisma   data model; raw SQL constraints live in migrations
  src/access/            policy.ts (THE authz table) + AccessService
  src/auth/              AuthGuard (token → our User), IdentityProvider (Clerk), @Public
  src/audit/             AuditService.record(tx, …), called inside the mutating transaction
  src/common/            problem+json errors, ZodPipe/ZodBody/ZodResponse, pagination, dates
  src/throttling/        rate-limit tiers and guards
  src/<domain>/          controller (thin) + service (logic + access checks)
  src/cli/               bootstrap (first-run setup), emit-openapi
  src/generated/prisma/  generated client (gitignored; `pnpm db:generate`)
  test/authz/            authorization matrix, one entry per route (meta-test enforces coverage)
  test/support/          test app, fake identity provider, seeded "world", DB reset
apps/web/src/
  routes/                TanStack Router file routes (routeTree.gen.ts is generated and committed)
  lib/api-context.ts     useApi(): the typed client with the Clerk token
  lib/queries.ts         TanStack Query definitions, one per API read
packages/shared/src/     zod schemas (request/response contracts), enums, primitives
packages/api-client/     openapi.json + generated schema.ts (committed; CI checks drift)
docs/spec.md             data model, API, permissions, phases, open questions
```

Controllers validate input with `@Body(new ZodPipe(schema))`, take the caller
from `@CurrentActor()`, call one service method, and declare the response with
`@ZodResponse(schema)`. Responses are parsed through that schema, so undeclared
fields are stripped. Controllers contain no queries and no authorization
logic. Services start with `this.access.assert(...)` or scope queries with
`this.access.propertyIds(...)`.

**Adding a route:**

1. Add the zod schemas to `packages/shared`.
2. Add a policy row if the route needs a new action.
3. Write the controller and service.
4. Add the route's case to `test/authz/cases.ts`.
5. Regenerate the client with `pnpm --filter @truhost/api openapi`.

**Update schemas must never carry `.default()`.** In zod 4, `.partial()`
keeps defaults, which would silently reset fields on PATCH. Put defaults on
create schemas only. `packages/shared` has a test for this.

## Commands

Requires Node 24+ and pnpm (`corepack enable`). Run from the repo root.

| Task             | All packages                      | One package                                                           |
| ---------------- | --------------------------------- | --------------------------------------------------------------------- |
| Install          | `pnpm install`                    |                                                                       |
| Dev servers      | `pnpm dev` (api :3000, web :3001) | `pnpm --filter @truhost/api dev`                                      |
| Build            | `pnpm build`                      | `pnpm --filter @truhost/web build` (static output in `apps/web/dist`) |
| Lint             | `pnpm lint`                       | `pnpm --filter @truhost/api lint`                                     |
| Typecheck        | `pnpm typecheck`                  | `pnpm --filter @truhost/shared typecheck`                             |
| Unit tests       | `pnpm test`                       | `pnpm --filter @truhost/api test`                                     |
| E2E tests (api)  | `pnpm test:e2e`                   | `pnpm --filter @truhost/api test:e2e`                                 |
| Single test file |                                   | `pnpm --filter @truhost/api exec vitest run src/access`               |
| Format           | `pnpm format`                     | CI runs `prettier --check .`                                          |

Tooling per package:

- **api:** NestJS 12 (ESM, `nodenext`, so relative imports use `.js`
  suffixes), Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg`;
  config in `prisma.config.ts`), Vitest (`src/**/*.spec.ts` unit,
  `test/**/*.e2e-spec.ts` e2e against real Postgres), oxlint (type-aware).
- **web:** Vite 8, React 19, TanStack Router (file-based, via
  `@tanstack/router-plugin`) and TanStack Query, Tailwind 4 (`@tailwindcss/vite`),
  `@clerk/react` v6 (use `<Show when="signed-in">`, which replaced
  `SignedIn`/`SignedOut`), ESLint, Vitest with jsdom. Env vars must be
  prefixed `VITE_` and are public. Files under `routes/` and `components/` may
  export only components (fast refresh). Helpers go in `lib/`.
- **shared, api-client:** compiled with `tsc` to `dist/`. Turbo builds them
  before dependents.

### Database (apps/api)

| Task                  | Command (from `apps/api`, or `pnpm --filter @truhost/api <script>`)                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Generate client       | `pnpm db:generate` (Turbo runs it before build, lint, typecheck and test)                                                  |
| New migration         | `pnpm db:migrate --name <change>`. For raw SQL, add `--create-only`, append the SQL, then run `pnpm db:migrate`            |
| Apply migrations      | `pnpm db:deploy` (CI and prod)                                                                                             |
| Browse data           | `pnpm db:studio`                                                                                                           |
| First-run setup       | `pnpm bootstrap --admin-email … --first-name … --last-name … [--property-name … --address … --postal-code …]` (idempotent) |
| Regenerate API client | `pnpm openapi` (builds, writes `packages/api-client/openapi.json`, regenerates types)                                      |

E2E tests use `TEST_DATABASE_URL` from `apps/api/.env`. They apply
migrations once, then truncate tables between tests, so never point it at a
database you care about. Every DB-level guarantee
(triggers, exclusion constraints) gets an e2e test that hits it with raw SQL.

**Local Postgres in WSL** (one-time setup). Ubuntu 24.04's packaged
Postgres 16 is fine locally; CI and Neon run 17, and nothing in the schema
needs 17.

```bash
sudo apt install -y postgresql
sudo service postgresql start   # WSL without systemd: run after each restart
# A dedicated, non-superuser role that owns both databases. CREATEDB is for
# Prisma's shadow database during `prisma migrate dev`. btree_gist is a
# trusted extension, so the database owner can install it.
sudo -u postgres psql -v ON_ERROR_STOP=1 \
  -c "CREATE ROLE truhost LOGIN CREATEDB PASSWORD '<generate one>';" \
  -c "CREATE DATABASE truhost_dev OWNER truhost;" \
  -c "CREATE DATABASE truhost_test OWNER truhost;"
```

Then set `DATABASE_URL` and `TEST_DATABASE_URL` in `apps/api/.env` to
`postgresql://truhost:<password>@localhost:5432/truhost_dev` (and
`…/truhost_test`), run `pnpm --filter @truhost/api db:deploy`, then run
`bootstrap`.

## Environment

Each app has an `.env.example`. Copy it to `.env` and never commit `.env`
files. The API refuses to start with a missing or invalid variable (see
`apps/api/src/config/env.ts`).

## Branches and pull requests

Stacked PRs stranded merged work outside `main` (#8, #9 and #10 all merged into branches that had already
landed). So:

- **No stacked PRs.** Cut every branch from an up-to-date `main` (`git fetch` first), and every PR targets
  `main`.
- **One PR open at a time**, unless two are truly independent (no shared files, either can merge first). If
  work depends on an unmerged PR, wait for it to be merged before starting the dependent branch.
- **Before opening a PR:** confirm the base is `main`, and that the head branch isn't already contained in
  `main` (`git merge-base --is-ancestor <branch> origin/main` must fail).
- **After a merge:** delete the branch (remote and local), then confirm `main` contains the change
  (`git merge-base --is-ancestor <commit> origin/main`).
- Commit or push only when asked. PR descriptions have no "Generated with Claude Code" footer.
