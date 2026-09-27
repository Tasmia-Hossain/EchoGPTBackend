import {
  IsNotEmpty,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-refresh-token',
    description:
      'Refresh token issued during login or token refresh.',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}