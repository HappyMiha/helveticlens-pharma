import type { ComparedFinding } from './claim-evolution';

export type CheckedPageVersion = {
  id: string;
  title: string;
  evidence_revision: number;
  created_at: string;
  source_url: string;
  content_hash: string;
  origin: string;
  synthetic: boolean;
  label: string;
};
export type PageCheck = {
  id: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  outcome: string;
  analysis_status: string;
  versions: CheckedPageVersion[];
  research: { state: string; investigation_id: string | null; finding: ComparedFinding | null; outcome?: import('./web-research').MonitoringOutcome } | null;
  limitation: string | null;
};
export type PageCheckHistory = {
  schema_id: 'page-check-history/v1';
  dossier_id: string;
  document: { id: string; name: string; url: string };
  items: PageCheck[];
  total: number;
  offset: number;
  page_size: number;
  next_offset: number | null;
  as_of: string;
  scope: string;
};
export function currentPageChecks(data: PageCheckHistory | null, error: string, dossierId: string, documentId: string, offset: number) {
  return !error && data?.schema_id === 'page-check-history/v1' && data.dossier_id === dossierId && data.document?.id === documentId && data.offset === offset ? data : null;
}
export function pageChecksPath(dossierId: string, documentId: string, product: string, offset: number, asOf: string) {
  const query = new URLSearchParams({ offset: String(offset) });
  if (asOf) query.set('as_of', asOf);
  return `/products/${product}/dossiers/${encodeURIComponent(dossierId)}/documents/${encodeURIComponent(documentId)}/checks?${query}`;
}
