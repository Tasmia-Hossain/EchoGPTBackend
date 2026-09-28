import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  @Matches(/^postgres(ql)?:\/\/.+$/i, {
    message: 'DATABASE_URL must be a valid PostgreSQL connection string',
  })
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @Matches(/^\d+(ms|s|m|h|d|w|y)$/)
  JWT_EXPIRES_IN!: string;

  @IsString()
  @Matches(/^\d+(ms|s|m|h|d|w|y)$/)
  JWT_REFRESH_EXPIRES_IN!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsOptional()
  @IsIn(['development', 'test', 'production'])
  NODE_ENV?: string;

  @IsOptional()
  @IsString()
  OPENAI_API_KEY?: string;

  @IsOptional()
  @IsString()
  ANTHROPIC_API_KEY?: string;

  @IsOptional()
  @IsString()
  GEMINI_API_KEY?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[\x20-\x7E]{32}$/, {
    message:
      'AI_PROVIDER_ENCRYPTION_KEY must be exactly 32 printable ASCII characters (32 UTF-8 bytes)',
  })
  AI_PROVIDER_ENCRYPTION_KEY!: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
    whitelist: true,
  });

  if (errors.length > 0) {
    throw new Error(
      errors
        .map((error) => Object.values(error.constraints ?? {}).join(', '))
        .join('; '),
    );
  }

  return validatedConfig;
}