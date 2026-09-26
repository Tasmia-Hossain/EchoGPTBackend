import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import {
  AiChatRequest,
  AiChatResponse,
  AiProvider,
} from './ai-provider.interface';

import { OpenAiProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';

@Injectable()
export class AiProviderManagerService {
  constructor(
    private readonly openAiProvider: OpenAiProvider,
    private readonly anthropicProvider: AnthropicProvider,
    private readonly geminiProvider: GeminiProvider,
  ) {}

  async chat(
    type: string,
    request: AiChatRequest,
  ): Promise<AiChatResponse> {
    const provider = this.getProvider(type);

    if (!provider) {
      throw new BadRequestException(
        `Unsupported AI provider: ${type}`,
      );
    }

    return provider.chat(request);
  }

  private getProvider(
    type: string,
  ): AiProvider | null {
    switch (type) {
      case 'OPENAI':
        return this.openAiProvider;

      case 'ANTHROPIC':
        return this.anthropicProvider;

      case 'GEMINI':
        return this.geminiProvider;

      default:
        return null;
    }
  }
}