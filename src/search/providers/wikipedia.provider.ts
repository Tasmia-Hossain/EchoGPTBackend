import { Injectable } from '@nestjs/common';
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
    });

    if (!response.ok) {
      throw new Error(
        `Wikipedia API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as WikipediaResponse;

    const results = data.query?.search ?? [];

    return results.map((result) => ({
      title: result.title,
      url: `https://en.wikipedia.org/?curid=${result.pageid}`,
      snippet: result.snippet.replace(/<[^>]*>/g, ''),
    }));
  }
}