import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AiProviderCryptoService } from '../ai-providers/crypto/ai-provider-crypto.service';

import { AiProviderManagerService } from './providers/ai-provider-manager.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly cryptoService: AiProviderCryptoService,
    private readonly aiProviderManager: AiProviderManagerService,
  ) {}

  async sendMessage(
    userId: number,
    prompt: string,
    providerId?: number,
    conversationId?: number,
  ) {
    if (!prompt.trim()) {
      throw new BadRequestException(
        'Prompt cannot be empty',
      );
    }

    const provider =
      await this.getProvider(providerId);

    let conversation;

    if (conversationId !== undefined) {
      conversation =
        await this.prisma.chatConversation.findFirst({
          where: {
            id: conversationId,
            userId,
          },
        });

      if (!conversation) {
        throw new NotFoundException(
          'Conversation not found',
        );
      }
    } else {
      conversation =
        await this.prisma.chatConversation.create({
          data: {
            userId,
            providerId: provider.id,
            title: prompt.trim().slice(0, 100),
          },
        });
    }

    const apiKey = provider.apiKeyEncrypted
      ? this.cryptoService.decrypt(
          provider.apiKeyEncrypted,
        )
      : null;

    if (!apiKey) {
      throw new BadRequestException(
        'AI provider API key is not configured',
      );
    }

    const previousMessages =
      await this.prisma.chatMessage.findMany({
        where: {
          conversationId: conversation.id,
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          role: true,
          content: true,
        },
      });

    const conversationHistory =
      previousMessages.filter(
        (
          message,
        ): message is {
          role: 'user' | 'assistant';
          content: string;
        } =>
          message.role === 'user' ||
          message.role === 'assistant',
      );

    const startedAt = Date.now();

    let aiResponse;

    try {
      aiResponse =
        await this.aiProviderManager.chat(
          provider.type,
          {
            apiKey,
            prompt: prompt.trim(),
            conversation: conversationHistory,
          },
        );
    } catch (error) {
      const responseTime = Date.now() - startedAt;

      await this.prisma.aPIUsageLog.create({
        data: {
          userId,
          endpoint: '/chat',
          method: 'POST',
          provider: provider.type,
          statusCode: 502,
          responseTime,
        },
      });

      throw error;
    }

    const responseTime = Date.now() - startedAt;

    await this.prisma.aPIUsageLog.create({
      data: {
        userId,
        endpoint: '/chat',
        method: 'POST',
        provider: provider.type,
        statusCode: 200,
        responseTime,
      },
    });

    await this.prisma.chatMessage.createMany({
      data: [
        {
          conversationId: conversation.id,
          role: 'user',
          content: prompt.trim(),
        },
        {
          conversationId: conversation.id,
          role: 'assistant',
          content: aiResponse.content,
        },
      ],
    });

    const usage =
      await this.subscriptionsService.consumeRequest(
        userId,
      );

    return {
      conversationId: conversation.id,
      provider: {
        id: provider.id,
        name: provider.name,
        type: provider.type,
      },
      message: aiResponse.content,
      usage,
    };
  }

  async getConversations(userId: number) {
    return this.prisma.chatConversation.findMany({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        providerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getConversation(
    userId: number,
    conversationId: number,
  ) {
    const conversation =
      await this.prisma.chatConversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          messages: {
            orderBy: {
              createdAt: 'asc',
            },
            select: {
              id: true,
              role: true,
              content: true,
              createdAt: true,
            },
          },
        },
      });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found',
      );
    }

    return conversation;
  }

  async deleteConversation(
    userId: number,
    conversationId: number,
  ) {
    const conversation =
      await this.prisma.chatConversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
      });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found',
      );
    }

    await this.prisma.chatConversation.delete({
      where: {
        id: conversationId,
      },
    });

    return {
      message: 'Conversation deleted successfully',
    };
  }

  private async getProvider(providerId?: number) {
    if (providerId !== undefined) {
      const provider =
        await this.prisma.aIProvider.findUnique({
          where: {
            id: providerId,
          },
        });

      if (!provider || !provider.isEnabled) {
        throw new NotFoundException(
          'Enabled AI provider not found',
        );
      }

      return provider;
    }

    const provider =
      await this.prisma.aIProvider.findFirst({
        where: {
          isEnabled: true,
          isDefault: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    if (!provider) {
      throw new NotFoundException(
        'No default AI provider is available',
      );
    }

    return provider;
  }
}