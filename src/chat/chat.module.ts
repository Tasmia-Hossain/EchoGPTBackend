import { Module } from '@nestjs/common';

import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AiProvidersModule } from '../ai-providers/ai-providers.module';

@Module({
  imports: [
    SubscriptionsModule,
    AiProvidersModule,
  ],

  controllers: [
    ChatController,
  ],

  providers: [
    ChatService,
  ],
})
export class ChatModule {}