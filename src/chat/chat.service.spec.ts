import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AiProviderCryptoService } from '../ai-providers/crypto/ai-provider-crypto.service';
import { AiProviderManagerService } from './providers/ai-provider-manager.service';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;
  let tx: any;
  let subscriptionsService: any;
  let cryptoService: any;
  let aiProviderManager: any;

  const provider = {
    id: 5,
    name: 'OpenAI',
    type: 'OPENAI',
    apiKeyEncrypted: 'encrypted-key',
    isEnabled: true,
    isDefault: true,
  };

  const reservation = {
    reservation: {
      subscriptionId: 7,
      periodStart: new Date('2026-09-01T00:00:00.000Z'),
    },
    usage: {
      usedRequests: 1,
      requestLimit: 100,
      remainingRequests: 99,
    },
  };

  beforeEach(async () => {
    tx = {
      chatConversation: {
        create: jest.fn().mockResolvedValue({ id: 11 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      chatMessage: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };

    prisma = {
      aIProvider: {
        findFirst: jest.fn().mockResolvedValue(provider),
        findUnique: jest.fn(),
      },
      chatConversation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
      chatMessage: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      aPIUsageLog: {
        create: jest.fn().mockResolvedValue({ id: 21 }),
      },
      $transaction: jest.fn((operation: any) =>
        Array.isArray(operation) ? Promise.all(operation) : operation(tx),
      ),
    };

    subscriptionsService = {
      reserveRequest: jest.fn().mockResolvedValue(reservation),
      refundRequest: jest.fn().mockResolvedValue(undefined),
    };

    cryptoService = {
      decrypt: jest.fn().mockReturnValue('provider-api-key'),
    };

    aiProviderManager = {
      isSupported: jest.fn().mockReturnValue(true),
      chat: jest.fn().mockResolvedValue({
        content: 'AI response',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: SubscriptionsService, useValue: subscriptionsService },
        { provide: AiProviderCryptoService, useValue: cryptoService },
        { provide: AiProviderManagerService, useValue: aiProviderManager },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('creates a conversation and persists both messages after successful AI response', async () => {
    const result = await service.sendMessage(42, '  Hello AI  ');

    expect(subscriptionsService.reserveRequest).toHaveBeenCalledTimes(1);
    expect(subscriptionsService.refundRequest).not.toHaveBeenCalled();
    expect(aiProviderManager.chat).toHaveBeenCalledWith(
      'OPENAI',
      expect.objectContaining({
        apiKey: 'provider-api-key',
        prompt: 'Hello AI',
        conversation: [],
      }),
    );
    expect(tx.chatConversation.create).toHaveBeenCalledWith({
      data: {
        userId: 42,
        providerId: 5,
        title: 'Hello AI',
        updatedAt: expect.any(Date),
      },
    });
    expect(tx.chatMessage.createMany).toHaveBeenCalledWith({
      data: [
        {
          conversationId: 11,
          role: 'user',
          content: 'Hello AI',
        },
        {
          conversationId: 11,
          role: 'assistant',
          content: 'AI response',
        },
      ],
    });
    expect(prisma.$transaction.mock.invocationCallOrder[0]).toBeGreaterThan(
      aiProviderManager.chat.mock.invocationCallOrder[0],
    );
    expect(result).toEqual({
      conversationId: 11,
      provider: {
        id: 5,
        name: 'OpenAI',
        type: 'OPENAI',
      },
      message: 'AI response',
      usage: reservation.usage,
    });
  });

  it('does not create a conversation or reserve quota when the provider key is missing', async () => {
    prisma.aIProvider.findFirst.mockResolvedValue({
      ...provider,
      apiKeyEncrypted: null,
    });

    await expect(service.sendMessage(42, 'Hello AI')).rejects.toThrow(
      BadRequestException,
    );

    expect(subscriptionsService.reserveRequest).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(aiProviderManager.chat).not.toHaveBeenCalled();
  });

  it('does not create a conversation when provider-key decryption fails', async () => {
    cryptoService.decrypt.mockImplementation(() => {
      throw new Error('private key detail');
    });

    await expect(service.sendMessage(42, 'Hello AI')).rejects.toThrow(
      'AI provider API key is unavailable',
    );

    expect(subscriptionsService.reserveRequest).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not create a conversation when quota reservation is rejected', async () => {
    subscriptionsService.reserveRequest.mockRejectedValue(
      new BadRequestException('Monthly request limit exceeded'),
    );

    await expect(service.sendMessage(42, 'Hello AI')).rejects.toThrow(
      BadRequestException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(aiProviderManager.chat).not.toHaveBeenCalled();
  });

  it('refunds quota and leaves no new conversation when the provider fails', async () => {
    aiProviderManager.chat.mockRejectedValue(
      new Error('raw upstream error with confidential detail'),
    );

    try {
      await service.sendMessage(42, 'Hello AI');
      fail('Expected the provider failure to be converted to an API error');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as Error).message).not.toContain('confidential detail');
    }

    expect(subscriptionsService.refundRequest).toHaveBeenCalledWith(
      42,
      reservation.reservation,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.chatConversation.create).not.toHaveBeenCalled();
    expect(tx.chatMessage.createMany).not.toHaveBeenCalled();
    expect(prisma.aPIUsageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 42,
        endpoint: '/chat',
        statusCode: 502,
      }),
    });
  });

  it('maps provider timeouts to a controlled sanitized API error', async () => {
    aiProviderManager.chat.mockRejectedValue(
      new DOMException('private endpoint and key detail', 'TimeoutError'),
    );

    try {
      await service.sendMessage(42, 'Hello AI');
      fail('Expected the provider timeout to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as Error).message).not.toContain('private endpoint');
    }

    expect(subscriptionsService.refundRequest).toHaveBeenCalledWith(
      42,
      reservation.reservation,
    );
    expect(tx.chatConversation.create).not.toHaveBeenCalled();
  });

  it('continues an owned conversation and updates its activity timestamp', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({
      id: 88,
      userId: 42,
      providerId: 5,
    });
    prisma.chatMessage.findMany.mockResolvedValue([
      { role: 'user', content: 'Earlier question' },
      { role: 'assistant', content: 'Earlier answer' },
    ]);

    const result = await service.sendMessage(42, 'Follow-up', undefined, 88);

    expect(prisma.chatConversation.findFirst).toHaveBeenCalledWith({
      where: { id: 88, userId: 42 },
    });
    expect(aiProviderManager.chat).toHaveBeenCalledWith(
      'OPENAI',
      expect.objectContaining({
        conversation: [
          { role: 'user', content: 'Earlier question' },
          { role: 'assistant', content: 'Earlier answer' },
        ],
      }),
    );
    expect(tx.chatConversation.updateMany).toHaveBeenCalledWith({
      where: { id: 88, userId: 42 },
      data: { updatedAt: expect.any(Date) },
    });
    expect(tx.chatConversation.create).not.toHaveBeenCalled();
    expect(tx.chatMessage.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ conversationId: 88, role: 'user' }),
        expect.objectContaining({ conversationId: 88, role: 'assistant' }),
      ]),
    });
    expect(result.conversationId).toBe(88);
  });

  it('paginates only the authenticated user’s conversations with deterministic ordering', async () => {
    const pageData = [{ id: 15, title: 'Recent', providerId: 5 }];
    prisma.chatConversation.findMany.mockResolvedValue(pageData);
    prisma.chatConversation.count.mockResolvedValue(21);

    const result = await service.getConversations(42, {
      page: 2,
      limit: 10,
    });

    expect(prisma.chatConversation.findMany).toHaveBeenCalledWith({
      where: { userId: 42 },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: 10,
      take: 10,
      select: {
        id: true,
        title: true,
        providerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(prisma.chatConversation.count).toHaveBeenCalledWith({
      where: { userId: 42 },
    });
    expect(result).toEqual({
      data: pageData,
      meta: { page: 2, limit: 10, total: 21, totalPages: 3 },
    });
  });

  it('does not refund quota when persistence fails after provider success', async () => {
    tx.chatMessage.createMany.mockRejectedValue(
      new Error('database detail'),
    );

    await expect(service.sendMessage(42, 'Hello AI')).rejects.toThrow(
      InternalServerErrorException,
    );

    expect(subscriptionsService.refundRequest).not.toHaveBeenCalled();
    expect(prisma.aPIUsageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ statusCode: 500 }),
    });
  });

  it('does not fail a successful persisted chat if its non-critical usage log fails', async () => {
    prisma.aPIUsageLog.create.mockRejectedValue(new Error('log database error'));

    await expect(service.sendMessage(42, 'Hello AI')).resolves.toMatchObject({
      conversationId: 11,
      message: 'AI response',
    });

    expect(subscriptionsService.refundRequest).not.toHaveBeenCalled();
    expect(tx.chatMessage.createMany).toHaveBeenCalledTimes(1);
  });

  it('does not reserve quota for an empty prompt', async () => {
    await expect(service.sendMessage(42, '   ')).rejects.toThrow(
      BadRequestException,
    );

    expect(subscriptionsService.reserveRequest).not.toHaveBeenCalled();
    expect(aiProviderManager.chat).not.toHaveBeenCalled();
  });

  it('does not reserve quota for a conversation owned by another user', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue(null);

    await expect(
      service.sendMessage(42, 'Hello AI', undefined, 999),
    ).rejects.toThrow(NotFoundException);

    expect(subscriptionsService.reserveRequest).not.toHaveBeenCalled();
    expect(aiProviderManager.chat).not.toHaveBeenCalled();
  });
});
