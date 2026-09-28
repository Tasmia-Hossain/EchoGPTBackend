import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AiProviderCryptoService } from '../ai-providers/crypto/ai-provider-crypto.service';
import { AiProviderManagerService } from './providers/ai-provider-manager.service';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;
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
    prisma = {
      aIProvider: {
        findFirst: jest.fn().mockResolvedValue(provider),
        findUnique: jest.fn(),
      },
      chatConversation: {
        create: jest.fn().mockResolvedValue({
          id: 11,
          userId: 42,
          providerId: 5,
        }),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      chatMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      aPIUsageLog: {
        create: jest.fn().mockResolvedValue({ id: 21 }),
      },
    };

    subscriptionsService = {
      checkRequestAvailability: jest.fn().mockResolvedValue({
        remainingRequests: 100,
      }),
      reserveRequest: jest.fn().mockResolvedValue(reservation),
      refundRequest: jest.fn().mockResolvedValue(undefined),
    };

    cryptoService = {
      decrypt: jest.fn().mockReturnValue('provider-api-key'),
    };

    aiProviderManager = {
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

  it('reserves exactly one request after a successful AI response', async () => {
    const result = await service.sendMessage(
      42,
      '  Hello AI  ',
    );

    expect(subscriptionsService.checkRequestAvailability).toHaveBeenCalledWith(42);
    expect(subscriptionsService.reserveRequest).toHaveBeenCalledTimes(1);
    expect(subscriptionsService.refundRequest).not.toHaveBeenCalled();
    expect(subscriptionsService.consumeRequest).toBeUndefined();

    expect(aiProviderManager.chat).toHaveBeenCalledWith(
      'OPENAI',
      expect.objectContaining({
        apiKey: 'provider-api-key',
        prompt: 'Hello AI',
        conversation: [],
      }),
    );

    expect(prisma.chatMessage.createMany).toHaveBeenCalledWith({
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

  it('refunds the reservation when the AI provider call fails', async () => {
    const providerError = new Error('provider unavailable');
    aiProviderManager.chat.mockRejectedValue(providerError);

    await expect(
      service.sendMessage(42, 'Hello AI'),
    ).rejects.toBe(providerError);

    expect(subscriptionsService.reserveRequest).toHaveBeenCalledTimes(1);
    expect(subscriptionsService.refundRequest).toHaveBeenCalledWith(
      42,
      reservation.reservation,
    );
    expect(prisma.chatMessage.createMany).not.toHaveBeenCalled();
    expect(prisma.aPIUsageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 42,
        endpoint: '/chat',
        statusCode: 502,
      }),
    });
  });

  it('does not reserve quota for an empty prompt', async () => {
    await expect(
      service.sendMessage(42, '   '),
    ).rejects.toThrow();

    expect(subscriptionsService.reserveRequest).not.toHaveBeenCalled();
    expect(aiProviderManager.chat).not.toHaveBeenCalled();
  });

  it('does not reserve quota for a conversation owned by another user', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue(null);

    await expect(
      service.sendMessage(42, 'Hello AI', undefined, 999),
    ).rejects.toThrow();

    expect(subscriptionsService.reserveRequest).not.toHaveBeenCalled();
    expect(aiProviderManager.chat).not.toHaveBeenCalled();
  });
});