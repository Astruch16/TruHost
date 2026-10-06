import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { EMAIL_SENDER } from './email-sender.js';
import { LogEmailSender, ResendEmailSender } from './resend-email-sender.js';

@Global()
@Module({
  providers: [
    {
      provide: EMAIL_SENDER,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.RESEND_API_KEY ? new ResendEmailSender(env.RESEND_API_KEY, env.EMAIL_FROM) : new LogEmailSender(),
    },
  ],
  exports: [EMAIL_SENDER],
})
export class EmailModule {}
