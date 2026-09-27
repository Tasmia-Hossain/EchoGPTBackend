import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AiProvidersService } from './ai-providers.service';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('AI Providers')
@ApiBearerAuth()
@Controller('ai-providers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AiProvidersController {
  constructor(
    private readonly aiProvidersService: AiProvidersService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create an AI provider (Admin only)',
  })
  @ApiResponse({
    status: 201,
    description:
      'AI provider created successfully.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid provider data or provider configuration.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin role required.',
  })
  async create(
    @Body() createDto: CreateAiProviderDto,
  ) {
    return this.aiProvidersService.create(createDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all AI providers (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description:
      'AI providers returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin role required.',
  })
  async findAll() {
    return this.aiProvidersService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an AI provider by ID (Admin only)',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 1,
    description: 'AI provider ID.',
  })
  @ApiResponse({
    status: 200,
    description:
      'AI provider returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin role required.',
  })
  @ApiResponse({
    status: 404,
    description: 'AI provider not found.',
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.aiProvidersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an AI provider (Admin only)',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 1,
    description: 'AI provider ID.',
  })
  @ApiResponse({
    status: 200,
    description:
      'AI provider updated successfully.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid provider data or provider configuration.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin role required.',
  })
  @ApiResponse({
    status: 404,
    description: 'AI provider not found.',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAiProviderDto,
  ) {
    return this.aiProvidersService.update(
      id,
      updateDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an AI provider (Admin only)',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 1,
    description: 'AI provider ID.',
  })
  @ApiResponse({
    status: 200,
    description:
      'AI provider deleted successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin role required.',
  })
  @ApiResponse({
    status: 404,
    description: 'AI provider not found.',
  })
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.aiProvidersService.remove(id);
  }
}