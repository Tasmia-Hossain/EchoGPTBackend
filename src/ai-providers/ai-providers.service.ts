import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto';

@Injectable()
export class AiProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateAiProviderDto) {
    if (createDto.isDefault) {
      await this.prisma.aIProvider.updateMany({
        data: {
          isDefault: false,
        },
      });
    }

    return this.prisma.aIProvider.create({
      data: {
        name: createDto.name,
        type: createDto.type,
        apiKeyEncrypted: createDto.apiKey ?? null,
        isEnabled: createDto.isEnabled ?? true,
        isDefault: createDto.isDefault ?? false,
      },
      select: {
        id: true,
        name: true,
        type: true,
        isEnabled: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAll() {
    return this.prisma.aIProvider.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        type: true,
        isEnabled: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: number) {
    const provider = await this.prisma.aIProvider.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        isEnabled: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!provider) {
      throw new NotFoundException('AI provider not found');
    }

    return provider;
  }

  async update(id: number, updateDto: UpdateAiProviderDto) {
    await this.findOne(id);

    if (updateDto.isDefault) {
      await this.prisma.aIProvider.updateMany({
        where: {
          id: {
            not: id,
          },
        },
        data: {
          isDefault: false,
        },
      });
    }

    return this.prisma.aIProvider.update({
      where: { id },
      data: {
        ...(updateDto.name !== undefined && {
          name: updateDto.name,
        }),
        ...(updateDto.type !== undefined && {
          type: updateDto.type,
        }),
        ...(updateDto.apiKey !== undefined && {
          apiKeyEncrypted: updateDto.apiKey,
        }),
        ...(updateDto.isEnabled !== undefined && {
          isEnabled: updateDto.isEnabled,
        }),
        ...(updateDto.isDefault !== undefined && {
          isDefault: updateDto.isDefault,
        }),
      },
      select: {
        id: true,
        name: true,
        type: true,
        isEnabled: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    try {
      await this.prisma.aIProvider.delete({
        where: { id },
      });
    } catch {
      throw new ConflictException(
        'AI provider cannot be deleted because it is being used',
      );
    }

    return {
      message: 'AI provider deleted successfully',
    };
  }
}