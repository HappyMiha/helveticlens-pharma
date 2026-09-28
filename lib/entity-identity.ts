export type IdentityDecision = 'same' | 'different' | 'unresolved';
export type EntityMention = {
  id: string;
  investigation_id: string;
  name: string;
  kind: string;
  identifier: {
    value: string;
    issuer: string;
    jurisdiction: string;
    kind: string;
  };
  quote: string;
  locator: string;
  source: {
    id: string;
    title: string;
    url: string;
    kind: string;
    sha256: string;
    captured_at: string;
  };
};
export type EntityIdentity = {
  id: string;
  entity_id: string;
  previous_entity_id: string;
  first: EntityMention | null;
  second: EntityMention | null;
  evidence_fingerprint: string | null;
  exact_identifier_match: boolean;
  basis: string;
  boundary: string;
  revision: number;
  decision: IdentityDecision | 'unreviewed';
  stale: boolean;
  history: {
    revision: number;
    decision: IdentityDecision;
    reason: string;
    at: string;
    reviewer: string;
    evidence_fingerprint: string;
  }[];
};
export type EntityIdentitiesPage = {
  items: EntityIdentity[];
  total: number;
  offset: number;
  page_size: number;
  publication_revision: number | null;
  can_review?: boolean;
  boundary: string;
  suggestions: {
    items: EntityIdentity[];
    entities_examined: number;
    entity_limit: number;
    entity_window_limited: boolean;
    suggestion_limit: number;
    more_suggestions: boolean;
  } | null;
};
export const identityLabels = {
  same: 'Same entity · reviewed by an editor',
  different: 'Different entities · reviewed by an editor',
  unresolved: 'Identity unresolved · reviewed by an editor',
  unreviewed: 'Possible match · awaiting review',
};
export function currentIdentities(
  data: EntityIdentitiesPage | null,
  error: string,
  offset: number,
  publicationRevision?: number,
) {
  return !error &&
    data?.offset === offset &&
    data.publication_revision === (publicationRevision ?? null)
    ? data
    : null;
}
