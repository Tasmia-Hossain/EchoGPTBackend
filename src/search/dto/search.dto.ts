import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class SearchDto {
  @ApiProperty({
    description:
      'Text query used to perform a web search.',
    example: 'NestJS backend development',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  query!: string;
}