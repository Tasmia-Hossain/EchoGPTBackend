import { Test } from '@nestjs/testing';
import {
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let tx: any;
  let jwt: any;
  let configService: any;

  beforeEach(async () => {
    tx = {
      role: {
        findUnique: jest.fn().mockResolvedValue({ id: 10 }),
      },
      user: {
        create: jest.fn().mockResolvedValue({
          id: 1,
          email: 'alice@example.com',
          name: 'Alice',
        }),
      },
      userRole: {
        create: jest.fn().mockResolvedValue({ userId: 1, roleId: 10 }),
      },
      subscription: {
        create: jest.fn().mockResolvedValue({ id: 20 }),
      },
      session: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 31 }),
      },
    };

    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      session: {
        create: jest.fn().mockResolvedValue({ id: 30 }),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (operation: any) => {
        if (typeof operation === 'function') {
          return operation(tx);
        }
        return Promise.all(operation);
      }),
    };

    jwt = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
      decode: jest.fn().mockReturnValue({ exp: 2_000_000_000 }),
    };

    configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') {
          return 'test-refresh-secret';
        }
        if (key === 'JWT_REFRESH_EXPIRES_IN') {
          return '7d';
        }
        throw new Error(`Unexpected config key: ${key}`);
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('normalizes email and atomically creates the user, USER role, and Free subscription', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const result = await service.register(
        '  Alice@Example.COM ',
        'password123',
        'Alice',
      );

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: {
            equals: 'alice@example.com',
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
        },
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.role.findUnique).toHaveBeenCalledWith({
        where: { name: 'USER' },
        select: { id: true },
      });

      expect(tx.user.create).toHaveBeenCalledWith({
        data: {
          email: 'alice@example.com',
          passwordHash: expect.not.stringMatching(/^password123$/),
          name: 'Alice',
        },
      });

      expect(tx.userRole.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          roleId: 10,
        },
      });

      expect(tx.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 1,
          plan: 'FREE',
          status: 'ACTIVE',
          requestLimit: 100,
          usedRequests: 0,
        }),
      });

      expect(result).toEqual({
        id: 1,
        email: 'alice@example.com',
        name: 'Alice',
      });
    });

    it('rejects an existing email regardless of case or incoming whitespace', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 9 });

      await expect(
        service.register('  ALICE@EXAMPLE.COM  ', 'password123'),
      ).rejects.toThrow(ConflictException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.user.create).not.toHaveBeenCalled();
    });

    it('fails safely when the USER role is missing and does not create a user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      tx.role.findUnique.mockResolvedValue(null);

      await expect(
        service.register('alice@example.com', 'password123'),
      ).rejects.toThrow(InternalServerErrorException);

      expect(tx.user.create).not.toHaveBeenCalled();
      expect(tx.userRole.create).not.toHaveBeenCalled();
      expect(tx.subscription.create).not.toHaveBeenCalled();
    });

    it('converts a concurrent email unique-constraint race into a conflict', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.register('alice@example.com', 'password123'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('finds an account using a trimmed, case-insensitive email', async () => {
      const user = {
        id: 1,
        email: 'alice@example.com',
        name: 'Alice',
        passwordHash: await bcrypt.hash('password123', 4),
        deletedAt: null,
      };
      prisma.user.findFirst.mockResolvedValue(user);

      const result = await service.login(
        '  ALICE@Example.COM ',
        'password123',
      );

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: {
            equals: 'alice@example.com',
            mode: 'insensitive',
          },
        },
      });
      expect(result.user).toEqual({
        id: 1,
        email: 'alice@example.com',
        name: 'Alice',
      });
      expect(jwt.signAsync).toHaveBeenNthCalledWith(1, {
        sub: 1,
        email: 'alice@example.com',
      });
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 1,
          refreshTokenHash: expect.any(String),
          expiresAt: new Date(2_000_000_000 * 1000),
        }),
      });
    });

    it('rejects a wrong password', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 1,
        email: 'alice@example.com',
        passwordHash: await bcrypt.hash('correct-password', 4),
        deletedAt: null,
      });

      await expect(
        service.login('alice@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an unknown email', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login('nobody@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    const presentedRefreshToken = 'presented-refresh-token';
    const oldSession = {
      id: 40,
      userId: 1,
      jti: 'old-jti',
      refreshTokenHash: '',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      revokedAt: null,
    };

    async function setUpValidRefresh() {
      oldSession.refreshTokenHash = await bcrypt.hash(
        presentedRefreshToken,
        4,
      );

      jwt.verifyAsync.mockResolvedValue({
        sub: 1,
        jti: 'old-jti',
      });

      prisma.session.findUnique.mockResolvedValue({ ...oldSession });

      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'alice@example.com',
        name: 'Alice',
        deletedAt: null,
      });
    }

    it('atomically revokes the old session and creates a replacement with JWT exp', async () => {
      await setUpValidRefresh();

      const result = await service.refresh(presentedRefreshToken);

      expect(jwt.verifyAsync).toHaveBeenCalledWith(
        presentedRefreshToken,
        {
          secret: 'test-refresh-secret',
        },
      );

      expect(tx.session.updateMany).toHaveBeenCalledWith({
        where: {
          id: 40,
          userId: 1,
          jti: 'old-jti',
          revokedAt: null,
          expiresAt: {
            gt: expect.any(Date),
          },
          user: {
            is: {
              deletedAt: null,
            },
          },
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });

      expect(tx.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 1,
          refreshTokenHash: expect.any(String),
          expiresAt: new Date(2_000_000_000 * 1000),
        }),
      });

      expect(
        tx.session.updateMany.mock.invocationCallOrder[0],
      ).toBeLessThan(
        tx.session.create.mock.invocationCallOrder[0],
      );

      expect(jwt.signAsync).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          sub: 1,
          jti: expect.any(String),
        }),
        {
          secret: 'test-refresh-secret',
          expiresIn: '7d',
        },
      );

      expect(jwt.signAsync).toHaveBeenNthCalledWith(2, {
        sub: 1,
        email: 'alice@example.com',
      });

      expect(result).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
        user: {
          id: 1,
          email: 'alice@example.com',
          name: 'Alice',
        },
      });
    });

    it('rejects refresh for a deleted user without rotating or issuing tokens', async () => {
      await setUpValidRefresh();
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'alice@example.com',
        name: 'Alice',
        deletedAt: new Date(),
      });

      await expect(
        service.refresh(presentedRefreshToken),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(jwt.signAsync).not.toHaveBeenCalled();
      expect(tx.session.create).not.toHaveBeenCalled();
    });

    it('rejects a refresh token whose session was revoked by password change', async () => {
      await setUpValidRefresh();
      prisma.session.findUnique.mockResolvedValue({
        ...oldSession,
        revokedAt: new Date(),
      });

      await expect(
        service.refresh(presentedRefreshToken),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.session.create).not.toHaveBeenCalled();
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('rejects a concurrent replay when the atomic revocation affects no session', async () => {
      await setUpValidRefresh();

      let sessionIsActive = true;
      tx.session.updateMany.mockImplementation(async () => {
        if (!sessionIsActive) {
          return { count: 0 };
        }

        sessionIsActive = false;
        return { count: 1 };
      });

      const results = await Promise.allSettled([
        service.refresh(presentedRefreshToken),
        service.refresh(presentedRefreshToken),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);

      const rejectedResult = results.find(
        (result) => result.status === 'rejected',
      ) as PromiseRejectedResult;

      expect(rejectedResult.reason).toBeInstanceOf(UnauthorizedException);
      expect(tx.session.updateMany).toHaveBeenCalledTimes(2);
      expect(tx.session.create).toHaveBeenCalledTimes(1);
    });

    it('rejects when atomic revocation finds the session already revoked', async () => {
      await setUpValidRefresh();
      tx.session.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.refresh(presentedRefreshToken),
      ).rejects.toThrow(UnauthorizedException);

      expect(tx.session.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid refresh-token hash without rotating the session', async () => {
      await setUpValidRefresh();
      prisma.session.findUnique.mockResolvedValue({
        ...oldSession,
        refreshTokenHash: await bcrypt.hash('different-token', 4),
      });

      await expect(
        service.refresh(presentedRefreshToken),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.session.create).not.toHaveBeenCalled();
    });

    it('does not expose internal database errors from rotation', async () => {
      await setUpValidRefresh();
      prisma.$transaction.mockRejectedValue(new Error('database detail'));

      await expect(
        service.refresh(presentedRefreshToken),
      ).rejects.toThrow(InternalServerErrorException);

      await expect(
        service.refresh(presentedRefreshToken),
      ).rejects.not.toThrow('database detail');
    });
  });
});
