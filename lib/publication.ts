export interface PublicContent {
  title: string;
  summary: string;
  body: string;
  author_label: string;
  sources: { title: string; url: string }[];
}
export interface PublicDossier extends PublicContent {
  id: string;
  // Retained API projections may still carry the historical legal key.
  product: 'pharma' | 'legal' | 'loyer';
  revision: number;
  slug: string;
  living_research: boolean;
  first_published_at: string;
  updated_at: string;
}
export interface Publication extends PublicDossier {
  status: 'published' | 'withdrawn';
}
export interface PublicationState {
  publication: Publication | null;
  history: { revision: number; action: string; created_at: string }[];
}
export interface PublicationPreview {
  living_research: boolean;
  expected_revision: number;
  content: PublicContent;
  preview_token: string;
  preview_expires_at: string;
}
export interface PublicPage {
  items: PublicDossier[];
  total: number;
  offset: number;
  page_size: number;
  query: string;
}
export function publicHref(id: string) {
  return `/public-dossiers/${encodeURIComponent(id)}`;
}
export function publicSearch(query: string, offset = 0) {
  return `/public-dossiers?${new URLSearchParams({ q: query, offset: String(offset) })}`;
}
export function publicContent(row: PublicContent | null): PublicContent {
  return row
    ? {
        title: row.title,
        summary: row.summary,
        body: row.body,
        author_label: row.author_label,
        sources: row.sources.map(({ title, url }) => ({ title, url })),
      }
    : { title: '', summary: '', body: '', author_label: '', sources: [] };
}
export function publicOffset(value: string | string[] | undefined) {
  const input = typeof value === 'string' ? value : '';
  const number = Number(input);
  return /^\d+$/.test(input) && Number.isSafeInteger(number) && number <= 100000
    ? number
    : 0;
}
