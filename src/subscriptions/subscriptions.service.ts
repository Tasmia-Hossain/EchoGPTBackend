import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

interface RequestReservation {
  subscriptionId: number;
  periodStart: Date;
}

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMySubscription(userId: number) {
    const subscription = await this.getActiveSubscription(userId);

    return {
      id: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      requestLimit: subscription.requestLimit,
      usedRequests: subscription.usedRequests,
      remainingRequests: Math.max(
        subscription.requestLimit - subscription.usedRequests,
        0,
      ),
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }

  async upgrade(userId: number) {
    const subscription = await this.getActiveSubscription(userId);

    if (subscription.plan === 'PREMIUM') {
      throw new BadRequestException(
        'User already has a Premium subscription',
      );
    }

    const updatedSubscription = await this.prisma.subscription.update({
      where: {
        id: subscription.id,
      },
      data: {
        plan: 'PREMIUM',
        requestLimit: 1000,
        status: 'ACTIVE',
      },
    });

    return {
      message: 'Subscription upgraded to Premium',
      plan: updatedSubscription.plan,
      requestLimit: updatedSubscription.requestLimit,
      usedRequests: updatedSubscription.usedRequests,
      remainingRequests: Math.max(
        updatedSubscription.requestLimit -
          updatedSubscription.usedRequests,
        0,
      ),
    };
  }

  async downgrade(userId: number) {
    const subscription = await this.getActiveSubscription(userId);

    if (subscription.plan === 'FREE') {
      throw new BadRequestException(
        'User already has a Free subscription',
      );
    }

    const updatedSubscription = await this.prisma.subscription.update({
      where: {
        id: subscription.id,
      },
      data: {
        plan: 'FREE',
        requestLimit: 100,
        status: 'ACTIVE',
      },
    });

    return {
      message: 'Subscription downgraded to Free',
      plan: updatedSubscription.plan,
      requestLimit: updatedSubscription.requestLimit,
      usedRequests: updatedSubscription.usedRequests,
      remainingRequests: Math.max(
        updatedSubscription.requestLimit -
          updatedSubscription.usedRequests,
        0,
      ),
    };
  }

  async getUsage(userId: number) {
    const subscription = await this.getActiveSubscription(userId);

    return {
      plan: subscription.plan,
      requestLimit: subscription.requestLimit,
      usedRequests: subscription.usedRequests,
      remainingRequests: Math.max(
        subscription.requestLimit - subscription.usedRequests,
        0,
      ),
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }

  async checkRequestAvailability(userId: number) {
    const subscription = await this.getActiveSubscription(userId);

    const remainingRequests = Math.max(
      subscription.requestLimit - subscription.usedRequests,
      0,
    );

    if (remainingRequests <= 0) {
      throw new BadRequestException(
        'Monthly request limit exceeded',
      );
    }

    return {
      plan: subscription.plan,
      requestLimit: subscription.requestLimit,
      usedRequests: subscription.usedRequests,
      remainingRequests,
    };
  }

  /**
   * Atomically reserves one request for an operation.
   *
   * The reservation counts toward usage while an external provider is
   * processing the request. Call refundRequest if that provider call fails.
   */
  async reserveRequest(userId: number) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const subscription = await this.getActiveSubscription(userId);
      const now = new Date();

      const result = await this.prisma.subscription.updateMany({
        where: {
          id: subscription.id,
          userId,
          status: 'ACTIVE',
          requestLimit: subscription.requestLimit,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: {
            gt: now,
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

      if (result.count === 1) {
        const usedRequests = subscription.usedRequests + 1;

        return {
          reservation: {
            subscriptionId: subscription.id,
            periodStart: subscription.currentPeriodStart,
          } satisfies RequestReservation,
          usage: {
            usedRequests,
            requestLimit: subscription.requestLimit,
            remainingRequests: Math.max(
              subscription.requestLimit - usedRequests,
              0,
            ),
          },
        };
      }

      const latestSubscription =
        await this.prisma.subscription.findUnique({
          where: {
            id: subscription.id,
          },
        });

      if (!latestSubscription) {
        throw new NotFoundException('Subscription not found');
      }

      if (latestSubscription.status !== 'ACTIVE') {
        throw new NotFoundException(
          'Active subscription not found',
        );
      }

      if (
        latestSubscription.usedRequests >=
        latestSubscription.requestLimit
      ) {
        throw new BadRequestException(
          'Monthly request limit exceeded',
        );
      }

      // A period or plan change raced this reservation; retry from fresh state.
    }

    throw new BadRequestException(
      'Subscription changed during request reservation. Please retry.',
    );
  }

  /**
   * Restores a reservation after the external provider call fails.
   * The period condition prevents a refund from reducing usage in a newer
   * rolling period if the original period expired while the call was running.
   */
  async refundRequest(
    userId: number,
    reservation: RequestReservation,
  ): Promise<void> {
    await this.prisma.subscription.updateMany({
      where: {
        id: reservation.subscriptionId,
        userId,
        status: 'ACTIVE',
        currentPeriodStart: reservation.periodStart,
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
  }

  /**
   * Backwards-compatible atomic consumption method for callers that do not
   * need to refund on provider failure.
   */
  async consumeRequest(userId: number) {
    const { usage } = await this.reserveRequest(userId);
    return usage;
  }

  async getAllSubscriptions() {
    const subscriptions = await this.prisma.subscription.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        plan: true,
        status: true,
        requestLimit: true,
        usedRequests: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return subscriptions.map((subscription) => ({
      ...subscription,
      remainingRequests: Math.max(
        subscription.requestLimit - subscription.usedRequests,
        0,
      ),
    }));
  }

  /**
   * Returns the latest-created active subscription for the user.
   *
   * If its rolling 30-day period has expired, usage is reset atomically
   * before the refreshed row is returned.
   */
  private async getActiveSubscription(userId: number) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!subscription) {
      throw new NotFoundException('Active subscription not found');
    }

    const now = new Date();

    if (subscription.currentPeriodEnd <= now) {
      const newPeriodStart = now;
      const newPeriodEnd = new Date(now);
      newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);

      await this.prisma.subscription.updateMany({
        where: {
          id: subscription.id,
          userId,
          status: 'ACTIVE',
          currentPeriodEnd: {
            lte: now,
          },
        },
        data: {
          usedRequests: 0,
          currentPeriodStart: newPeriodStart,
          currentPeriodEnd: newPeriodEnd,
        },
      });

      const refreshedSubscription =
        await this.prisma.subscription.findUnique({
          where: {
            id: subscription.id,
          },
        });

      if (!refreshedSubscription) {
        throw new NotFoundException('Subscription not found');
      }

      if (
        refreshedSubscription.status !== 'ACTIVE' ||
        refreshedSubscription.currentPeriodEnd <= new Date()
      ) {
        throw new NotFoundException(
          'Active subscription not found',
        );
      }

      return refreshedSubscription;
    }

    return subscription;
  }
}