import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'One-based page number.',
    default: 1,
    minimum: 1,
    maximum: 2147483647,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  page = 1;

  @ApiPropertyOptional({
    description: 'Number of records per page.',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
