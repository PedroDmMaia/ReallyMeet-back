import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class CheckEmailDto {
  @ApiProperty({ example: 'pedro@example.com' })
  @IsEmail()
  email!: string;
}
