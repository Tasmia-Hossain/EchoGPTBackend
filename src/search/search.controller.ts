import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchDto } from './dto/search.dto';
import { SearchService } from './search.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
  };
}

@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @ApiOperation({ summary: 'Search the web' })
  @ApiResponse({
    status: 200,
    description: 'Search results returned successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Search query is invalid.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 503,
    description: 'Search provider is unavailable.',
  })
  async search(
    @Req() request: AuthenticatedRequest,
    @Body() searchDto: SearchDto,
  ) {
    return this.searchService.search(
      request.user.userId,
      searchDto.query,
    );
  }

  @Get('history')
  @ApiOperation({ summary: 'Get search history' })
  @ApiResponse({
    status: 200,
    description: 'Search history returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  async getHistory(@Req() request: AuthenticatedRequest) {
    return this.searchService.getHistory(request.user.userId);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent searches' })
  @ApiResponse({
    status: 200,
    description: 'Recent searches returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  async getRecentSearches(@Req() request: AuthenticatedRequest) {
    return this.searchService.getRecentSearches(request.user.userId);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get search suggestions' })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Search text used to generate suggestions.',
    example: 'nest',
  })
  @ApiResponse({
    status: 200,
    description: 'Search suggestions returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  async getSuggestions(
    @Req() request: AuthenticatedRequest,
    @Query('q') query: string,
  ) {
    return this.searchService.getSuggestions(
      request.user.userId,
      query ?? '',
    );
  }
}