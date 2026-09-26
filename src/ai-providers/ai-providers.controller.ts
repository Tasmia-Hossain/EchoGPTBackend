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

import { AiProvidersService } from './ai-providers.service';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('ai-providers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AiProvidersController {
  constructor(
    private readonly aiProvidersService: AiProvidersService,
  ) {}

  @Post()
  async create(@Body() createDto: CreateAiProviderDto) {
    return this.aiProvidersService.create(createDto);
  }

  @Get()
  async findAll() {
    return this.aiProvidersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.aiProvidersService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAiProviderDto,
  ) {
    return this.aiProvidersService.update(id, updateDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.aiProvidersService.remove(id);
  }
}