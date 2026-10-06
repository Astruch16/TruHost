import { Global, Module } from '@nestjs/common';
import { ClerkIdentityProvider } from './clerk-identity-provider.js';
import { IDENTITY_PROVIDER } from './identity-provider.js';

@Global()
@Module({
  providers: [{ provide: IDENTITY_PROVIDER, useClass: ClerkIdentityProvider }],
  exports: [IDENTITY_PROVIDER],
})
export class AuthModule {}
