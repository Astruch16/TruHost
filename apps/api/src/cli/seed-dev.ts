/**
 * Local test accounts: an owner and a cleaner you can sign in as, with sample properties and data, receipts, and
 * last month's statements released through the real lifecycle (the API's services run in-process for that).
 * Dev only: refuses a live Clerk key or NODE_ENV=production. Idempotent: safe to run again.
 *
 *   pnpm --filter @truhost/api seed:dev
 *
 * Needs an admin (run `bootstrap` first) and CLERK_SECRET_KEY set to the dev instance (sk_test_…).
 * See README → "Local test accounts".
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { createClerkClient } from '@clerk/backend';
import { AppModule } from '../app.module.js';
import { FILE_STORAGE, type FileStorage } from '../files/storage.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StatementsService } from '../statements/statements.service.js';
import {
  assertSafeToSeed,
  DEFAULT_TEST_PASSWORD,
  seedTestAccounts,
  TEST_VERIFICATION_CODE,
  type SeedIdentity,
} from '../dev-seed/test-accounts.js';

assertSafeToSeed(process.env);
const password = process.env.SEED_TEST_PASSWORD || DEFAULT_TEST_PASSWORD;
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
  const { log } = await seedTestAccounts(prisma, identity, new Date(), {
    storage: app.get<FileStorage>(FILE_STORAGE),
    statements: app.get(StatementsService),
  });
  for (const line of log) console.log(`• ${line}`);
  console.log(
    `\nSign in at ${process.env.WEB_URL ?? 'http://localhost:3001'} with either email and the test password` +
      `${process.env.SEED_TEST_PASSWORD ? ' (SEED_TEST_PASSWORD)' : ''}. If asked for a code, use ${TEST_VERIFICATION_CODE}.`,
  );
} finally {
  await app.close();
}
