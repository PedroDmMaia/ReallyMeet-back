import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomStatus } from '@prisma/client';
import { LivekitService } from '../livekit/livekit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { slugifyTitle } from './slug.util';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly livekit: LivekitService,
  ) {}

  async create(userId: string, dto: CreateRoomDto) {
    const title = dto.title.trim();
    const isPublic = dto.isPublic ?? true;
    let slug = slugifyTitle(title);
    let attempt = 0;

    while (attempt < 5) {
      const candidate = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
      try {
        return await this.prisma.room.create({
          data: {
            title,
            slug: candidate,
            isPublic,
            createdById: userId,
            status: RoomStatus.OPEN,
            lastActivityAt: new Date(),
          },
        });
      } catch (error: unknown) {
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code: string }).code)
            : '';
        if (code === 'P2002') {
          attempt += 1;
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('Não foi possível gerar um slug único para a sala');
  }

  async listPublicOpen() {
    const [rooms, liveCounts] = await Promise.all([
      this.findPublicOpen(),
      this.livekit.activeParticipantCounts(),
    ]);
    if (!liveCounts) return rooms;
    return rooms.map((room) => ({
      ...room,
      participantCount: liveCounts.get(room.slug) ?? 0,
    }));
  }

  private findPublicOpen() {
    return this.prisma.room.findMany({
      where: {
        isPublic: true,
        status: RoomStatus.OPEN,
      },
      orderBy: { lastActivityAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        isPublic: true,
        status: true,
        participantCount: true,
        lastActivityAt: true,
        createdAt: true,
        createdBy: {
          select: { id: true, displayName: true },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    const room = await this.prisma.room.findUnique({
      where: { slug },
      include: {
        createdBy: { select: { id: true, displayName: true } },
      },
    });
    if (!room) {
      throw new NotFoundException('Sala não encontrada');
    }
    return room;
  }

  async assertCanJoin(slug: string, userId: string) {
    const room = await this.findBySlug(slug);
    if (room.status !== RoomStatus.OPEN) {
      throw new ForbiddenException('Sala fechada');
    }
    if (!room.isPublic && room.createdById !== userId) {
      throw new ForbiddenException('Sala privada');
    }
    return room;
  }

  async removeIfEmpty(slug: string) {
    const room = await this.findBySlug(slug);
    const active = await this.livekit.countActiveParticipants(room.slug);
    if (active > 0) {
      throw new ConflictException(
        'Não é possível excluir: ainda há pessoas nesta sala.',
      );
    }
    await this.prisma.room.delete({ where: { id: room.id } });
    return { success: true };
  }

  async touchActivity(slug: string, participantCount?: number) {
    return this.prisma.room.update({
      where: { slug },
      data: {
        lastActivityAt: new Date(),
        ...(typeof participantCount === 'number'
          ? { participantCount }
          : {}),
      },
    });
  }

  async markStatus(slug: string, status: RoomStatus, participantCount?: number) {
    return this.prisma.room.updateMany({
      where: { slug },
      data: {
        status,
        lastActivityAt: new Date(),
        ...(typeof participantCount === 'number'
          ? { participantCount }
          : {}),
      },
    });
  }
}
