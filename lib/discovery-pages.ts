import type { DiscoveryResult } from './contracts';

/** Only explicit query fields go to discovery; purpose and dossier data stay local. */
export function discoveryPath(
  product: string,
  search: {
    query: string;
    provider: string;
    match_mode?: string | null;
  },
  cursor?: string | null,
) {
  const query = new URLSearchParams({
    provider: search.provider,
    q: search.query,
  });
  if (search.provider === 'workspace')
    query.set('mode', search.match_mode || 'all');
  else if (cursor) query.set('cursor', cursor);
  return `/products/${product}/discover?${query}`;
}

/** Do not combine a response for a different search with already reviewed pages. */
export function appendDiscoveryPage(
  pages: DiscoveryResult[],
  next: DiscoveryResult,
) {
  const previous = pages[pages.length - 1];
  if (
    !previous ||
    previous.provider === 'workspace' ||
    next.provider !== previous.provider ||
    next.query !== previous.query ||
    next.page_number !== (previous.page_number || 1) + 1 ||
    pages.length >= 50
  ) {
    throw new Error(
      'This continuation does not match the displayed search. Start the search again.',
    );
  }
  return [...pages, next];
}
