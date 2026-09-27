import {
  IsNotEmpty,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LogoutDto {
  @ApiProperty({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-refresh-token',
    description:
      'Refresh token used to revoke the current session.',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}