import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { ENV, type Env } from './config/env.js';
import { buildOpenApi, configureApp } from './setup.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  const env = app.get<Env>(ENV);
  const docsUi = env.OPENAPI_UI ? env.OPENAPI_UI === 'true' : env.NODE_ENV !== 'production';
  if (docsUi) SwaggerModule.setup('v1/docs', app, buildOpenApi(app));

  await app.listen(env.PORT);
}
await bootstrap();
