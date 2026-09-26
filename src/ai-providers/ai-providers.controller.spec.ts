import { Test, TestingModule } from '@nestjs/testing';
import { AiProvidersController } from './ai-providers.controller';

describe('AiProvidersController', () => {
  let controller: AiProvidersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiProvidersController],
    }).compile();

    controller = module.get<AiProvidersController>(AiProvidersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
