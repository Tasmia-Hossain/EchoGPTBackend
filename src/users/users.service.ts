import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(
    userId: number,
    data: {
      email?: string;
      name?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (data.email && data.email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: {
          email: data.email,
        },
      });

      if (existingUser) {
        throw new ConflictException('Email already registered');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        ...(data.email !== undefined && {
          email: data.email,
        }),
        ...(data.name !== undefined && {
          name: data.name,
        }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Current password is incorrect',
      );
    }

    const newPasswordHash = await bcrypt.hash(
      newPassword,
      12,
    );

    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    return {
      message: 'Password changed successfully',
    };
  }

  async deleteAccount(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          deletedAt: new Date(),
        },
      }),

      this.prisma.session.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    return {
      message: 'Account deleted successfully',
    };
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        email: true,
        name: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        subscriptions: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            plan: true,
            status: true,
            usedRequests: true,
            requestLimit: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
          },
        },
      },
    });
  }

  async getAdminDashboardStats() {
    const [
      totalUsers,
      activeUsers,
      adminUsers,
      freeSubscriptions,
      premiumSubscriptions,
      totalConversations,
      totalWebSearches,
      totalApiRequests,
    ] = await Promise.all([
      this.prisma.user.count(),

      this.prisma.user.count({
        where: {
          deletedAt: null,
        },
      }),

      this.prisma.userRole.count({
        where: {
          role: {
            name: 'ADMIN',
          },
        },
      }),

      this.prisma.subscription.count({
        where: {
          plan: 'FREE',
          status: 'ACTIVE',
        },
      }),

      this.prisma.subscription.count({
        where: {
          plan: 'PREMIUM',
          status: 'ACTIVE',
        },
      }),

      this.prisma.chatConversation.count(),

      this.prisma.webSearch.count(),

      this.prisma.aPIUsageLog.count(),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        admins: adminUsers,
      },
      subscriptions: {
        free: freeSubscriptions,
        premium: premiumSubscriptions,
      },
      activity: {
        chatConversations: totalConversations,
        webSearches: totalWebSearches,
        apiRequests: totalApiRequests,
      },
    };
  }

  async getAdminUsageAnalytics() {
    const [
      totalRequests,
      successfulRequests,
      failedRequests,
      totalTokensUsed,
    ] = await Promise.all([
      this.prisma.aPIUsageLog.count(),

      this.prisma.aPIUsageLog.count({
        where: {
          statusCode: {
            gte: 200,
            lt: 400,
          },
        },
      }),

      this.prisma.aPIUsageLog.count({
        where: {
          statusCode: {
            gte: 400,
          },
        },
      }),

      this.prisma.aPIUsageLog.aggregate({
        _sum: {
          tokensUsed: true,
        },
      }),
    ]);

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      totalTokensUsed: totalTokensUsed._sum.tokensUsed ?? 0,
    };
  }
}