import type { ClaimCitation, ReviewedClaim } from './claim-review';

export type SourceRole = { source_id: string; category: string; label: string };
export type SourceAssessment = SourceRole & {
  evidence_id: string;
  reason: string;
  quote: string;
  locator: string;
  source: ClaimCitation['source'];
};
export type SourceAssessments<T = SourceAssessment> = {
  schema_version: 1;
  domain_pack: string;
  domain_pack_version: string;
  method: 'editor_assessment';
  items: T[];
};
export type SourceRoleOptions = {
  schema_version: 1;
  domain_pack: string;
  domain_pack_version: string;
  limit: number;
  categories: { category: string; label: string }[];
};
export type SourceRoleDraft = Pick<
  SourceAssessment,
  'source_id' | 'evidence_id' | 'category' | 'reason'
>;

export function reviewCitations(value: ReviewedClaim) {
  return [
    ...new Map(
      [
        ...value.evidence,
        ...value.comparisons.flatMap((item) => item.evidence),
      ].map((citation) => [citation.id, citation]),
    ).values(),
  ];
}
export function sourceRoleDrafts(value: ReviewedClaim): SourceRoleDraft[] {
  return (value.source_assessments?.items || []).map(
    ({ source_id, evidence_id, category, reason }) => ({
      source_id,
      evidence_id,
      category,
      reason,
    }),
  );
}
export function validSourceRoles(
  items: SourceRoleDraft[],
  citations: ClaimCitation[],
  options: SourceRoleOptions,
) {
  return (
    items.length <= options.limit &&
    new Set(items.map((item) => item.source_id)).size === items.length &&
    items.every(
      (item) =>
        item.reason.trim().length >= 5 &&
        item.reason.trim().length <= 500 &&
        options.categories.some(
          (option) => option.category === item.category,
        ) &&
        citations.some(
          (citation) =>
            citation.valid &&
            citation.id === item.evidence_id &&
            citation.source.id === item.source_id,
        ),
    )
  );
}
