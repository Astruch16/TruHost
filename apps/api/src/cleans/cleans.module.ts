import { Module } from '@nestjs/common';
import { SuppliesModule } from '../supplies/supplies.module.js';
import { CleansController } from './cleans.controller.js';
import { CleansService } from './cleans.service.js';

@Module({
  imports: [SuppliesModule],
  controllers: [CleansController],
  providers: [CleansService],
  exports: [CleansService],
})
export class CleansModule {}
