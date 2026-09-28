import { EXTERNAL_HTTP_TIMEOUT_MS } from '../../config/external-http.constants';
import { WikipediaProvider } from './wikipedia.provider';

const originalFetch = globalThis.fetch;

describe('WikipediaProvider', () => {
  let fetchMock: jest.Mock;
  let provider: WikipediaProvider;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    provider = new WikipediaProvider();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sets the shared timeout and safely propagates a network timeout internally', async () => {
    fetchMock.mockImplementation(async (_url: URL, options: RequestInit) => {
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(EXTERNAL_HTTP_TIMEOUT_MS).toBe(30_000);
      throw new DOMException('private timeout detail', 'TimeoutError');
    });

    await expect(provider.search('NestJS')).rejects.toMatchObject({
      name: 'TimeoutError',
    });
  });

  it('does not include upstream response bodies in provider errors', async () => {
    const responseText = jest.fn().mockResolvedValue('private upstream body');
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Unavailable',
      text: responseText,
    });

    await expect(provider.search('NestJS')).rejects.toThrow(
      'Wikipedia search request failed',
    );
    expect(responseText).not.toHaveBeenCalled();
  });
});
