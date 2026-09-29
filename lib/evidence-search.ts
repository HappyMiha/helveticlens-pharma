import type { SourceAssessments, SourceRole } from './source-authority';
import type { ClaimInterpretation } from './claim-review';
export type EvidenceSearchMode = 'corpus' | 'semantic' | 'literal';
export type SearchReview = {
  interpretation?: ClaimInterpretation;
  source_assessments?: SourceAssessments<SourceRole>;
  revision: number;
  decision: 'accepted' | 'dismissed' | 'needs_more_evidence' | null;
  stale: boolean;
  human_status: string;
  complete: boolean;
  reviewable: boolean;
  has_conflicting_evidence: boolean;
};
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
  citation_relation?: string;
  human_review?: SearchReview | null;
  text_truncated: boolean;
  text_characters: number;
  semantic_similarity?: number;
  embedding_truncated?: boolean;
  semantic_match: boolean;
  literal_match: boolean;
  relevance_probability: number | null;
  confidence: number | null;
}
export interface EvidenceSearchPage {
  dossier_id: string;
  query: string;
  mode: EvidenceSearchMode;
  method:
    | 'literal'
    | 'local_semantic_hybrid'
    | 'local_corpus_hybrid'
    | 'literal_fallback';
  preparing?: boolean;
  prepared_records?: number;
  preparation_batch?: number;
  items: EvidenceSearchItem[];
  total_records: number;
  matching_records: number | null;
  examined_records: number;
  offset: number;
  batch_size: number;
  next_offset: number | null;
  as_of: string;
  fingerprint: string;
  review_claim_ids?: string[];
  review_fingerprint?: string;
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

export type EvidenceSearchRequest = {
  query: string;
  mode: EvidenceSearchMode;
  offset: number;
  as_of?: string;
  fingerprint?: string;
};

/** Each response is a real persisted preparation checkpoint, never fake progress. */
export async function completeEvidenceSearch(
  initial: EvidenceSearchRequest,
  request: (body: EvidenceSearchRequest) => Promise<EvidenceSearchPage>,
  isCurrent: () => boolean,
  onProgress: (page: EvidenceSearchPage) => void,
): Promise<EvidenceSearchPage | null> {
  let command = initial;
  let prepared = -1;
  let fence = initial.fingerprint;
  for (let step = 0; step <= 1251 && isCurrent(); step++) {
    const page = await request(command);
    if (!isCurrent()) return null;
    if (
      page.query !== initial.query ||
      page.mode !== initial.mode ||
      (fence && page.fingerprint !== fence)
    )
      throw new Error(
        'Saved evidence changed. Search again to see current results.',
      );
    if (!page.preparing) return page;
    if (
      page.mode !== 'corpus' ||
      !Number.isInteger(page.prepared_records) ||
      page.prepared_records! <= prepared ||
      page.prepared_records! > page.total_records ||
      page.total_records > 20000
    )
      throw new Error(
        'Preparation did not advance. Prepared evidence is retained; search again or use Words.',
      );
    prepared = page.prepared_records!;
    fence = page.fingerprint;
    onProgress(page);
    command = { ...initial, as_of: page.as_of, fingerprint: fence };
  }
  if (isCurrent())
    throw new Error(
      'Preparation reached its limit. Use Words or Direct comparison.',
    );
  return null;
}
