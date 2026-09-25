import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

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
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const currentPeriodStart = new Date();

    const currentPeriodEnd = new Date();
    currentPeriodEnd.setDate(
      currentPeriodEnd.getDate() + 30,
    );

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
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
  }

  async login(
    email: string,
    password: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
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
        expiresIn: '7d',
      },
    );

    const refreshTokenHash = await bcrypt.hash(
      refreshToken,
      12,
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        jti,
        refreshTokenHash,
        expiresAt,
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
    let payload: {
      sub: number;
      jti: string;
    };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.getOrThrow<string>(
          'JWT_REFRESH_SECRET',
        ),
      });
    } catch {
      throw new UnauthorizedException(
        'Invalid refresh token',
      );
    }

    if (!payload.sub || !payload.jti) {
      throw new UnauthorizedException(
        'Invalid refresh token',
      );
    }

    const session = await this.prisma.session.findUnique({
      where: {
        jti: payload.jti,
      },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException(
        'Invalid refresh token',
      );
    }

    if (session.revokedAt) {
      throw new UnauthorizedException(
        'Refresh token has been revoked',
      );
    }

    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        'Refresh token has expired',
      );
    }

    const tokenMatches = await bcrypt.compare(
      refreshToken,
      session.refreshTokenHash,
    );

    if (!tokenMatches) {
      throw new UnauthorizedException(
        'Invalid refresh token',
      );
    }

    const newJti = randomUUID();

    const newRefreshToken =
      await this.jwtService.signAsync(
        {
          sub: session.userId,
          jti: newJti,
        },
        {
          secret:
            this.configService.getOrThrow<string>(
              'JWT_REFRESH_SECRET',
            ),
          expiresIn: '7d',
        },
      );

    const newRefreshTokenHash =
      await bcrypt.hash(newRefreshToken, 12);

    const newExpiresAt = new Date();
    newExpiresAt.setDate(
      newExpiresAt.getDate() + 7,
    );

    const newAccessToken =
      await this.jwtService.signAsync({
        sub: session.userId,
      });

    await this.prisma.$transaction([
      this.prisma.session.update({
        where: {
          id: session.id,
        },
        data: {
          revokedAt: new Date(),
        },
      }),

      this.prisma.session.create({
        data: {
          userId: session.userId,
          jti: newJti,
          refreshTokenHash: newRefreshTokenHash,
          expiresAt: newExpiresAt,
        },
      }),
    ]);

    const user = await this.prisma.user.findUnique({
      where: {
        id: session.userId,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'User not found',
      );
    }

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user,
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
    throw new UnauthorizedException(
      'User not found',
    );
  }

  return user;
}

async logout(refreshToken: string) {
  let payload: {
    sub: number;
    jti: string;
  };

  try {
    payload = await this.jwtService.verifyAsync(
      refreshToken,
      {
        secret:
          this.configService.getOrThrow<string>(
            'JWT_REFRESH_SECRET',
          ),
      },
    );
  } catch {
    throw new UnauthorizedException(
      'Invalid refresh token',
    );
  }

  if (!payload.sub || !payload.jti) {
    throw new UnauthorizedException(
      'Invalid refresh token',
    );
  }

  const session =
    await this.prisma.session.findUnique({
      where: {
        jti: payload.jti,
      },
    });

  if (
    !session ||
    session.userId !== payload.sub
  ) {
    throw new UnauthorizedException(
      'Invalid refresh token',
    );
  }

  if (session.revokedAt) {
    return {
      message: 'Already logged out',
    };
  }

  const tokenMatches =
    await bcrypt.compare(
      refreshToken,
      session.refreshTokenHash,
    );

  if (!tokenMatches) {
    throw new UnauthorizedException(
      'Invalid refresh token',
    );
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
}