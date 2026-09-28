import { BadRequestException } from '@nestjs/common';

import { AiProviderManagerService } from './ai-provider-manager.service';

describe('AiProviderManagerService', () => {
  const request = {
    apiKey: 'provider-key',
    prompt: 'Hello',
    conversation: [],
  };

  it.each([
    ['OPENAI', 'openAIProvider'],
    ['ANTHROPIC', 'anthropicProvider'],
    ['GEMINI', 'geminiProvider'],
  ] as const)('routes %s chat to its existing adapter', async (type, adapterName) => {
    const providers = {
      openAIProvider: {
        chat: jest.fn().mockResolvedValue({ content: 'response' }),
        healthCheck: jest.fn(),
      },
      anthropicProvider: {
        chat: jest.fn().mockResolvedValue({ content: 'response' }),
        healthCheck: jest.fn(),
      },
      geminiProvider: {
        chat: jest.fn().mockResolvedValue({ content: 'response' }),
        healthCheck: jest.fn(),
      },
    };
    const manager = new AiProviderManagerService(
      providers.openAIProvider as any,
      providers.anthropicProvider as any,
      providers.geminiProvider as any,
    );

    await expect(manager.chat(type, request)).resolves.toEqual({
      content: 'response',
    });
    expect(providers[adapterName].chat).toHaveBeenCalledWith(request);
    expect(manager.isSupported(type)).toBe(true);
  });

  it('rejects unsupported types without changing provider routing', async () => {
    const manager = new AiProviderManagerService({} as any, {} as any, {} as any);

    expect(manager.isSupported('UNKNOWN')).toBe(false);
    await expect(manager.chat('UNKNOWN', request)).rejects.toThrow(
      BadRequestException,
    );
  });
});
