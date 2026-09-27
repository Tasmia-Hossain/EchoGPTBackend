import { Test, TestingModule } from '@nestjs/testing';
import { AiProvidersController } from './ai-providers.controller';
import { AiProvidersService } from './ai-providers.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AiProvidersController', () => {
  let controller: AiProvidersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiProvidersController],
      providers: [
        { provide: AiProvidersService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<AiProvidersController>(AiProvidersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});