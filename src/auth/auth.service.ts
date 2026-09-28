import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

interface RefreshTokenPayload {
  sub: number;
  jti: string;
  exp?: number;
}

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
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(
    email: string,
    password: string,
    name?: string,
  ) {
    const normalizedEmail = this.normalizeEmail(email);

    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const userRole = await tx.role.findUnique({
          where: {
            name: 'USER',
          },
          select: {
            id: true,
          },
        });

        if (!userRole) {
          throw new InternalServerErrorException(
            'Default USER role is not configured. Run the seed script before registering users.',
          );
        }

        const createdUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            name,
          },
        });

        await tx.userRole.create({
          data: {
            userId: createdUser.id,
            roleId: userRole.id,
          },
        });

        await tx.subscription.create({
          data: {
            userId: createdUser.id,
            plan: 'FREE',
            status: 'ACTIVE',
            requestLimit: 100,
            usedRequests: 0,
            currentPeriodStart,
            currentPeriodEnd,
          },
        });

        return createdUser;
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name,
      };
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictException('Email already registered');
      }

      throw error;
    }
  }

  async login(
    email: string,
    password: string,
  ) {
    const normalizedEmail = this.normalizeEmail(email);

    const user = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    const jti = randomUUID();

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        jti,
      },
      {
        secret: this.configService.getOrThrow<string>(
          'JWT_REFRESH_SECRET',
        ),
        expiresIn: this.getRefreshTokenExpiresIn(),
      },
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        jti,
        refreshTokenHash,
        expiresAt: this.getTokenExpirationDate(refreshToken),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async refresh(refreshToken: string) {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>(
            'JWT_REFRESH_SECRET',
          ),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload.sub || !payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.session.findUnique({
      where: {
        jti: payload.jti,
      },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenMatches = await bcrypt.compare(
      refreshToken,
      session.refreshTokenHash,
    );

    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: session.userId,
      },
      select: {
        id: true,
        email: true,
        deletedAt: true,
        name: true,
      },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const now = new Date();
    const newJti = randomUUID();

    let newRefreshToken: string;

    try {
      newRefreshToken = await this.prisma.$transaction(async (tx) => {
        const revokedSession = await tx.session.updateMany({
          where: {
            id: session.id,
            userId: payload.sub,
            jti: payload.jti,
            revokedAt: null,
            expiresAt: {
              gt: now,
            },
            user: {
              is: {
                deletedAt: null,
              },
            },
          },
          data: {
            revokedAt: now,
          },
        });

        if (revokedSession.count !== 1) {
          throw new UnauthorizedException('Invalid refresh token');
        }

        const replacementRefreshToken =
          await this.jwtService.signAsync(
            {
              sub: user.id,
              jti: newJti,
            },
            {
              secret: this.configService.getOrThrow<string>(
                'JWT_REFRESH_SECRET',
              ),
              expiresIn: this.getRefreshTokenExpiresIn(),
            },
          );

        const replacementRefreshTokenHash = await bcrypt.hash(
          replacementRefreshToken,
          12,
        );

        await tx.session.create({
          data: {
            userId: user.id,
            jti: newJti,
            refreshTokenHash: replacementRefreshTokenHash,
            expiresAt: this.getTokenExpirationDate(
              replacementRefreshToken,
            ),
          },
        });

        return replacementRefreshToken;
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Unable to refresh session',
      );
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async getCurrentUser(userId: number) {
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
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async logout(refreshToken: string) {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>(
            'JWT_REFRESH_SECRET',
          ),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload.sub || !payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.session.findUnique({
      where: {
        jti: payload.jti,
      },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.revokedAt) {
      return {
        message: 'Already logged out',
      };
    }

    const tokenMatches = await bcrypt.compare(
      refreshToken,
      session.refreshTokenHash,
    );

    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return {
      message: 'Logged out successfully',
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private getRefreshTokenExpiresIn(): JwtSignOptions['expiresIn'] {
    return this.configService.getOrThrow<JwtSignOptions['expiresIn']>(
      'JWT_REFRESH_EXPIRES_IN',
    );
  }

  private getTokenExpirationDate(token: string): Date {
    const payload = this.jwtService.decode<RefreshTokenPayload>(token);

    if (!payload || typeof payload === 'string' || !payload.exp) {
      throw new InternalServerErrorException(
        'Unable to determine refresh token expiration',
      );
    }

    return new Date(payload.exp * 1000);
  }
}