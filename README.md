# TruHost

Internal app for TruHost's short-term rental management: an admin portal for TruHost staff, a read-only portal for
property owners and a mobile-first portal for cleaners. Invite only.

- **Design and data model:** [docs/spec.md](docs/spec.md)
- **Architecture, rules and every command:** [CLAUDE.md](CLAUDE.md)

## Getting started

Needs Node 24+, pnpm (`corepack enable`) and a local Postgres (setup in [CLAUDE.md](CLAUDE.md#database-appsapi)).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # then fill in DATABASE_URL, Clerk dev keys (incl. CLERK_JWT_KEY), …
cp apps/web/.env.example apps/web/.env
pnpm --filter @truhost/api db:deploy
pnpm --filter @truhost/api bootstrap -- --admin-email you@example.com --first-name You --last-name Admin
pnpm dev                                  # API on :3000, web on :3001
```

## Local test accounts

To look at the owner and cleaner portals locally, the seed creates an owner and a cleaner you can sign in as. They
exist only in the Clerk **dev** instance and your local database, and you choose their sign-in details yourself, in
`apps/api/.env` (never commit them, and never put them in this README, an issue or a PR):

| Variable             | What to put                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `SEED_OWNER_EMAIL`   | A Clerk test address for the owner, `yourname+owner+clerk_test@yourdomain`                             |
| `SEED_CLEANER_EMAIL` | A Clerk test address for the cleaner, `yourname+cleaner+clerk_test@yourdomain`                         |
| `SEED_TEST_PASSWORD` | A password of at least 12 characters, used for both (each run sets it, so changing it here rotates it) |

The owner owns the two test properties (stays and expenses); the cleaner cleans both. Clerk sends no email to
`+clerk_test` addresses: if sign-in asks for a code, use Clerk's test verification code (Clerk docs: Testing, "test
emails").

The test properties are **Seaside Loft (test)** and **Cedar Cabin (test)**. Each has four stays a month, from three
months ago to next month: past and current stays have payouts, next month's are still pending, and Cedar has an
owner stay each month. Each property also has a few owner-paid expenses a month (no receipts, so they show as
needing one), and a supplies list with levels from the cleaner's last check, some at or below their restock point.
(Seeded levels send no alerts; mark one lower as the cleaner to see the bell and email.)

Each seeded expense gets a sample receipt (a small PDF), and last month's owner statement for both properties is
generated, finalized and released through the real lifecycle, with its PDF, so the owner portal has statements to
show. Cleans aren't built yet (spec Phase 3), so the seed doesn't create any.

### Creating or refreshing them

```bash
pnpm --filter @truhost/api seed:dev
```

- Run `bootstrap` first. The seed records the admin as the person who entered the sample data.
- `CLERK_SECRET_KEY` in `apps/api/.env` must be the dev instance's key (`sk_test_…`). The seed refuses a live
  key (`sk_live_…`) and refuses to run with `NODE_ENV=production`.
- It refuses to run without `SEED_OWNER_EMAIL`, `SEED_CLEANER_EMAIL` and `SEED_TEST_PASSWORD`.
- It is safe to run again. It finds the Clerk users and properties it made before, resets the test password, and
  only adds months that are new since the last run (the window moves with today's date). It never edits or deletes
  existing bookings or expenses, and never touches other properties. A statement already released is left alone.
- It builds the API first (`nest build`) and runs the API's own services, so a running `pnpm dev` API restarts
  once while it does.
