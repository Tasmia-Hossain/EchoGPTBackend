import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto';
import { AiProviderCryptoService } from './crypto/ai-provider-crypto.service';

@Injectable()
export class AiProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: AiProviderCryptoService,
  ) {}

  async create(createDto: CreateAiProviderDto) {
    const isEnabled = createDto.isEnabled ?? true;
    const isDefault = createDto.isDefault ?? false;

    if (isDefault && !isEnabled) {
      throw new BadRequestException(
        'A disabled provider cannot be set as default',
      );
    }

    if (isDefault) {
      await this.prisma.aIProvider.updateMany({
        data: {
          isDefault: false,
        },
      });
    }

    const encryptedApiKey = createDto.apiKey
      ? this.cryptoService.encrypt(createDto.apiKey)
      : null;

    return this.prisma.aIProvider.create({
      data: {
        name: createDto.name,
        type: createDto.type,
        apiKeyEncrypted: encryptedApiKey,
        isEnabled,
        isDefault,
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
    const existingProvider = await this.prisma.aIProvider.findUnique({
      where: { id },
    });

    if (!existingProvider) {
      throw new NotFoundException('AI provider not found');
    }

    const newIsEnabled =
      updateDto.isEnabled ?? existingProvider.isEnabled;

    const newIsDefault =
      updateDto.isDefault ?? existingProvider.isDefault;

    if (newIsDefault && !newIsEnabled) {
      throw new BadRequestException(
        'A disabled provider cannot be set as default',
      );
    }

    if (newIsDefault) {
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

    const encryptedApiKey =
      updateDto.apiKey !== undefined
        ? this.cryptoService.encrypt(updateDto.apiKey)
        : undefined;

    return this.prisma.aIProvider.update({
      where: { id },
      data: {
        ...(updateDto.name !== undefined && {
          name: updateDto.name,
        }),

        ...(updateDto.type !== undefined && {
          type: updateDto.type,
        }),

        ...(encryptedApiKey !== undefined && {
          apiKeyEncrypted: encryptedApiKey,
        }),

        ...(updateDto.isEnabled !== undefined && {
          isEnabled: updateDto.isEnabled,
        }),

        ...(updateDto.isDefault !== undefined && {
          isDefault: updateDto.isDefault,
        }),

        ...(updateDto.isEnabled === false && {
          isDefault: false,
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