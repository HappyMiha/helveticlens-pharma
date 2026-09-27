import type { Investigation, InvestigationSummary } from './investigation';

export type PublicResearch = Investigation & {
  publication_id: string;
  contribution_id: string;
};
export type PublicResearchPage = {
  items: InvestigationSummary[];
  total: number;
  offset: number;
  page_size: number;
  publication_revision: number;
  living_research: boolean;
};
export type PublicKnowledgePage = {
  items: {
    id: string;
    kind: 'dossier' | 'claim' | 'entity' | 'source' | 'investigation';
    label: string;
    text: string;
    dossier_title: string;
    href: string;
  }[];
  total: number;
  offset: number;
  page_size: number;
  query: string;
  method: string;
};
export function publicLocator(value: string) {
  return /^[\p{L}\p{N}_-]{1,180}$/u.test(value);
}
