import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
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
});