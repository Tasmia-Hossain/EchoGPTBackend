import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class UpdateAiProviderDto {
  @ApiPropertyOptional({
    example: 'OpenAI',
    description: 'Updated display name of the AI provider.',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: 'OPENAI',
    description:
      'Updated AI provider type.',
    enum: ['OPENAI', 'ANTHROPIC', 'GEMINI'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['OPENAI', 'ANTHROPIC', 'GEMINI'])
  type?: string;

  @ApiPropertyOptional({
    example: 'new-provider-api-key',
    description:
      'New API key for the provider. The key is encrypted before storage and is never returned in API responses.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  apiKey?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Enable or disable the AI provider.',
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'Set whether this provider should be the default provider.',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}