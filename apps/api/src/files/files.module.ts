import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';
import { LocalStorage } from './local-storage.js';
import { LocalStorageController } from './local-storage.controller.js';
import { R2Storage } from './r2-storage.js';
import { FILE_STORAGE } from './storage.js';

// Decided at load time: the local-storage routes must not exist at all when R2 is in use.
const localDriver = (process.env.STORAGE_DRIVER ?? 'local') === 'local';

@Global()
@Module({
  controllers: [FilesController, ...(localDriver ? [LocalStorageController] : [])],
  providers: [
    FilesService,
    {
      provide: FILE_STORAGE,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.STORAGE_DRIVER === 'r2'
          ? new R2Storage(
              {
                accountId: env.R2_ACCOUNT_ID!,
                accessKeyId: env.R2_ACCESS_KEY_ID!,
                secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
              },
              env.R2_BUCKET!,
            )
          : new LocalStorage(env.STORAGE_LOCAL_DIR, env.STORAGE_SIGNING_SECRET, env.API_PUBLIC_URL),
    },
  ],
  exports: [FilesService, FILE_STORAGE],
})
export class FilesModule {}
