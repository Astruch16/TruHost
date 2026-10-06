import 'dotenv/config';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { testDatabaseUrl } from './global-setup.js';

// Runs in each test worker before any app is created.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl();
process.env.CORS_ORIGINS = 'http://localhost:3001';
process.env.WEB_URL = 'https://app.truhost.example';
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_LOCAL_DIR = join(tmpdir(), `truhost-test-storage-${process.pid}`);
process.env.API_PUBLIC_URL = 'http://api.test';
process.env.RATE_LIMIT_MULTIPLIER ??= '1000';
