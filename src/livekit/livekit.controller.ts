import { Controller, Headers, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { LivekitService } from './livekit.service';

@ApiTags('livekit')
@Controller('livekit')
export class LivekitController {
  constructor(private readonly livekitService: LivekitService) {}

  @Post('webhook')
  webhook(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const raw =
      req.rawBody?.toString('utf8') ??
      (typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    return this.livekitService.handleWebhook(authorization, raw);
  }
}
