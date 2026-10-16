import { Module } from '@nestjs/common';
import { DesktopController } from './desktop.controller';
import { DesktopReleaseService } from './desktop-release.service';

@Module({
  controllers: [DesktopController],
  providers: [DesktopReleaseService],
})
export class DesktopModule {}
