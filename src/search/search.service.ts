import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

import { WikipediaProvider } from './providers/wikipedia.provider';
import { SearchResult } from './providers/search-provider.interface';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginationSkip, toPaginatedResponse } from '../common/pagination';

const DEFAULT_SEARCH_CACHE_TTL_SECONDS = 3600;
const SEARCH_CACHE_SOURCE = 'wikipedia:v1';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly searchProvider: WikipediaProvider,
    private readonly configService: ConfigService,
  ) {}

  async search(userId: number, query: string) {
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');

    if (!normalizedQuery) {
      throw new BadRequestException(
        'Search query cannot be empty',
      );
    }

    const queryHash = createHash('sha256')
      .update(
        `${SEARCH_CACHE_SOURCE}:${normalizedQuery.toLocaleLowerCase('en-US')}`,
      )
      .digest('hex');
    const now = new Date();
    let cachedResults: SearchResult[] | undefined;

    try {
      const cacheEntry = await this.prisma.searchCache.findUnique({
        where: { queryHash },
        select: { results: true, expiresAt: true },
      });

      if (
        cacheEntry &&
        cacheEntry.expiresAt > now &&
        isSearchResults(cacheEntry.results)
      ) {
        cachedResults = cacheEntry.results;
      }
    } catch {
      // Search remains available if the optional cache lookup fails.
    }

    const reservation =
      await this.subscriptionsService.reserveRequest(userId);

    let results = cachedResults;
    let responseTime = 0;

    if (!results) {
      const startedAt = Date.now();

      try {
        results = await this.searchProvider.search(normalizedQuery);
        if (!isSearchResults(results)) {
          throw new Error('Search provider returned malformed results');
        }
      } catch {
        responseTime = Date.now() - startedAt;

        try {
          await this.subscriptionsService.refundRequest(
            userId,
            reservation.reservation,
          );
        } catch {
          throw new InternalServerErrorException(
            'Unable to restore request quota after search provider failure',
          );
        }

        try {
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
        } catch {
          // A logging failure must not mask the controlled search-provider error.
        }

        throw new ServiceUnavailableException(
          'Search provider is currently unavailable',
        );
      }

      responseTime = Date.now() - startedAt;

      const configuredTtl = Number(
        this.configService.get('SEARCH_CACHE_TTL_SECONDS') ??
          DEFAULT_SEARCH_CACHE_TTL_SECONDS,
      );
      const ttlSeconds =
        Number.isInteger(configuredTtl) && configuredTtl > 0
          ? configuredTtl
          : DEFAULT_SEARCH_CACHE_TTL_SECONDS;
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      const cacheResults = results as unknown as Prisma.InputJsonValue;

      try {
        await this.prisma.searchCache.upsert({
          where: { queryHash },
          create: {
            queryHash,
            query: normalizedQuery.toLocaleLowerCase('en-US'),
            results: cacheResults,
            expiresAt,
          },
          update: {
            query: normalizedQuery.toLocaleLowerCase('en-US'),
            results: cacheResults,
            expiresAt,
          },
        });
      } catch {
        // Cache storage is best-effort; a successful search still succeeds.
      }
    }

    await this.prisma.webSearch.create({
      data: {
        userId,
        query: normalizedQuery,
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

    return {
      query: normalizedQuery,
      provider: 'WIKIPEDIA',
      resultCount: results.length,
      results,
      usage: reservation.usage,
    };
  }

  async getHistory(userId: number, pagination: PaginationQueryDto) {
    const where = { userId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.webSearch.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: paginationSkip(pagination.page, pagination.limit),
        take: pagination.limit,
        select: {
          id: true,
          query: true,
          provider: true,
          resultCount: true,
          createdAt: true,
        },
      }),
      this.prisma.webSearch.count({ where }),
    ]);

    return toPaginatedResponse(data, pagination.page, pagination.limit, total);
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

function isSearchResults(value: unknown): value is SearchResult[] {
  return (
    Array.isArray(value) &&
    value.every(
      (result) =>
        result !== null &&
        typeof result === 'object' &&
        typeof (result as SearchResult).title === 'string' &&
        typeof (result as SearchResult).url === 'string' &&
        typeof (result as SearchResult).snippet === 'string',
    )
  );
}
