import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DesktopReleaseService } from './desktop-release.service';

@ApiTags('desktop')
@Controller('desktop')
export class DesktopController {
  constructor(private readonly releases: DesktopReleaseService) {}

  @Get('latest')
  async latest() {
    const release = await this.releases.latest();
    return release ?? { version: null };
  }
}
