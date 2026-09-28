import type { PersonalFollow } from './research-following';
import type { PublicDossier } from './publication';

export interface FollowState extends PersonalFollow {
  publication_id: string;
  publication: Omit<PublicDossier, 'body' | 'sources'> | null;
  available: boolean;
  following: boolean;
  revision: number;
  marker: string | null;
  unread: boolean;
}
export interface FollowPage {
  items: FollowState[];
  total: number;
  offset: number;
  page_size: number;
}
export interface PublicOrigin {
  source_url: string;
  snapshot: PublicDossier;
  snapshot_sha256: string;
  copied_at: string;
}
export interface ReuseDraft {
  expected_revision: number;
  name: string;
  goal: string;
}
export interface ReusePreview {
  draft: ReuseDraft;
  snapshot: PublicDossier;
  source_url: string;
  snapshot_sha256: string;
  preview_token: string;
  preview_expires_at: string;
}
export function reuseDraft(row: PublicDossier): ReuseDraft {
  return {
    expected_revision: row.revision,
    name: row.title.slice(0, 160),
    goal: row.summary,
  };
}
export function reuseCommand(
  preview: ReusePreview,
  requestKey: string,
  confirmed: boolean,
) {
  return {
    expected_revision: preview.draft.expected_revision,
    name: preview.draft.name,
    goal: preview.draft.goal,
    preview_token: preview.preview_token,
    preview_expires_at: preview.preview_expires_at,
    request_key: requestKey,
    confirm_private_copy: confirmed,
  };
}
