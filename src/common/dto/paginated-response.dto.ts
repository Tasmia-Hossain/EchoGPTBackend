import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 1, minimum: 1 })
  page!: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ example: 125, minimum: 0 })
  total!: number;

  @ApiProperty({ example: 7, minimum: 0, description: 'Zero when total is zero.' })
  totalPages!: number;
}

export class PaginatedResponseDto {
  @ApiProperty({
    type: [Object],
    description: 'Records in the requested page.',
  })
  data!: Record<string, unknown>[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
