# TruHost

Internal app for TruHost's short-term rental management: an admin portal for TruHost staff, a read-only portal for
property owners and a mobile-first portal for cleaners. Invite only.

- **Design and data model:** [docs/spec.md](docs/spec.md)
- **Architecture, rules and every command:** [CLAUDE.md](CLAUDE.md)

## Getting started

Needs Node 24+, pnpm (`corepack enable`) and a local Postgres (setup in [CLAUDE.md](CLAUDE.md#database-appsapi)).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # then fill in DATABASE_URL, Clerk dev keys, …
cp apps/web/.env.example apps/web/.env
pnpm --filter @truhost/api db:deploy
pnpm --filter @truhost/api bootstrap -- --admin-email you@example.com --first-name You --last-name Admin
pnpm dev                                  # API on :3000, web on :3001
```

## Local test accounts

To look at the owner and cleaner portals locally, sign in as these test users. They exist only in the Clerk
**dev** instance and your local database.

| Role    | Email                                     | Sees                                                      |
| ------- | ----------------------------------------- | --------------------------------------------------------- |
| Owner   | `adamstruch+owner+clerk_test@gmail.com`   | Owner of the two test properties, with stays and expenses |
| Cleaner | `adamstruch+cleaner+clerk_test@gmail.com` | Cleaner on the two test properties                        |

- **Password:** `TruHost-local-test-2026` (or whatever you set in `SEED_TEST_PASSWORD`).
- **Code:** if sign-in asks for a code (for example, the new-device check, or "Forgot password?"), enter `424242`.
  No email is sent: Clerk dev instances accept this code for any `+clerk_test` address.

The test properties are **Seaside Loft (test)** and **Cedar Cabin (test)**. Each has four stays a month, from three
months ago to next month: past and current stays have payouts, next month's are still pending, and Cedar has an
owner stay each month. Each property also has a few owner-paid expenses a month (no receipts, so they show as
needing one).

Statements and cleans aren't built yet (spec Phases 2b and 3), so the seed doesn't create any. It will once they
exist.

### Creating or refreshing them

```bash
pnpm --filter @truhost/api seed:dev
```

- Run `bootstrap` first. The seed records the admin as the person who entered the sample data.
- `CLERK_SECRET_KEY` in `apps/api/.env` must be the dev instance's key (`sk_test_…`). The seed refuses a live
  key (`sk_live_…`) and refuses to run with `NODE_ENV=production`.
- It is safe to run again. It finds the Clerk users and properties it made before, resets the test password, and
  only adds months that are new since the last run (the window moves with today's date). It never edits or deletes
  existing bookings or expenses, and never touches other properties.
