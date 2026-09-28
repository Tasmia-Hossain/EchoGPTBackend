import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { WikipediaProvider } from './providers/wikipedia.provider';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: any;
  let subscriptionsService: any;
  let searchProvider: any;

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
      webSearch: {
        create: jest.fn().mockResolvedValue({ id: 11 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      aPIUsageLog: {
        create: jest.fn().mockResolvedValue({ id: 21 }),
      },
    };

    subscriptionsService = {
      reserveRequest: jest.fn().mockResolvedValue(reservation),
      refundRequest: jest.fn().mockResolvedValue(undefined),
    };

    searchProvider = {
      search: jest.fn().mockResolvedValue(results),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: prisma },
        { provide: SubscriptionsService, useValue: subscriptionsService },
        { provide: WikipediaProvider, useValue: searchProvider },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('reserves exactly one request after query validation and returns usage', async () => {
    const result = await service.search(42, '  NestJS  ');

    expect(subscriptionsService.reserveRequest).toHaveBeenCalledTimes(1);
    expect(subscriptionsService.refundRequest).not.toHaveBeenCalled();
    expect(searchProvider.search).toHaveBeenCalledWith('NestJS');
    expect(prisma.webSearch.create).toHaveBeenCalledWith({
      data: {
        userId: 42,
        query: 'NestJS',
        provider: 'WIKIPEDIA',
        resultCount: 1,
      },
    });
    expect(result).toEqual({
      query: 'NestJS',
      provider: 'WIKIPEDIA',
      resultCount: 1,
      results,
      usage: reservation.usage,
    });
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
    expect(prisma.aPIUsageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 42,
        endpoint: '/search',
        statusCode: 502,
      }),
    });
  });

  it('does not reserve quota for an empty query', async () => {
    await expect(
      service.search(42, '   '),
    ).rejects.toThrow();

    expect(subscriptionsService.reserveRequest).not.toHaveBeenCalled();
    expect(searchProvider.search).not.toHaveBeenCalled();
  });
});