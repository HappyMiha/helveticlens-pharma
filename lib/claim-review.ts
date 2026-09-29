import type { SourceAssessments, SourceRoleOptions } from './source-authority';
export type ClaimInterpretation = {
  schema_version: 1;
  domain_pack: string;
  domain_pack_version: string;
  kind: string;
  kind_label: string;
  claim_type: string;
  label: string;
  authority: 'UNASSESSED';
};
export type InterpretationOptions = {
  schema_version: 1;
  domain_pack: string;
  domain_pack_version: string;
  types: Pick<
    ClaimInterpretation,
    'kind' | 'claim_type' | 'kind_label' | 'label'
  >[];
};
export type ClaimDecision = 'accepted' | 'dismissed' | 'needs_more_evidence';
export type ClaimCitation = {
  id: string;
  claim_id: string;
  relation: string;
  quote: string;
  locator: string;
  valid: boolean;
  source: {
    id: string;
    investigation_id: string;
    title: string;
    url: string;
    kind: string;
    sha256: string;
    captured_at: string;
    capture_fingerprint?: string;
    saved_version?: {
      id: string;
      recorded_revision: number | null;
      current_revision: number | null;
      content_hash: string | null;
    } | null;
  };
};
export type ReviewedClaim = {
  id: string;
  claim: {
    id: string;
    investigation_id: string;
    statement: string;
    revision: number;
    evidence_status: string;
  };
  evidence: ClaimCitation[];
  comparisons: {
    id: string;
    kind: string;
    status: string;
    revision: number;
    direction: string;
    claim: ReviewedClaim['claim'];
    evidence: ClaimCitation[];
  }[];
  complete: boolean;
  reviewable: boolean;
  evidence_fingerprint: string | null;
  limits: { citations: number; comparisons: number };
  revision: number;
  decision: ClaimDecision | null;
  stale: boolean;
  human_status: string;
  finding_status: string;
  history_unavailable: boolean;
  interpretation?: ClaimInterpretation;
  source_assessments?: SourceAssessments;
  history: {
    revision: number;
    decision: ClaimDecision;
    reason: string;
    at: string;
    reviewer: string;
    evidence_fingerprint: string;
    basis: {
      schema_version: number;
      interpretation?: ClaimInterpretation;
      source_assessments?: SourceAssessments;
      sources: { id: string; sha256: string }[];
      claims: { id: string; revision: number }[];
    };
  }[];
};
export type ClaimReviewsPage = {
  items: ReviewedClaim[];
  total: number;
  offset: number;
  page_size: number;
  publication_revision: number | null;
  can_review?: boolean;
  interpretation_options?: InterpretationOptions;
  source_assessment_options?: SourceRoleOptions;
  boundary: string;
};
export const claimDecisionLabels = {
  accepted: 'Accepted by an editor',
  dismissed: 'Dismissed by an editor',
  needs_more_evidence: 'More evidence requested',
};
export function currentClaimReviews(
  data: ClaimReviewsPage | null,
  error: string,
  offset: number,
  revision?: number,
) {
  return !error &&
    data?.offset === offset &&
    data.publication_revision === (revision ?? null)
    ? data
    : null;
}
