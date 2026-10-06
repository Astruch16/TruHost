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
  return process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/truhost_test';
}
