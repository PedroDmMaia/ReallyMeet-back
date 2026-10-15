import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LivekitService } from '../livekit/livekit.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomsService } from './rooms.service';

@ApiTags('rooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly livekitService: LivekitService,
  ) { }

  @Get()
  list() {
    return this.roomsService.listPublicOpen();
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRoomDto) {
    return this.roomsService.create(user.id, dto);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.roomsService.findBySlug(slug);
  }

  @Delete(':slug')
  remove(@Param('slug') slug: string) {
    return this.roomsService.removeIfEmpty(slug);
  }

  @Post(':slug/token')
  async token(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    const room = await this.roomsService.assertCanJoin(slug, user.id);
    const result = await this.livekitService.createParticipantToken({
      roomName: room.slug,
      identity: user.id,
      name: user.displayName,
    });
    await this.roomsService.touchActivity(room.slug);
    return result;
  }
}
