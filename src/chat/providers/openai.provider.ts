import { Injectable } from '@nestjs/common';

import {
  AiChatRequest,
  AiChatResponse,
  AiProvider,
} from './ai-provider.interface';

@Injectable()
export class OpenAiProvider implements AiProvider {
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
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${request.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          temperature: 0.7,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `OpenAI API request failed: ${response.status} ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      choices?: {
        message?: {
          content?: string;
        };
      }[];
    };

    const content =
      data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error(
        'OpenAI returned an empty response',
      );
    }

    return {
      content,
    };
  }
}