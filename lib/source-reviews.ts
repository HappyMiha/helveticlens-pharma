import type { Entry, SourceDecision } from './contracts';

export const sourceDecisionLabels: Record<SourceDecision, string> = {
  include: 'Include in AI research',
  exclude: 'Exclude from AI research',
  unreviewed: 'Needs review · eligible for AI research',
};
export interface SourceReviewDraft {
  request_key: string;
  expected_review_id: string | null;
  decision: SourceDecision;
  reason: string;
}
export function reviewDraft(
  current: Entry | null | undefined,
  key: string,
): SourceReviewDraft {
  return {
    request_key: key,
    expected_review_id: current?.id ?? null,
    decision: current?.data.decision || 'unreviewed',
    reason: '',
  };
}
export function reviewConflict(
  draft: SourceReviewDraft,
  current: Entry | null,
) {
  return draft.expected_review_id !== (current?.id ?? null);
}
export function rebaseReview(
  draft: SourceReviewDraft,
  current: Entry | null,
  key: string,
): SourceReviewDraft {
  return { ...reviewDraft(current, key), reason: draft.reason };
}
export function reviewRequest(draft: SourceReviewDraft) {
  return {
    request_key: draft.request_key,
    expected_review_id: draft.expected_review_id,
    decision: draft.decision,
    reason: draft.reason.trim(),
  };
}
