import { Module } from '@nestjs/common';

import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AiProvidersModule } from '../ai-providers/ai-providers.module';

import { AiProviderManagerService } from './providers/ai-provider-manager.service';
import { OpenAiProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';

@Module({
  imports: [
    SubscriptionsModule,
    AiProvidersModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    AiProviderManagerService,
    OpenAiProvider,
    AnthropicProvider,
    GeminiProvider,
  ],
})
export class ChatModule {}