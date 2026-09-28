import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { WikipediaProvider } from './providers/wikipedia.provider';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: any;
  let subscriptionsService: any;
  let searchProvider: any;
  let configService: any;

  const reservation = {
    reservation: {
      subscriptionId: 7,
      periodStart: new Date('2026-09-01T00:00:00.000Z'),
    },
    usage: {
      usedRequests: 1,
      requestLimit: 100,
      remainingRequests: 99,
    },
  };

  const results = [
    {
      title: 'NestJS',
      url: 'https://en.wikipedia.org/?curid=1',
      snippet: 'A Node.js framework',
    },
  ];

  beforeEach(async () => {
    prisma = {
      searchCache: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      webSearch: {
        create: jest.fn().mockResolvedValue({ id: 11 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn(),
      },
      aPIUsageLog: {
        create: jest.fn().mockResolvedValue({ id: 21 }),
      },
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };

    subscriptionsService = {
      reserveRequest: jest.fn().mockResolvedValue(reservation),
      refundRequest: jest.fn().mockResolvedValue(undefined),
    };

    searchProvider = {
      search: jest.fn().mockResolvedValue(results),
    };
    configService = { get: jest.fn().mockReturnValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: prisma },
        { provide: SubscriptionsService, useValue: subscriptionsService },
        { provide: WikipediaProvider, useValue: searchProvider },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('normalizes query whitespace, reserves once, and caches successful results', async () => {
    const result = await service.search(42, '  NestJS   REST API  ');

    expect(subscriptionsService.reserveRequest).toHaveBeenCalledTimes(1);
    expect(subscriptionsService.refundRequest).not.toHaveBeenCalled();
    expect(searchProvider.search).toHaveBeenCalledWith('NestJS REST API');
    expect(prisma.searchCache.upsert).toHaveBeenCalledWith({
      where: { queryHash: expect.any(String) },
      create: expect.objectContaining({
        query: 'nestjs rest api',
        results,
        expiresAt: expect.any(Date),
      }),
      update: expect.objectContaining({
        query: 'nestjs rest api',
        results,
        expiresAt: expect.any(Date),
      }),
    });
    expect(prisma.webSearch.create).toHaveBeenCalledWith({
      data: {
        userId: 42,
        query: 'NestJS REST API',
        provider: 'WIKIPEDIA',
        resultCount: 1,
      },
    });
    expect(result).toEqual({
      query: 'NestJS REST API',
      provider: 'WIKIPEDIA',
      resultCount: 1,
      results,
      usage: reservation.usage,
    });
  });

  it('serves normalized equivalent queries from a valid cache hit without calling Wikipedia', async () => {
    prisma.searchCache.findUnique.mockImplementation(async (args: any) => {
      if (args.where.queryHash === expectedQueryHash('NestJS')) {
        return { results, expiresAt: new Date(Date.now() + 60_000) };
      }
      return null;
    });

    const result = await service.search(42, ' nestjs ');

    expect(prisma.searchCache.findUnique).toHaveBeenCalledWith({
      where: { queryHash: expectedQueryHash('nestjs') },
      select: { results: true, expiresAt: true },
    });
    expect(searchProvider.search).not.toHaveBeenCalled();
    expect(prisma.searchCache.upsert).not.toHaveBeenCalled();
    expect(subscriptionsService.reserveRequest).toHaveBeenCalledTimes(1);
    expect(result.results).toEqual(results);
    expect(result.usage).toEqual(reservation.usage);
    expect(prisma.webSearch.create).toHaveBeenCalledTimes(1);
  });

  it('uses one deterministic key for case and whitespace variants', async () => {
    await service.search(42, 'NestJS');
    const firstHash =
      prisma.searchCache.findUnique.mock.calls[0][0].where.queryHash;

    prisma.searchCache.findUnique.mockClear();
    prisma.searchCache.upsert.mockClear();
    searchProvider.search.mockClear();
    await service.search(42, '  nestjs  ');

    const secondHash =
      prisma.searchCache.findUnique.mock.calls[0][0].where.queryHash;
    expect(secondHash).toBe(firstHash);
  });

  it('handles concurrent cache misses through the unique-key upsert', async () => {
    await Promise.all([
      service.search(42, 'NestJS'),
      service.search(43, ' nestjs '),
    ]);

    expect(searchProvider.search).toHaveBeenCalledTimes(2);
    expect(prisma.searchCache.upsert).toHaveBeenCalledTimes(2);
    expect(
      prisma.searchCache.upsert.mock.calls[0][0].where.queryHash,
    ).toBe(prisma.searchCache.upsert.mock.calls[1][0].where.queryHash);
  });

  it('ignores an expired cache entry and refreshes it from the provider', async () => {
    prisma.searchCache.findUnique.mockResolvedValue({
      results,
      expiresAt: new Date(Date.now() - 1000),
    });

    await service.search(42, 'NestJS');

    expect(searchProvider.search).toHaveBeenCalledWith('NestJS');
    expect(prisma.searchCache.upsert).toHaveBeenCalledTimes(1);
  });

  it('uses the configured TTL when setting cache expiry', async () => {
    configService.get.mockReturnValue('7200');
    const beforeWrite = Date.now();

    await service.search(42, 'NestJS');

    const expiresAt = prisma.searchCache.upsert.mock.calls[0][0].create
      .expiresAt as Date;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
      beforeWrite + 7200 * 1000,
    );
    expect(expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 7200 * 1000,
    );
  });

  it('consumes quota exactly once for a cache hit', async () => {
    prisma.searchCache.findUnique.mockResolvedValue({
      results,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await service.search(42, 'NestJS');

    expect(subscriptionsService.reserveRequest).toHaveBeenCalledTimes(1);
    expect(subscriptionsService.refundRequest).not.toHaveBeenCalled();
  });

  it('updates an expired cache entry through upsert and tolerates cache-write failures', async () => {
    prisma.searchCache.findUnique.mockResolvedValue({
      results: [],
      expiresAt: new Date(Date.now() - 1000),
    });
    prisma.searchCache.upsert.mockRejectedValue(new Error('cache unavailable'));

    await expect(service.search(42, 'NestJS')).resolves.toMatchObject({
      results,
    });
    expect(searchProvider.search).toHaveBeenCalledTimes(1);
    expect(prisma.searchCache.upsert).toHaveBeenCalledTimes(1);
  });

  it('refunds the reservation when the search provider fails', async () => {
    searchProvider.search.mockRejectedValue(
      new Error('upstream error'),
    );

    await expect(
      service.search(42, 'NestJS'),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(subscriptionsService.reserveRequest).toHaveBeenCalledTimes(1);
    expect(subscriptionsService.refundRequest).toHaveBeenCalledWith(
      42,
      reservation.reservation,
    );
    expect(prisma.webSearch.create).not.toHaveBeenCalled();
    expect(prisma.searchCache.upsert).not.toHaveBeenCalled();
    expect(prisma.aPIUsageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 42,
        endpoint: '/search',
        statusCode: 502,
      }),
    });
  });

  it('does not cache malformed provider results and refunds the reservation', async () => {
    searchProvider.search.mockResolvedValue([
      { title: 'incomplete result' },
    ]);

    await expect(service.search(42, 'NestJS')).rejects.toThrow(
      ServiceUnavailableException,
    );

    expect(subscriptionsService.refundRequest).toHaveBeenCalledWith(
      42,
      reservation.reservation,
    );
    expect(prisma.searchCache.upsert).not.toHaveBeenCalled();
    expect(prisma.webSearch.create).not.toHaveBeenCalled();
  });

  it('refunds quota and returns a sanitized 503 for a Wikipedia timeout', async () => {
    searchProvider.search.mockRejectedValue(
      new DOMException('private upstream timeout detail', 'TimeoutError'),
    );
    prisma.aPIUsageLog.create.mockRejectedValue(new Error('log write failed'));

    try {
      await service.search(42, 'NestJS');
      fail('Expected the Wikipedia timeout to become a controlled API error');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as Error).message).not.toContain('private upstream');
    }

    expect(subscriptionsService.refundRequest).toHaveBeenCalledWith(
      42,
      reservation.reservation,
    );
    expect(prisma.webSearch.create).not.toHaveBeenCalled();
  });

  it('does not reserve quota for an empty query', async () => {
    await expect(
      service.search(42, '   '),
    ).rejects.toThrow();

    expect(subscriptionsService.reserveRequest).not.toHaveBeenCalled();
    expect(searchProvider.search).not.toHaveBeenCalled();
  });

  it('paginates the current user’s search history and reports matching total', async () => {
    const pageData = [{ id: 4, query: 'NestJS', resultCount: 1 }];
    prisma.webSearch.findMany.mockResolvedValue(pageData);
    prisma.webSearch.count.mockResolvedValue(25);

    const result = await service.getHistory(42, { page: 2, limit: 10 });

    expect(prisma.webSearch.findMany).toHaveBeenCalledWith({
      where: { userId: 42 },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 10,
      take: 10,
      select: {
        id: true,
        query: true,
        provider: true,
        resultCount: true,
        createdAt: true,
      },
    });
    expect(prisma.webSearch.count).toHaveBeenCalledWith({
      where: { userId: 42 },
    });
    expect(result).toEqual({
      data: pageData,
      meta: { page: 2, limit: 10, total: 25, totalPages: 3 },
    });
  });
});

function expectedQueryHash(query: string): string {
  return createHash('sha256')
    .update(
      `wikipedia:v1:${query.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')}`,
    )
    .digest('hex');
}
