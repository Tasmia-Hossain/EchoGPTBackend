import { Injectable } from '@nestjs/common';
import { EXTERNAL_HTTP_TIMEOUT_MS } from '../../config/external-http.constants';
import { SearchProvider, SearchResult } from './search-provider.interface';

interface WikipediaSearchResult {
  title: string;
  pageid: number;
  snippet: string;
}

interface WikipediaResponse {
  query?: {
    search?: WikipediaSearchResult[];
  };
}

@Injectable()
export class WikipediaProvider implements SearchProvider {
  async search(query: string): Promise<SearchResult[]> {
    const url = new URL('https://en.wikipedia.org/w/api.php');

    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'search');
    url.searchParams.set('srsearch', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');
    url.searchParams.set('srlimit', '10');

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'EchoGPTBackend/1.0',
      },
      signal: AbortSignal.timeout(EXTERNAL_HTTP_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error('Wikipedia search request failed');
    }

    const data: unknown = await response.json();

    if (!isWikipediaResponse(data)) {
      throw new Error('Wikipedia returned an invalid search response');
    }

    const results = data.query.search;

    return results.map((result) => ({
      title: result.title,
      url: `https://en.wikipedia.org/?curid=${result.pageid}`,
      snippet: result.snippet.replace(/<[^>]*>/g, ''),
    }));
  }
}

function isWikipediaResponse(value: unknown): value is WikipediaResponse & {
  query: { search: WikipediaSearchResult[] };
} {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const query = (value as { query?: unknown }).query;
  if (!query || typeof query !== 'object') {
    return false;
  }

  const search = (query as { search?: unknown }).search;
  return (
    Array.isArray(search) &&
    search.every(
      (result) =>
        result !== null &&
        typeof result === 'object' &&
        typeof (result as WikipediaSearchResult).title === 'string' &&
        Number.isInteger((result as WikipediaSearchResult).pageid) &&
        typeof (result as WikipediaSearchResult).snippet === 'string',
    )
  );
}
