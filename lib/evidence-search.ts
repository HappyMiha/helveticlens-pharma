export type EvidenceSearchMode = 'semantic' | 'literal';
export interface EvidenceSearchItem {
  id: string;
  kind: 'passage' | 'claim';
  investigation_id: string;
  source_id: string;
  title: string;
  url: string;
  sha256: string;
  quote: string;
  locator: string;
  created_at: string;
  statement: string;
  claim_status: string;
  claim_id: string;
  claim_revision: number;
  text_truncated: boolean;
  text_characters: number;
  semantic_match: boolean;
  literal_match: boolean;
  relevance_probability: number | null;
  confidence: number | null;
}
export interface EvidenceSearchPage {
  dossier_id: string;
  query: string;
  mode: EvidenceSearchMode;
  method: 'literal' | 'local_semantic_hybrid' | 'literal_fallback';
  items: EvidenceSearchItem[];
  total_records: number;
  matching_records: number | null;
  examined_records: number;
  offset: number;
  batch_size: number;
  next_offset: number | null;
  as_of: string;
  fingerprint: string;
  coverage: string;
  measurement: {
    latency_ms: number;
    requests_completed: number;
    models: string[];
    error: string | null;
    estimated_cost_usd: number | null;
    cost_scope: string;
    accuracy: number | null;
    accuracy_basis: string;
    confidence_definition: string;
  };
}
export function currentEvidenceSearch(
  page: EvidenceSearchPage | null,
  dossierId: string,
  query: string,
  mode: EvidenceSearchMode,
  error: string,
) {
  return !error &&
    page?.dossier_id === dossierId &&
    page.query === query.trim() &&
    page.mode === mode
    ? page
    : null;
}
export function evidenceAnchor(item: EvidenceSearchItem) {
  return item.kind === 'claim'
    ? `claim-${item.claim_id}`
    : `source-${item.source_id}`;
}
