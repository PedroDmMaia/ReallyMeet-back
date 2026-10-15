import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'pedro@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'senha-segura' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Pedro' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;
}
