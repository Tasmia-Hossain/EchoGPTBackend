import { Module } from '@nestjs/common';

import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { WikipediaProvider } from './providers/wikipedia.provider';

@Module({
  imports: [SubscriptionsModule],
  controllers: [SearchController],
  providers: [SearchService, WikipediaProvider],
})
export class SearchModule {}