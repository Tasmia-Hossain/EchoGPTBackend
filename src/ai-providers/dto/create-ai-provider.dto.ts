import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class CreateAiProviderDto {
  @ApiProperty({
    example: 'OpenAI',
    description: 'Display name of the AI provider.',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'OPENAI',
    description:
      'AI provider type supported by the application.',
    enum: ['OPENAI', 'ANTHROPIC', 'GEMINI'],
  })
  @IsString()
  @IsIn(['OPENAI', 'ANTHROPIC', 'GEMINI'])
  type!: string;

  @ApiPropertyOptional({
    example: 'provider-api-key',
    description:
      'API key for the provider. The key is encrypted before being stored and is never returned in API responses.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  apiKey?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Whether this AI provider is enabled for use.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'Whether this provider should be configured as the default provider.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}