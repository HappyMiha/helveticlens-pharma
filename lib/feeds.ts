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
  intelligence?: FeedIntelligence;
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
  feedback?: 'relevant' | 'not_relevant' | null;
  relevance?: {
    verdict: 'relevant' | 'uncertain' | 'unrelated' | 'unavailable' | 'pending';
    scope: string;
    basis?: string;
  };
}
export interface FeedHistory {
  items: FeedUpdate[];
  total: number;
  next_sequence: number | null;
  total_retained?: number;
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
  can_learn?: boolean;
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
      semantic_counts?: {
        relevant: number;
        uncertain: number;
        unrelated: number;
        unavailable: number;
      };
      plan_status?: string;
      query_index?: number;
      query_count?: number;
      coverage: Array<{
        kind?: string;
        query?: string;
        language?: string;
        purpose?: string;
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

export interface FeedIntelligence {
  mode: 'semantic';
  include: string[];
  exclude: string[];
  languages: string[];
  plan_status: string;
  understanding: string;
  concepts: string[];
  synonyms: string[];
  queries: Array<{ query: string; language: string; purpose?: string }>;
  feedback_count: number;
  context_count: number;
  scope: string;
}
export interface FeedContextPreview {
  context_fingerprint: string;
  question: string;
  findings: Array<{
    statement: string;
    source_id: string;
    url: string;
    quote?: string;
    locator?: string;
  }>;
  gaps: string[];
  investigation_id: string;
  run_revision: number;
  link_revision: number;
  feed_revision: number;
  scope: string;
}
export function feedPrecisionLines(value: string) {
  const lines = [
    ...new Set(
      value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ];
  if (lines.length > 20 || lines.some((line) => line.length > 300))
    throw new Error(
      'Use up to 20 lines, with at most 300 characters on each line.',
    );
  return lines;
}

export interface FeedWatchProposal {
  name: string;
  query: string;
  question: string;
  basis: 'public_research' | 'question_only';
  findings: FeedContextPreview['findings'];
  gaps: string[];
  scope: string;
  proposal_fingerprint: string;
}
