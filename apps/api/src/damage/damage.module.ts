import { Module } from '@nestjs/common';
import { DamageController } from './damage.controller.js';
import { DamageService } from './damage.service.js';

@Module({ controllers: [DamageController], providers: [DamageService] })
export class DamageModule {}
