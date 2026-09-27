import type {
  ReferenceDecision,
  ReferenceSelection,
  ReferenceLibraryResult,
} from './contracts';
export const referenceFilters: Record<ReferenceDecision, string> = {
  all: 'All review states',
  include: 'Included for AI',
  exclude: 'Excluded from AI',
  unreviewed: 'Needs review',
};
export function firstReferencePage(
  input: Pick<ReferenceSelection, 'query' | 'decision'>,
): ReferenceSelection {
  return { query: input.query.trim(), decision: input.decision, offset: 0 };
}
export function referenceLibraryPath(
  product: string,
  dossierId: string,
  selection: ReferenceSelection,
) {
  const params = new URLSearchParams({
    q: selection.query,
    decision: selection.decision,
    offset: String(selection.offset),
  });
  return `/products/${product}/dossiers/${encodeURIComponent(dossierId)}/references?${params}`;
}
export function referencePage(
  result: Pick<
    ReferenceLibraryResult,
    'query' | 'decision' | 'offset' | 'page_size'
  >,
  direction: -1 | 0 | 1,
): ReferenceSelection {
  return {
    query: result.query,
    decision: result.decision,
    offset:
      direction === 0
        ? 0
        : Math.max(0, result.offset + direction * result.page_size),
  };
}
