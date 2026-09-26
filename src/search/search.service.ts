import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

import { WikipediaProvider } from './providers/wikipedia.provider';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly searchProvider: WikipediaProvider,
  ) {}

  async search(userId: number, query: string) {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      throw new BadRequestException('Search query cannot be empty');
    }

    const startedAt = Date.now();

    let results;

    try {
      results = await this.searchProvider.search(trimmedQuery);
    } catch (error) {
      const responseTime = Date.now() - startedAt;

      await this.prisma.aPIUsageLog.create({
        data: {
          userId,
          endpoint: '/search',
          method: 'POST',
          provider: 'WIKIPEDIA',
          statusCode: 502,
          responseTime,
        },
      });

      throw new ServiceUnavailableException(
        'Search provider is currently unavailable',
      );
    }

    const responseTime = Date.now() - startedAt;

    await this.prisma.webSearch.create({
      data: {
        userId,
        query: trimmedQuery,
        provider: 'WIKIPEDIA',
        resultCount: results.length,
      },
    });

    await this.prisma.aPIUsageLog.create({
      data: {
        userId,
        endpoint: '/search',
        method: 'POST',
        provider: 'WIKIPEDIA',
        statusCode: 200,
        responseTime,
      },
    });

    const usage = await this.subscriptionsService.consumeRequest(userId);

    return {
      query: trimmedQuery,
      provider: 'WIKIPEDIA',
      resultCount: results.length,
      results,
      usage,
    };
  }

  async getHistory(userId: number) {
    return this.prisma.webSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        query: true,
        provider: true,
        resultCount: true,
        createdAt: true,
      },
    });
  }

  async getRecentSearches(userId: number) {
    return this.prisma.webSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        query: true,
        createdAt: true,
      },
    });
  }

  async getSuggestions(userId: number, query: string) {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return [];
    }

    const searches = await this.prisma.webSearch.findMany({
      where: {
        userId,
        query: {
          startsWith: trimmedQuery,
          mode: 'insensitive',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      select: {
        query: true,
      },
    });

    return [...new Set(searches.map((search) => search.query))];
  }
}