import { Injectable } from '@nestjs/common';

import {
  AiChatRequest,
  AiChatResponse,
  AiProvider,
} from './ai-provider.interface';

@Injectable()
export class GeminiProvider implements AiProvider {
  async chat(
    request: AiChatRequest,
  ): Promise<AiChatResponse> {
    const contents = [
      ...request.conversation,
      {
        role: 'user' as const,
        content: request.prompt,
      },
    ].map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [
        {
          text: message.content,
        },
      ],
    }));

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': request.apiKey,
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Gemini API request failed: ${response.status} ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      candidates?: {
        content?: {
          parts?: {
            text?: string;
          }[];
        };
      }[];
    };

    const content =
      data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error(
        'Gemini returned an empty response',
      );
    }

    return {
      content,
    };
  }
}