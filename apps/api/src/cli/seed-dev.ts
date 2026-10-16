/**
 * Local test accounts: an owner and a cleaner you can sign in as, with sample properties and data, receipts, and
 * last month's statements released through the real lifecycle (the API's services run in-process for that).
 * Dev only: refuses a live Clerk key or NODE_ENV=production. Idempotent: safe to run again.
 *
 *   pnpm --filter @truhost/api seed:dev
 *
 * Needs an admin (run `bootstrap` first), CLERK_SECRET_KEY set to the dev instance (sk_test_…), and the test
 * accounts in apps/api/.env: SEED_OWNER_EMAIL, SEED_CLEANER_EMAIL (Clerk +clerk_test addresses) and SEED_TEST_PASSWORD.
 * See README → "Local test accounts".
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { createClerkClient } from '@clerk/backend';
import { AppModule } from '../app.module.js';
import { FILE_STORAGE, type FileStorage } from '../files/storage.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StatementsService } from '../statements/statements.service.js';
import { assertSafeToSeed, seedTestAccounts, testAccountsFrom, type SeedIdentity } from '../dev-seed/test-accounts.js';

assertSafeToSeed(process.env);
const password = process.env.SEED_TEST_PASSWORD!;
const accounts = testAccountsFrom(process.env);
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
const prisma = app.get(PrismaService);

/** Finds the Clerk user by email, or creates it; either way its password is set to the test password. */
const identity: SeedIdentity = {
  async ensureUser({ email, firstName, lastName }) {
    const { data } = await clerk.users.getUserList({ emailAddress: [email] });
    const existing = data[0];
    if (existing) {
      await clerk.users.updateUser(existing.id, { password, skipPasswordChecks: true });
      return existing.id;
    }
    const created = await clerk.users.createUser({
      emailAddress: [email],
      firstName,
      lastName,
      password,
      skipPasswordChecks: true,
    });
    return created.id;
  },
};

try {
  const { log } = await seedTestAccounts(prisma, identity, accounts, new Date(), {
    storage: app.get<FileStorage>(FILE_STORAGE),
    statements: app.get(StatementsService),
  });
  for (const line of log) console.log(`• ${line}`);
  console.log(
    `\nSign in at ${process.env.WEB_URL ?? 'http://localhost:3001'} with SEED_OWNER_EMAIL or SEED_CLEANER_EMAIL and ` +
      'SEED_TEST_PASSWORD (apps/api/.env). If Clerk asks for a code, use its test code for +clerk_test addresses ' +
      '(Clerk docs: Testing → test emails).',
  );
} finally {
  await app.close();
}
