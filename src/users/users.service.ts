import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';

function isPrismaUniqueConstraintError(
  error: unknown,
): error is { code: 'P2002' } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

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

    const normalizedEmail =
      data.email === undefined
        ? undefined
        : this.normalizeEmail(data.email);

    if (
      normalizedEmail !== undefined &&
      normalizedEmail !== this.normalizeEmail(user.email)
    ) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
          id: {
            not: userId,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingUser) {
        throw new ConflictException('Email already registered');
      }
    }

    try {
      return await this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          ...(normalizedEmail !== undefined && {
            email: normalizedEmail,
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
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictException('Email already registered');
      }

      throw error;
    }
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

  async getAdminRequestLogs() {
    return this.prisma.aPIUsageLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
      select: {
        id: true,
        endpoint: true,
        method: true,
        provider: true,
        statusCode: true,
        responseTime: true,
        tokensUsed: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async getAdminSystemHealth() {
    const startedAt = Date.now();

    let databaseStatus = 'UP';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      databaseStatus = 'DOWN';
    }

    const responseTimeMs = Date.now() - startedAt;
    const memoryUsage = process.memoryUsage();

    return {
      status: databaseStatus === 'UP' ? 'UP' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV ?? 'development',
      nodeVersion: process.version,
      database: {
        status: databaseStatus,
        responseTimeMs,
      },
      memory: {
        rssBytes: memoryUsage.rss,
        heapUsedBytes: memoryUsage.heapUsed,
        heapTotalBytes: memoryUsage.heapTotal,
      },
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}