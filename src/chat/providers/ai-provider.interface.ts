export interface AiChatRequest {
  apiKey: string;
  prompt: string;
  conversation: {
    role: 'user' | 'assistant';
    content: string;
  }[];
}

export interface AiChatResponse {
  content: string;
}

export interface AiProvider {
  chat(request: AiChatRequest): Promise<AiChatResponse>;
}