import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AiProviderCryptoService } from '../ai-providers/crypto/ai-provider-crypto.service';

import { AiProviderManagerService } from './providers/ai-provider-manager.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginationSkip, toPaginatedResponse } from '../common/pagination';

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
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      throw new BadRequestException('Prompt cannot be empty');
    }

    const provider = await this.getProvider(providerId);
    if (!this.aiProviderManager.isSupported(provider.type)) {
      throw new BadRequestException('Selected AI provider is not supported');
    }

    let apiKey: string | null;
    try {
      apiKey = provider.apiKeyEncrypted
        ? this.cryptoService.decrypt(provider.apiKeyEncrypted)
        : null;
    } catch {
      throw new BadRequestException('AI provider API key is unavailable');
    }

    if (!apiKey) {
      throw new BadRequestException('AI provider API key is not configured');
    }

    let conversation: { id: number } | null = null;

    if (conversationId !== undefined) {
      conversation = await this.prisma.chatConversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
      });

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }
    }

    const previousMessages = conversation
      ? await this.prisma.chatMessage.findMany({
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
        })
      : [];

    const conversationHistory = previousMessages.filter(
      (
        message,
      ): message is {
        role: 'user' | 'assistant';
        content: string;
      } =>
        message.role === 'user' || message.role === 'assistant',
    );

    const reservation = await this.subscriptionsService.reserveRequest(userId);

    const startedAt = Date.now();
    let aiResponse: { content: string };

    try {
      aiResponse = await this.aiProviderManager.chat(provider.type, {
        apiKey,
        prompt: trimmedPrompt,
        conversation: conversationHistory,
      });
    } catch {
      const responseTime = Date.now() - startedAt;

      try {
        await this.subscriptionsService.refundRequest(
          userId,
          reservation.reservation,
        );
      } catch {
        throw new InternalServerErrorException(
          'Unable to restore request quota after AI provider failure',
        );
      }

      await this.tryWriteUsageLog({
        userId,
        endpoint: '/chat',
        method: 'POST',
        provider: provider.type,
        statusCode: 502,
        responseTime,
      });

      throw new ServiceUnavailableException(
        'AI provider is currently unavailable. Please try again later.',
      );
    }

    const responseTime = Date.now() - startedAt;
    const completedAt = new Date();
    let persistedConversationId: number;

    try {
      persistedConversationId = await this.prisma.$transaction(async (tx) => {
        let targetConversationId = conversation?.id;

        if (targetConversationId === undefined) {
          const createdConversation = await tx.chatConversation.create({
            data: {
              userId,
              providerId: provider.id,
              title: trimmedPrompt.slice(0, 100),
              updatedAt: completedAt,
            },
          });
          targetConversationId = createdConversation.id;
        } else {
          const updatedConversation = await tx.chatConversation.updateMany({
            where: {
              id: targetConversationId,
              userId,
            },
            data: {
              updatedAt: completedAt,
            },
          });

          if (updatedConversation.count !== 1) {
            throw new NotFoundException('Conversation not found');
          }
        }

        await tx.chatMessage.createMany({
          data: [
            {
              conversationId: targetConversationId,
              role: 'user',
              content: trimmedPrompt,
            },
            {
              conversationId: targetConversationId,
              role: 'assistant',
              content: aiResponse.content,
            },
          ],
        });

        return targetConversationId;
      });
    } catch (error) {
      await this.tryWriteUsageLog({
        userId,
        endpoint: '/chat',
        method: 'POST',
        provider: provider.type,
        statusCode: 500,
        responseTime,
      });

      if (error instanceof NotFoundException) {
        throw error;
      }

      // The external provider succeeded, so its reserved quota remains consumed.
      throw new InternalServerErrorException(
        'AI response was generated but could not be saved. Request usage was retained.',
      );
    }

    // Usage logs are best-effort after the response and messages are safely persisted.
    await this.tryWriteUsageLog({
      userId,
      endpoint: '/chat',
      method: 'POST',
      provider: provider.type,
      statusCode: 200,
      responseTime,
    });

    return {
      conversationId: persistedConversationId,
      provider: {
        id: provider.id,
        name: provider.name,
        type: provider.type,
      },
      message: aiResponse.content,
      usage: reservation.usage,
    };
  }

  private async tryWriteUsageLog(data: {
    userId: number;
    endpoint: string;
    method: string;
    provider: string;
    statusCode: number;
    responseTime: number;
  }): Promise<void> {
    try {
      await this.prisma.aPIUsageLog.create({ data });
    } catch {
      // Logging must not mask provider failures or undo completed chat work.
    }
  }

  async getConversations(userId: number, pagination: PaginationQueryDto) {
    const where = { userId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.chatConversation.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: paginationSkip(pagination.page, pagination.limit),
        take: pagination.limit,
        select: {
          id: true,
          title: true,
          providerId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.chatConversation.count({ where }),
    ]);

    return toPaginatedResponse(
      data,
      pagination.page,
      pagination.limit,
      total,
    );
  }

  async getConversation(
    userId: number,
    conversationId: number,
  ) {
    const conversation = await this.prisma.chatConversation.findFirst({
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
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async deleteConversation(
    userId: number,
    conversationId: number,
  ) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
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
      const provider = await this.prisma.aIProvider.findUnique({
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

    const provider = await this.prisma.aIProvider.findFirst({
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
