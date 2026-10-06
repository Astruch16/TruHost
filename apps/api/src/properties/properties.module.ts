import { Module } from '@nestjs/common';
import { MembershipsController } from './memberships.controller.js';
import { MembershipsService } from './memberships.service.js';
import { PropertiesController } from './properties.controller.js';
import { PropertiesService } from './properties.service.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

@Module({
  controllers: [PropertiesController, MembershipsController, RoomsController],
  providers: [PropertiesService, MembershipsService, RoomsService],
})
export class PropertiesModule {}
