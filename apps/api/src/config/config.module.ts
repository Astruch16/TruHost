import { Global, Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../common/clock.js';
import { ENV, loadEnv } from './env.js';

@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    { provide: CLOCK, useValue: systemClock },
  ],
  exports: [ENV, CLOCK],
})
export class ConfigModule {}
