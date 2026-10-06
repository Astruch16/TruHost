import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccessModule } from './access/access.module.js';
import { AuditLogsModule } from './audit-logs/audit-logs.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { ProblemFilter } from './common/problem.filter.js';
import { ZodResponseInterceptor } from './common/zod.js';
import { ConfigModule } from './config/config.module.js';
import { ENV, type Env } from './config/env.js';
import { EmailModule } from './email/email.module.js';
import { ExpensesModule } from './expenses/expenses.module.js';
import { FilesModule } from './files/files.module.js';
import { HealthModule } from './health/health.module.js';
import { InvitesModule } from './invites/invites.module.js';
import { MeModule } from './me/me.module.js';
import { PlansModule } from './plans/plans.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PropertiesModule } from './properties/properties.module.js';
import { PostAuthThrottlerGuard, PreAuthThrottlerGuard, throttlers } from './throttling/throttling.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ThrottlerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({ throttlers: throttlers(env) }),
    }),
    AuthModule,
    EmailModule,
    AccessModule,
    AuditModule,
    HealthModule,
    MeModule,
    UsersModule,
    InvitesModule,
    PropertiesModule,
    PlansModule,
    BookingsModule,
    FilesModule,
    ExpensesModule,
    AuditLogsModule,
  ],
  providers: [
    // Guard order matters: per-IP limits, then authentication, then per-user limits.
    { provide: APP_GUARD, useClass: PreAuthThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PostAuthThrottlerGuard },
    { provide: APP_FILTER, useClass: ProblemFilter },
    { provide: APP_INTERCEPTOR, useClass: ZodResponseInterceptor },
  ],
})
export class AppModule {}
