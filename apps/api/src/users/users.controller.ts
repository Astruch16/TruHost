import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  page,
  pageQuery,
  updateUser,
  user,
  userListQuery,
  type PageQuery,
  type UpdateUser,
  type UserListQuery,
} from '@truhost/shared';
import { CurrentActor, type Actor } from '../auth/actor.js';
import { uuidParam } from '../common/params.js';
import { ZodBody, ZodPipe, ZodQuery, ZodResponse } from '../common/zod.js';
import { UsersService } from './users.service.js';

const listQuery = userListQuery.extend(pageQuery.shape);

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ZodQuery(listQuery)
  @ZodResponse(page(user))
  list(@CurrentActor() actor: Actor, @Query(new ZodPipe(listQuery)) query: UserListQuery & PageQuery) {
    return this.users.list(actor, query);
  }

  @Get(':id')
  @ZodResponse(user)
  get(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.users.get(actor, id);
  }

  @Patch(':id')
  @ZodBody(updateUser)
  @ZodResponse(user)
  update(
    @CurrentActor() actor: Actor,
    @Param('id', uuidParam) id: string,
    @Body(new ZodPipe(updateUser)) body: UpdateUser,
  ) {
    return this.users.update(actor, id, body);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @ZodResponse(user)
  deactivate(@CurrentActor() actor: Actor, @Param('id', uuidParam) id: string) {
    return this.users.deactivate(actor, id);
  }
}
