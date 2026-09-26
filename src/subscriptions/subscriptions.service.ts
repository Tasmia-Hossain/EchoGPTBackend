import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMySubscription(userId: number) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

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

  async consumeRequest(userId: number) {
    const subscription = await this.getActiveSubscription(userId);

    if (subscription.usedRequests >= subscription.requestLimit) {
      throw new BadRequestException(
        'Monthly request limit exceeded',
      );
    }

    const updatedSubscription =
      await this.prisma.subscription.update({
        where: {
          id: subscription.id,
        },
        data: {
          usedRequests: {
            increment: 1,
          },
        },
      });

    return {
      usedRequests: updatedSubscription.usedRequests,
      requestLimit: updatedSubscription.requestLimit,
      remainingRequests: Math.max(
        updatedSubscription.requestLimit -
          updatedSubscription.usedRequests,
        0,
      ),
    };
  }

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
      throw new NotFoundException(
        'Active subscription not found',
      );
    }

    return subscription;
  }
}