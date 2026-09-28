import 'reflect-metadata';
import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
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
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsController admin routes', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let subscriptionsService: Record<string, jest.Mock>;

  const jwtSecret = 'subscriptions-controller-test-secret';
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
    subscriptionsService = {
      getAllSubscriptions: jest.fn().mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
      getAdminSubscriptionForUser: jest.fn().mockResolvedValue({ id: 7 }),
      updateUserPlan: jest.fn().mockResolvedValue({ id: 7, plan: 'PREMIUM' }),
      updateUserStatus: jest.fn().mockResolvedValue({ id: 7, status: 'INACTIVE' }),
      getMySubscription: jest.fn(),
      upgrade: jest.fn(),
      downgrade: jest.fn(),
      getUsage: jest.fn(),
      checkRequestAvailability: jest.fn(),
      reserveRequest: jest.fn(),
      refundRequest: jest.fn(),
      consumeRequest: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({ secret: jwtSecret }),
      ],
      controllers: [SubscriptionsController],
      providers: [
        JwtAuthGuard,
        RolesGuard,
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => jwtSecret },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: SubscriptionsService, useValue: subscriptionsService },
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const bearerToken = async (userId: number) =>
    jwtService.signAsync({ sub: userId, email: `user${userId}@example.com` });

  it('returns 401 for an unauthenticated admin request', async () => {
    await request(app.getHttpServer()).get('/subscriptions/admin').expect(401);
  });

  it('returns 403 when an authenticated USER accesses admin subscriptions', async () => {
    const token = await bearerToken(2);

    await request(app.getHttpServer())
      .get('/subscriptions/admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('allows an ADMIN to list and view subscriptions', async () => {
    const token = await bearerToken(1);

    await request(app.getHttpServer())
      .get('/subscriptions/admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

    await request(app.getHttpServer())
      .get('/subscriptions/admin?page=2&limit=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(subscriptionsService.getAllSubscriptions).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ page: 1, limit: 20 }),
    );
    expect(subscriptionsService.getAllSubscriptions).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ page: 2, limit: 5 }),
    );

    await request(app.getHttpServer())
      .get('/subscriptions/admin/users/42')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ id: 7 });

    expect(subscriptionsService.getAdminSubscriptionForUser).toHaveBeenCalledWith(42);
  });

  it('allows an ADMIN to change a user plan and status', async () => {
    const token = await bearerToken(1);

    await request(app.getHttpServer())
      .patch('/subscriptions/admin/users/42/plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'PREMIUM' })
      .expect(200)
      .expect({ id: 7, plan: 'PREMIUM' });

    await request(app.getHttpServer())
      .patch('/subscriptions/admin/users/42/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'INACTIVE' })
      .expect(200)
      .expect({ id: 7, status: 'INACTIVE' });

    expect(subscriptionsService.updateUserPlan).toHaveBeenCalledWith(42, 'PREMIUM');
    expect(subscriptionsService.updateUserStatus).toHaveBeenCalledWith(42, 'INACTIVE');
  });

  it('rejects invalid plan and status values before calling the service', async () => {
    const token = await bearerToken(1);

    await request(app.getHttpServer())
      .patch('/subscriptions/admin/users/42/plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'ENTERPRISE' })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/subscriptions/admin/users/42/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CANCELLED' })
      .expect(400);

    expect(subscriptionsService.updateUserPlan).not.toHaveBeenCalled();
    expect(subscriptionsService.updateUserStatus).not.toHaveBeenCalled();
  });

  it('rejects invalid pagination query values', async () => {
    const token = await bearerToken(1);

    await request(app.getHttpServer())
      .get('/subscriptions/admin?page=0&limit=101')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('rejects invalid user IDs and returns 404 for a missing subscription', async () => {
    const token = await bearerToken(1);
    subscriptionsService.getAdminSubscriptionForUser.mockRejectedValueOnce(
      new NotFoundException('Subscription not found'),
    );

    await request(app.getHttpServer())
      .get('/subscriptions/admin/users/not-an-id')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await request(app.getHttpServer())
      .get('/subscriptions/admin/users/999')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
