/**
 * Writes the OpenAPI document to the path given as the first argument. Run from the compiled
 * build (`pnpm --filter @truhost/api openapi`) because Nest needs decorator metadata.
 */
import { writeFile } from 'node:fs/promises';

// Describing routes needs no database or Clerk; skip those env requirements.
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://openapi@localhost/unused';

const out = process.argv[2];
if (!out) throw new Error('Usage: emit-openapi <output.json>');

const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('../app.module.js');
const { buildOpenApi, configureApp } = await import('../setup.js');

const app = await NestFactory.create(AppModule, { logger: false });
configureApp(app as never);
const doc = buildOpenApi(app);
await writeFile(out, `${JSON.stringify(doc, null, 2)}\n`);
await app.close();
console.log(`OpenAPI written to ${out}`);
