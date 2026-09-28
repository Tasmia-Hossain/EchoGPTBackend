import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: any;

  const futureDate = () =>
    new Date(Date.now() + 24 * 60 * 60 * 1000);

  const activeSubscription = (overrides: Record<string, unknown> = {}) => ({
    id: 7,
    userId: 42,
    plan: 'FREE',
    status: 'ACTIVE',
    requestLimit: 2,
    usedRequests: 0,
    currentPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
    currentPeriodEnd: futureDate(),
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      subscription: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  it('atomically reserves one request only below the limit', async () => {
    const subscription = activeSubscription();
    prisma.subscription.findFirst.mockResolvedValue(subscription);
    prisma.subscription.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.reserveRequest(42);

    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: {
        id: subscription.id,
        userId: 42,
        status: 'ACTIVE',
        requestLimit: subscription.requestLimit,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: {
          gt: expect.any(Date),
        },
        usedRequests: {
          lt: subscription.requestLimit,
        },
      },
      data: {
        usedRequests: {
          increment: 1,
        },
      },
    });
    expect(result).toEqual({
      reservation: {
        subscriptionId: 7,
        periodStart: subscription.currentPeriodStart,
      },
      usage: {
        usedRequests: 1,
        requestLimit: 2,
        remainingRequests: 1,
      },
    });
  });

  it('rejects reservation when the quota is exhausted', async () => {
    const subscription = activeSubscription({
      requestLimit: 1,
      usedRequests: 1,
    });
    prisma.subscription.findFirst.mockResolvedValue(subscription);
    prisma.subscription.updateMany.mockResolvedValue({ count: 0 });
    prisma.subscription.findUnique.mockResolvedValue(subscription);

    await expect(service.reserveRequest(42)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('allows only the remaining number of concurrent reservations', async () => {
    const subscription = activeSubscription({
      requestLimit: 2,
      usedRequests: 0,
    });
    let currentUsage = 0;

    prisma.subscription.findFirst.mockResolvedValue(subscription);
    prisma.subscription.updateMany.mockImplementation(async () => {
      if (currentUsage >= subscription.requestLimit) {
        return { count: 0 };
      }

      currentUsage += 1;
      return { count: 1 };
    });
    prisma.subscription.findUnique.mockImplementation(async () => ({
      ...subscription,
      usedRequests: currentUsage,
    }));

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => service.reserveRequest(42)),
    );

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(2);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(3);
    expect(currentUsage).toBe(2);
  });

  it('refunds a reservation with a conditional atomic decrement', async () => {
    const periodStart = new Date('2026-09-01T00:00:00.000Z');
    prisma.subscription.updateMany.mockResolvedValue({ count: 1 });

    await service.refundRequest(42, {
      subscriptionId: 7,
      periodStart,
    });

    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: {
        id: 7,
        userId: 42,
        status: 'ACTIVE',
        currentPeriodStart: periodStart,
        usedRequests: {
          gt: 0,
        },
      },
      data: {
        usedRequests: {
          decrement: 1,
        },
      },
    });
  });

  it('reports zero remaining requests and never returns a negative value', async () => {
    prisma.subscription.findFirst.mockResolvedValue(
      activeSubscription({
        requestLimit: 2,
        usedRequests: 5,
      }),
    );

    const result = await service.getUsage(42);

    expect(result.remainingRequests).toBe(0);
  });

  it('resets an expired rolling period before reserving usage', async () => {
    const expiredSubscription = activeSubscription({
      requestLimit: 2,
      usedRequests: 2,
      currentPeriodEnd: new Date('2026-01-01T00:00:00.000Z'),
    });
    const renewedSubscription = activeSubscription({
      requestLimit: 2,
      usedRequests: 0,
      currentPeriodStart: new Date(),
      currentPeriodEnd: futureDate(),
    });

    let currentSubscription = expiredSubscription;
    prisma.subscription.findFirst.mockImplementation(async () => currentSubscription);
    prisma.subscription.updateMany.mockImplementation(async (args: any) => {
      if (args.data.usedRequests === 0) {
        currentSubscription = renewedSubscription;
        return { count: 1 };
      }

      currentSubscription = {
        ...currentSubscription,
        usedRequests: currentSubscription.usedRequests + 1,
      };
      return { count: 1 };
    });
    prisma.subscription.findUnique.mockImplementation(async () => currentSubscription);

    const result = await service.reserveRequest(42);

    expect(prisma.subscription.updateMany).toHaveBeenCalledTimes(2);
    expect(result.usage).toEqual({
      usedRequests: 1,
      requestLimit: 2,
      remainingRequests: 1,
    });
    expect(result.reservation.periodStart).toEqual(
      renewedSubscription.currentPeriodStart,
    );
  });
});