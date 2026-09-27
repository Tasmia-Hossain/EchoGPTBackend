import { Test } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwt: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
      subscription: { create: jest.fn() },
      session: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((cb) => cb(prisma)),
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('token'), verifyAsync: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('secret') } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('creates a user with a hashed password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 1, email: 'a@a.com', name: 'A' });

      const result = await service.register('a@a.com', 'password123', 'A');

      expect(result).toEqual({ id: 1, email: 'a@a.com', name: 'A' });
      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data.passwordHash).not.toBe('password123');
    });

    it('rejects duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'a@a.com' });

      await expect(
        service.register('a@a.com', 'password123'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('rejects wrong password', async () => {
      const hash = await bcrypt.hash('correct', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 1, email: 'a@a.com', passwordHash: hash, deletedAt: null,
      });

      await expect(
        service.login('a@a.com', 'wrong'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login('nope@a.com', 'x'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});