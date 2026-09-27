import { Module } from '@nestjs/common';

import { AiProvidersController } from './ai-providers.controller';
import { AiProvidersService } from './ai-providers.service';
import { AiProviderCryptoService } from './crypto/ai-provider-crypto.service';

import { AiProviderManagerService } from '../chat/providers/ai-provider-manager.service';
import { OpenAiProvider } from '../chat/providers/openai.provider';
import { AnthropicProvider } from '../chat/providers/anthropic.provider';
import { GeminiProvider } from '../chat/providers/gemini.provider';

@Module({
  controllers: [AiProvidersController],

  providers: [
    AiProvidersService,
    AiProviderCryptoService,
    AiProviderManagerService,
    OpenAiProvider,
    AnthropicProvider,
    GeminiProvider,
  ],

  exports: [
    AiProvidersService,
    AiProviderCryptoService,
    AiProviderManagerService,
  ],
})
export class AiProvidersModule {}