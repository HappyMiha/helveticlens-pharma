export type ChangeKind = 'CORROBORATES' | 'CONTRADICTS' | 'UPDATES';
export type ComparedFinding = {
  id: string;
  investigation_id: string;
  statement: string;
  status: string;
  revision: number;
  human_status?: string;
  review_requirement?: { required: boolean; accepted_for_use: boolean; reasons: string[] };
  evidence: {
    quote: string;
    locator: string;
    relation: string;
    source: {
      id: string;
      title: string;
      url: string;
      kind: string;
      sha256: string;
      captured_at: string;
    };
  } | null;
};
export type EvidenceChange = {
  id: string;
  kind: ChangeKind;
  explanation: string;
  status: 'active' | 'dismissed';
  revision: number;
  created_at: string;
  updated_at: string;
  previous_revision: number;
  previous_status: string;
  previous: ComparedFinding;
  current: ComparedFinding;
  basis: string;
  history: {
    revision: number;
    from: string;
    to: string;
    reason: string;
    at: string;
  }[];
};
export type EvidenceChangesPage = {
  items: EvidenceChange[];
  total: number;
  offset: number;
  page_size: number;
  publication_revision: number | null;
  coverage: string;
  can_review?: boolean;
};

/** Never revive an old server snapshot after a failed or changed-audience read. */
export function currentChanges(
  data: EvidenceChangesPage | null,
  error: string,
  initial: EvidenceChangesPage | null,
  offset: number,
  includeDismissed: boolean,
  publicationRevision?: number,
) {
  if (error) return null;
  const value = data || (offset === 0 && !includeDismissed ? initial : null);
  if (!value || value.offset !== offset) return null;
  return value.publication_revision === (publicationRevision ?? null)
    ? value
    : null;
}
