import { Test, TestingModule } from '@nestjs/testing';
import { AiProvidersService } from './ai-providers.service';

describe('AiProvidersService', () => {
  let service: AiProvidersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiProvidersService],
    }).compile();

    service = module.get<AiProvidersService>(AiProvidersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
