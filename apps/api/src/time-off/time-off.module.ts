import { Module } from '@nestjs/common';
import { TimeOffController } from './time-off.controller.js';
import { TimeOffService } from './time-off.service.js';

@Module({ controllers: [TimeOffController], providers: [TimeOffService] })
export class TimeOffModule {}
