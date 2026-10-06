import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Not `env()`: `prisma generate` must work without a database (CI, fresh clones).
    url: process.env.DATABASE_URL ?? '',
  },
});
