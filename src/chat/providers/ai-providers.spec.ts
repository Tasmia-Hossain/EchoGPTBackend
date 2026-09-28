import { AiChatRequest } from './ai-provider.interface';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';
import { OpenAiProvider } from './openai.provider';

const originalFetch = globalThis.fetch;

const providerCases = [
  ['OpenAI', () => new OpenAiProvider()],
  ['Anthropic', () => new AnthropicProvider()],
  ['Gemini', () => new GeminiProvider()],
] as const;

const request: AiChatRequest = {
  apiKey: 'test-provider-key',
  prompt: 'Hello',
  conversation: [],
};

describe.each(providerCases)('%s provider outbound requests', (name, createProvider) => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('uses an abort timeout and does not read or expose an upstream error body', async () => {
    const upstreamBody = 'private response body and credential detail';
    const responseText = jest.fn().mockResolvedValue(upstreamBody);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: responseText,
    });

    await expect(createProvider().chat(request)).rejects.toThrow(
      /API request failed/,
    );

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(responseText).not.toHaveBeenCalled();
  });

  it('uses an abort timeout for provider health checks', async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await createProvider().healthCheck(request.apiKey);

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
});
