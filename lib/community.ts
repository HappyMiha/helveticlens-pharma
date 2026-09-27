import type { InvestigationSummary } from './investigation';
import type { PublicContent } from './publication';

export type ContributionContent = Pick<
  PublicContent,
  'author_label' | 'body' | 'sources'
>;
export interface Contribution extends ContributionContent {
  kind?: 'comment' | 'url' | 'correction' | 'research_request' | 'file';
  file_name?: string;
  byte_size?: number;
  sha256?: string;
  research?: InvestigationSummary | null;
  id: string;
  revision: number;
  publication_revision: number;
  created_at: string;
  updated_at: string;
  status?: 'visible' | 'hidden' | 'removed';
  can_edit?: boolean;
  can_remove?: boolean;
  can_moderate?: boolean;
  moderation_reason?: string;
  history?: {
    revision: number;
    action: string;
    reason: string;
    created_at: string;
  }[];
}
export interface DiscussionPage {
  items: Contribution[];
  total: number;
  offset: number;
  page_size: number;
  publication_revision: number;
  can_post: boolean;
  can_moderate: boolean;
}
export function contributionDraft(
  value?: ContributionContent,
): ContributionContent {
  return value
    ? {
        author_label: value.author_label,
        body: value.body,
        sources: value.sources.map(({ title, url }) => ({ title, url })),
      }
    : { author_label: '', body: '', sources: [] };
}
export function discussionPath(id: string, offset = 0, workspace = false) {
  return `/public-dossiers/${encodeURIComponent(id)}/discussion${workspace ? '/workspace' : ''}?offset=${offset}`;
}
