import { Injectable } from '@nestjs/common';

import {
  AiChatRequest,
  AiChatResponse,
  AiProvider,
} from './ai-provider.interface';

@Injectable()
export class AnthropicProvider implements AiProvider {
  async chat(
    request: AiChatRequest,
  ): Promise<AiChatResponse> {
    const messages = [
      ...request.conversation,
      {
        role: 'user' as const,
        content: request.prompt,
      },
    ];

    const response = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': request.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-latest',
          max_tokens: 1000,
          messages,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Anthropic API request failed: ${response.status} ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      content?: {
        type?: string;
        text?: string;
      }[];
    };

    const content = data.content?.find(
      (item) => item.type === 'text',
    )?.text;

    if (!content) {
      throw new Error(
        'Anthropic returned an empty response',
      );
    }

    return {
      content,
    };
  }
}