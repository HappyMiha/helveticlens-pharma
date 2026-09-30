import type { CoveragePack, CoverageStream, DossierCoverage } from './dossier-coverage';
export type FeedCheck = {
  id: string;
  status: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  reported_counts: { new: number | null; changed: number | null; failed: number | null } | null;
  explanation: string | null;
};
export type FeedCheckHistory = {
  schema_id: 'feed-check-history/v1';
  dossier_id: string;
  profile_status: string;
  topics: DossierCoverage['topics'];
  pack: Omit<CoveragePack, 'streams' | 'unsupported_streams'>;
  source: CoverageStream;
  items: FeedCheck[];
  total: number;
  offset: number;
  page_size: number;
  next_offset: number | null;
  as_of: string;
  scope: string;
};
export function feedChecksPath(product: string, dossier: string, pack: string, connector: string, stream: string, offset: number, asOf: string) {
  const params = new URLSearchParams({ pack_id: pack, connector, stream, offset: String(offset) });
  if (asOf) params.set('as_of', asOf);
  return `/products/${product}/dossiers/${encodeURIComponent(dossier)}/coverage/history?${params}`;
}
export function currentFeedChecks(data: FeedCheckHistory | null, error: string, dossier: string, pack: string, connector: string, stream: string, offset: number) {
  return !error && data?.schema_id === 'feed-check-history/v1' && data.dossier_id === dossier && data.pack?.id === pack && data.source?.connector === connector && data.source.stream === stream && data.offset === offset ? data : null;
}
