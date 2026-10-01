import type { EvidenceChange } from './claim-evolution';

export type ResearchSummary = {
  total: number;
  unseen: number;
  latest_at: string | null;
};
export type PersonalFollow = {
  following: boolean;
  delivery_mode?: 'immediate' | 'digest' | 'silent';
  available: boolean;
  revision: number;
  marker: string | null;
  unread: boolean;
  research: ResearchSummary;
};
export type PrivateFollow = PersonalFollow & {
  dossier_id: string;
  title: string;
};
export type PrivateFollowPage = {
  items: PrivateFollow[];
  total: number;
  offset: number;
  page_size: number;
};
export type ResearchUpdate = {
  materiality?: import('./research-mission').Materiality;
  delivery?: 'immediate' | 'digest' | 'silent' | 'waiting_for_digest';
  outcome?: import('./web-research').MonitoringOutcome | null;
  investigation_id: string;
  question: string;
  completed_at: string;
  unseen: boolean;
  source_count: number;
  finding_count: number;
  comparison_counts: Record<string, number>;
  sources: {
    id: string;
    title: string;
    url: string;
    sha256: string;
    quote: string;
    locator: string;
    truncated: boolean;
  }[];
  findings: {
    id: string;
    statement: string;
    status: string;
    source_id: string | null;
  }[];
  comparisons: EvidenceChange[];
  completion_note: string;
};
export type ResearchUpdatesPage = {
  items: ResearchUpdate[];
  total: number;
  offset: number;
  page_size: number;
  coverage: string;
};
export type ResearchAudience = 'private' | 'public';
export function researchHref(
  audience: ResearchAudience,
  dossier: string,
  investigation: string,
  anchor?: string,
) {
  const params = new URLSearchParams({ research: investigation });
  if (audience === 'private') {
    params.set('dossier', dossier);
    if (anchor) params.set('focus', anchor);
  }
  const path =
    audience === 'private'
      ? '/'
      : `/public-dossiers/${encodeURIComponent(dossier)}`;
  return `${path}?${params}#${encodeURIComponent(anchor || `investigation-${investigation}`)}`;
}
export function researchFocus(search: string, dossier: string) {
  const params = new URLSearchParams(search);
  const id = params.get('research'),
    anchor = params.get('focus');
  if (params.get('dossier') !== dossier || !id || !/^[0-9a-f-]{36}$/.test(id))
    return undefined;
  return {
    id,
    tick: 0,
    anchor:
      anchor && /^(source|claim)-[0-9a-f-]{36}$/.test(anchor)
        ? anchor
        : undefined,
  };
}
