import { Module } from '@nestjs/common';
import { CleansModule } from '../cleans/cleans.module.js';
import { DamageController } from './damage.controller.js';
import { DamageService } from './damage.service.js';

@Module({
  imports: [CleansModule],
  controllers: [DamageController],
  providers: [DamageService],
  exports: [DamageService],
})
export class DamageModule {}
