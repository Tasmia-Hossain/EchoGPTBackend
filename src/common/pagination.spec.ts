import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { PaginationQueryDto } from './dto/pagination-query.dto';
import { toPaginatedResponse } from './pagination';

describe('PaginationQueryDto', () => {
  it('defaults to page 1 and limit 20', () => {
    const pagination = plainToInstance(PaginationQueryDto, {});

    expect(pagination.page).toBe(1);
    expect(pagination.limit).toBe(20);
    expect(validateSync(pagination)).toHaveLength(0);
  });

  it.each([
    ['page', '0'],
    ['page', '-1'],
    ['page', '1.5'],
    ['page', 'not-a-number'],
    ['limit', '0'],
    ['limit', '-1'],
    ['limit', '2.5'],
    ['limit', 'not-a-number'],
    ['limit', '101'],
  ])('rejects invalid %s value %s', (field, value) => {
    const pagination = plainToInstance(PaginationQueryDto, {
      [field]: value,
    });

    expect(validateSync(pagination).length).toBeGreaterThan(0);
  });

  it('accepts valid string query parameters after numeric transformation', () => {
    const pagination = plainToInstance(PaginationQueryDto, {
      page: '3',
      limit: '25',
    });

    expect(validateSync(pagination)).toHaveLength(0);
    expect(pagination).toMatchObject({ page: 3, limit: 25 });
  });
});

describe('toPaginatedResponse', () => {
  it('returns zero total pages for an empty result set', () => {
    expect(toPaginatedResponse([], 1, 20, 0)).toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('counts a last partial page correctly', () => {
    expect(toPaginatedResponse([{ id: 41 }], 3, 20, 41).meta).toEqual({
      page: 3,
      limit: 20,
      total: 41,
      totalPages: 3,
    });
  });
});
