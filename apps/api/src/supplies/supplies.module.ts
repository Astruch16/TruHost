import { Module } from '@nestjs/common';
import { SuppliesController } from './supplies.controller.js';
import { SuppliesService } from './supplies.service.js';

@Module({ controllers: [SuppliesController], providers: [SuppliesService], exports: [SuppliesService] })
export class SuppliesModule {}
