import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { App } from 'supertest/types';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController admin user pagination', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let usersService: { getAllUsers: jest.Mock };

  const jwtSecret = 'users-controller-test-secret';
  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: number } }) => ({
        id: where.id,
        email: `user${where.id}@example.com`,
        deletedAt: null,
      })),
    },
    userRole: {
      findMany: jest.fn(async ({ where }: { where: { userId: number } }) => [
        { role: { name: where.userId === 1 ? 'ADMIN' : 'USER' } },
      ]),
    },
  };

  beforeAll(async () => {
    usersService = {
      getAllUsers: jest.fn().mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: jwtSecret })],
      controllers: [UsersController],
      providers: [
        JwtAuthGuard,
        RolesGuard,
        JwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: () => jwtSecret } },
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  const bearerToken = async (userId: number) =>
    jwtService.signAsync({ sub: userId, email: `user${userId}@example.com` });

  it('requires authentication and the ADMIN role', async () => {
    await request(app.getHttpServer()).get('/users/admin/users').expect(401);

    const userToken = await bearerToken(2);
    await request(app.getHttpServer())
      .get('/users/admin/users?page=2&limit=10')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    expect(usersService.getAllUsers).not.toHaveBeenCalled();
  });

  it('passes validated pagination to the admin user service', async () => {
    const adminToken = await bearerToken(1);

    await request(app.getHttpServer())
      .get('/users/admin/users?page=2&limit=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(usersService.getAllUsers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 10 }),
    );
  });
});
