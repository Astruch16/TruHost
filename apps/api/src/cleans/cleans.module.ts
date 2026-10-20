import { Module } from '@nestjs/common';
import { CleansController } from './cleans.controller.js';
import { CleansService } from './cleans.service.js';

@Module({ controllers: [CleansController], providers: [CleansService], exports: [CleansService] })
export class CleansModule {}
