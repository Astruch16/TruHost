import { Injectable } from '@nestjs/common';
import type { Me, UpdateMe } from '@truhost/shared';
import type { Actor } from '../auth/actor.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async get(actor: Actor): Promise<Me> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
      include: {
        memberships: {
          where: { revokedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, property: { select: { id: true, name: true } } },
        },
      },
    });
    return user;
  }

  async update(actor: Actor, input: UpdateMe): Promise<Me> {
    await this.prisma.user.update({ where: { id: actor.userId }, data: input });
    return this.get(actor);
  }
}
