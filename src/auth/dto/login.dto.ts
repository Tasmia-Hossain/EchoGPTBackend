import {
  IsEmail,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Registered user email address.',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'StrongPassword123!',
    description:
      'User password. Must be at least 8 characters.',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;
}