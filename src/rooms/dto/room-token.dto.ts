import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class RoomTokenDto {
  @ApiPropertyOptional({ enum: ['screen'] })
  @IsOptional()
  @IsIn(['screen'])
  purpose?: 'screen';
}
