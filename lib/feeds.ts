import { product } from './product';
import { date } from './api';

export type FeedProduct = 'legal' | 'pharma';
export interface FeedSource {
  id: string;
  label: string;
  products: string[];
}
export interface FeedFollow {
  following: boolean;
  revision: number;
  latest_sequence: number;
  seen_sequence: number;
  unread_count: number;
}
export interface Feed {
  id: string;
  revision: number;
  product: FeedProduct;
  name: string;
  query: string;
  sources: string[];
  status: 'active' | 'paused';
  checked_at: string | null;
  next_check_at: string | null;
  error: string | null;
  job: { id: string; status: string } | null;
  update_count: number;
  can_manage: boolean;
  follow: FeedFollow;
  unread_count: number;
}
export interface FeedList {
  items: Feed[];
  total: number;
  can_create: boolean;
  sources: FeedSource[];
  offset: number;
  page_size: number;
}
export interface FeedUpdate {
  id: string;
  sequence: number;
  title: string;
  url: string;
  summary: string;
  original_url?: string;
  content_hash: string;
  published_at: string | null;
  created_at: string;
  reading_complete: boolean;
}
export interface FeedHistory {
  items: FeedUpdate[];
  total: number;
  next_sequence: number | null;
}
export interface FeedLink {
  id: string;
  feed_id: string;
  dossier_id: string;
  revision: number;
  status: string;
  cursor_sequence: number;
  question?: string;
  can_open_feed?: boolean;
  can_retry?: boolean;
  pending_count: number;
  feed: Pick<Feed, 'id' | 'name' | 'product' | 'status'>;
  investigation: { id: string; status: string; revision: number } | null;
}
export interface DossierFeedList {
  items: FeedLink[];
  can_manage: boolean;
}
export interface FeedDossier {
  dossier_id: string;
  product: FeedProduct;
  link: FeedLink;
  investigation: { id: string; status: string } | null;
}
export function feedHref(id: string) {
  return `/?${new URLSearchParams({ view: 'feeds', feed: id })}`;
}
export function feedDossierHref(id: string, domain: FeedProduct) {
  const path = `/?${new URLSearchParams({ dossier: id })}`;
  return domain === product.id
    ? path
    : `https://${domain}.helveticlens.ch${path}`;
}
export function feedSources(selected: string[], urls: string) {
  const typed = urls
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const value of typed) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error('Enter a complete HTTPS source URL on each line.');
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      value.length > 2048
    )
      throw new Error(
        'Use public HTTPS source URLs without passwords, up to 2,048 characters each.',
      );
  }
  const values = [...new Set([...selected, ...typed])];
  if (values.length > 50)
    throw new Error('Choose at most 50 sources for this feed.');
  return values;
}
export function feedSourceHref(value: FeedUpdate, feedId: string) {
  // Use the known same-origin original route; never trust a stored redirect URL.
  return `/api/feeds/${encodeURIComponent(feedId)}/updates/${encodeURIComponent(value.id)}/original`;
}

/** A transparent lexical suggestion, not a claim of semantic relevance. */
export function rankFeeds(feeds: Feed[], question: string) {
  const stop = new Set([
    'the',
    'and',
    'for',
    'this',
    'that',
    'with',
    'from',
    'what',
    'which',
    'when',
    'where',
    'how',
    'are',
    'does',
    'about',
    'want',
    'watch',
    'changes',
    'follow',
    'monitor',
    'monitoring',
  ]);
  const tokens = (value: string) =>
    new Set(
      (value.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter(
        (word) => !stop.has(word),
      ),
    );
  const wanted = tokens(question);
  return feeds
    .map((feed, index) => ({
      feed,
      index,
      score: [...tokens(`${feed.name} ${feed.query}`)].filter((word) =>
        wanted.has(word),
      ).length,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

export function feedUpdateDate(update: FeedUpdate) {
  if (
    update.published_at &&
    Number.isFinite(new Date(update.published_at).getTime())
  )
    return `Published ${date(update.published_at)}`;
  return Number.isFinite(new Date(update.created_at).getTime())
    ? `Discovered ${date(update.created_at)}`
    : 'Publication date unavailable';
}

export interface FeedCheckHistory {
  items: Array<{
    id: string;
    status: string;
    feed_revision: number;
    created_at: string;
    finished_at: string | null;
    progress: {
      captured: number;
      unchanged: number;
      portions: number;
      worker_error: string | null;
      coverage: Array<{
        kind?: string;
        name?: string;
        url?: string;
        status?: string;
        omitted_records?: number;
        count?: number;
      }>;
      failures: Array<{
        phase?: string;
        url?: string;
        code?: string;
        at?: string;
      }>;
    };
  }>;
  total: number;
  offset: number;
  page_size: number;
}
