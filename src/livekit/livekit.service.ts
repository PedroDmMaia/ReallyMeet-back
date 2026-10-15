import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoomStatus } from '@prisma/client';
import {
  AccessToken,
  RoomServiceClient,
  WebhookEvent,
  WebhookReceiver,
} from 'livekit-server-sdk';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async countActiveParticipants(roomName: string): Promise<number> {
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET');
    const serverUrl = this.config.get<string>('LIVEKIT_URL');
    if (!apiKey || !apiSecret || !serverUrl || serverUrl.includes('seu-projeto')) {
      return 0;
    }
    const host = serverUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
    const client = new RoomServiceClient(host, apiKey, apiSecret);
    try {
      const participants = await client.listParticipants(roomName);
      return participants.length;
    } catch (error) {
      this.logger.debug(
        `Sala LiveKit ${roomName} sem participantes ativos: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  async createParticipantToken(input: {
    roomName: string;
    identity: string;
    name: string;
  }) {
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET');
    const serverUrl = this.config.get<string>('LIVEKIT_URL');

    if (
      !apiKey ||
      !apiSecret ||
      !serverUrl ||
      serverUrl.includes('seu-projeto')
    ) {
      throw new ServiceUnavailableException(
        'LiveKit não configurado. Defina LIVEKIT_URL, LIVEKIT_API_KEY e LIVEKIT_API_SECRET no .env do backend.',
      );
    }

    try {
      const at = new AccessToken(apiKey, apiSecret, {
        identity: input.identity,
        name: input.name,
        ttl: '1h',
      });
      at.addGrant({
        roomJoin: true,
        room: input.roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });

      const token = await at.toJwt();
      return {
        success: true,
        token,
        serverUrl,
        roomName: input.roomName,
        participantName: input.name,
      };
    } catch (error) {
      this.logger.error('Falha ao emitir token LiveKit', error as Error);
      throw new InternalServerErrorException(
        'Não foi possível emitir o token LiveKit',
      );
    }
  }

  async handleWebhook(authHeader: string | undefined, body: string) {
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET');
    if (!apiKey || !apiSecret) {
      this.logger.warn(
        'Webhook recebido sem LIVEKIT_API_KEY/SECRET configurados',
      );
      return { ok: false };
    }

    let event: WebhookEvent;
    try {
      const receiver = new WebhookReceiver(apiKey, apiSecret);
      event = await receiver.receive(body, authHeader ?? '');
    } catch (error) {
      this.logger.warn(
        `Webhook LiveKit inválido: ${(error as Error).message}`,
      );
      return { ok: false };
    }

    const roomName = event.room?.name;
    if (!roomName) {
      return { ok: true };
    }

    const participantCount = event.room?.numParticipants;

    switch (event.event) {
      case 'room_started':
        await this.prisma.room.updateMany({
          where: { slug: roomName },
          data: {
            status: RoomStatus.OPEN,
            lastActivityAt: new Date(),
            ...(typeof participantCount === 'number'
              ? { participantCount }
              : {}),
          },
        });
        break;
      case 'room_finished':
        await this.prisma.room.updateMany({
          where: { slug: roomName },
          data: {
            status: RoomStatus.CLOSED,
            participantCount: 0,
            lastActivityAt: new Date(),
          },
        });
        break;
      case 'participant_joined':
      case 'participant_left':
        await this.prisma.room.updateMany({
          where: { slug: roomName },
          data: {
            lastActivityAt: new Date(),
            ...(typeof participantCount === 'number'
              ? { participantCount }
              : {}),
          },
        });
        break;
      default:
        break;
    }

    return { ok: true };
  }
}
