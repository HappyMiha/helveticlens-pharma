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
  history: {
    revision: number;
    decision: ClaimDecision;
    reason: string;
    at: string;
    reviewer: string;
    evidence_fingerprint: string;
    basis: {
      schema_version: number;
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
