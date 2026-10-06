import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { IDENTITY_PROVIDER } from '../../src/auth/identity-provider.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { configureApp } from '../../src/setup.js';
import { FakeIdentityProvider } from './fake-identity.js';

export interface TestApp {
  app: NestExpressApplication;
  prisma: PrismaService;
  identity: FakeIdentityProvider;
  http: () => ReturnType<typeof request>;
  /** Supertest agent with `Authorization: Bearer test:<subject>` preset. */
  as: (subject: string | null) => {
    get: (path: string) => request.Test;
    post: (path: string, body?: object) => request.Test;
    patch: (path: string, body?: object) => request.Test;
    put: (path: string, body?: object) => request.Test;
    delete: (path: string) => request.Test;
  };
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const identity = new FakeIdentityProvider();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(IDENTITY_PROVIDER)
    .useValue(identity)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: ['error', 'warn'] });
  configureApp(app);
  await app.init();

  const server = app.getHttpServer() as App;
  const auth = (t: request.Test, subject: string | null) =>
    subject ? t.set('Authorization', `Bearer test:${subject}`) : t;

  return {
    app,
    prisma: app.get(PrismaService),
    identity,
    http: () => request(server),
    as: (subject) => ({
      get: (path) => auth(request(server).get(path), subject),
      post: (path, body) => auth(request(server).post(path), subject).send(body ?? {}),
      patch: (path, body) => auth(request(server).patch(path), subject).send(body ?? {}),
      put: (path, body) => auth(request(server).put(path), subject).send(body ?? {}),
      delete: (path) => auth(request(server).delete(path), subject),
    }),
    close: () => app.close(),
  };
}
