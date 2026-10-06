import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { requestId } from './common/request-id.middleware.js';
import { ENV, type Env } from './config/env.js';

/** Shared by main.ts, the e2e tests and the OpenAPI emitter so all three see the same app. */
export function configureApp(app: NestExpressApplication): void {
  const env = app.get<Env>(ENV);
  app.setGlobalPrefix('v1');
  app.use(requestId);
  app.disable('x-powered-by');
  // Railway terminates TLS in front of us; trust its proxy hop so req.ip is the client.
  app.set('trust proxy', 1);
  app.enableCors({
    origin: env.CORS_ORIGINS,
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
  });
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('TruHost API')
    .setVersion('1')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .build();
  return SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
}
