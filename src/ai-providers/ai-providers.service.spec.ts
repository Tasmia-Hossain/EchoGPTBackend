import { Test, TestingModule } from '@nestjs/testing';
import { AiProvidersService } from './ai-providers.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderCryptoService } from './crypto/ai-provider-crypto.service';
import { AiProviderManagerService } from '../chat/providers/ai-provider-manager.service';

describe('AiProvidersService', () => {
  let service: AiProvidersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiProvidersService,
        { provide: PrismaService, useValue: {} },
        { provide: AiProviderCryptoService, useValue: {} },
        { provide: AiProviderManagerService, useValue: {} },
      ],
    }).compile();

    service = module.get<AiProvidersService>(AiProvidersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});