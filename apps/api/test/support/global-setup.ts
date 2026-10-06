import 'dotenv/config';
import { execFileSync } from 'node:child_process';

/** Applies migrations to the test database once per run. Tests truncate tables themselves. */
export default function setup(): void {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
  });
}

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  // No default: these tests truncate every table, so they must never guess a database.
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see apps/api/.env.example)');
  return url;
}
