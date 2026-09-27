import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({
    example:
      'Explain the difference between authentication and authorization.',
    description:
      'User message or prompt sent to the selected AI provider.',
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  prompt!: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Optional AI provider ID. If omitted, the configured default provider is used.',
  })
  @IsOptional()
  @IsInt()
  providerId?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Optional conversation ID. If provided, the message is added to that conversation.',
  })
  @IsOptional()
  @IsInt()
  conversationId?: number;
}