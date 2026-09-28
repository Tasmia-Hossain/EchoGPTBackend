import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let tx: any;

  beforeEach(async () => {
    tx = {
      user: {
        update: jest.fn(),
      },
      session: {
        updateMany: jest.fn(),
      },
    };

    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (operation: (transaction: any) => unknown) =>
        operation(tx),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('updateProfile', () => {
    it('trims and lowercases the email while preserving other profile fields', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'old@example.com',
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({
        id: 1,
        email: 'new@example.com',
        name: 'Updated Name',
        isEmailVerified: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      });

      const result = await service.updateProfile(1, {
        email: '  New@Example.COM ',
        name: 'Updated Name',
      });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: {
            equals: 'new@example.com',
            mode: 'insensitive',
          },
          id: {
            not: 1,
          },
        },
        select: {
          id: true,
        },
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: {
          id: 1,
        },
        data: {
          email: 'new@example.com',
          name: 'Updated Name',
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

      expect(result.email).toBe('new@example.com');
      expect(result.name).toBe('Updated Name');
    });

    it('rejects an email already used with different casing', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'old@example.com',
      });
      prisma.user.findFirst.mockResolvedValue({ id: 2 });

      await expect(
        service.updateProfile(1, {
          email: '  OTHER@EXAMPLE.COM ',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('converts a concurrent email unique-constraint race into a conflict', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'old@example.com',
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.update.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.updateProfile(1, {
          email: 'new@example.com',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('does not perform an email lookup when only the name changes', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'old@example.com',
      });
      prisma.user.update.mockResolvedValue({
        id: 1,
        email: 'old@example.com',
        name: 'New Name',
      });

      await service.updateProfile(1, {
        name: 'New Name',
      });

      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: 'New Name',
          },
        }),
      );
    });

    it('reports a missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile(1, {
          email: 'new@example.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('changePassword', () => {
    const currentPassword = 'CurrentPassword123!';
    const newPassword = 'NewStrongPassword123!';

    async function setUpUser() {
      prisma.user.findUnique.mockResolvedValue({
        id: 42,
        passwordHash: await bcrypt.hash(currentPassword, 4),
      });
      tx.user.update.mockResolvedValue({ id: 42 });
      tx.session.updateMany.mockResolvedValue({ count: 2 });
    }

    it('changes the password and atomically revokes all active refresh sessions for that user', async () => {
      await setUpUser();

      const result = await service.changePassword(
        42,
        currentPassword,
        newPassword,
      );

      expect(result).toEqual({ message: 'Password changed successfully' });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: {
          passwordHash: expect.not.stringMatching(/^NewStrongPassword123!$/),
        },
      });
      expect(tx.session.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 42,
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
      expect(
        tx.user.update.mock.invocationCallOrder[0],
      ).toBeLessThan(tx.session.updateMany.mock.invocationCallOrder[0]);
    });

    it('does not revoke sessions when the current password is incorrect', async () => {
      await setUpUser();

      await expect(
        service.changePassword(42, 'incorrect-current-password', newPassword),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.session.updateMany).not.toHaveBeenCalled();
    });

    it('does not attempt session revocation if the password update fails', async () => {
      await setUpUser();
      tx.user.update.mockRejectedValue(new Error('password update failed'));

      await expect(
        service.changePassword(42, currentPassword, newPassword),
      ).rejects.toThrow('password update failed');

      expect(tx.session.updateMany).not.toHaveBeenCalled();
    });

    it('limits revocation to the changing user and leaves other users sessions untouched', async () => {
      await setUpUser();

      await service.changePassword(42, currentPassword, newPassword);

      expect(tx.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 42,
            revokedAt: null,
          },
        }),
      );
    });
  });
});
