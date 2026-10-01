import type { MonitoringOutcome } from './web-research';
import type { InvestigationSummary } from './investigation';

export type MonitoringTrigger = {
  id: string;
  match_id: string | null;
  evaluation_fingerprint: string | null;
  source_kind: 'topic_match' | 'watched_page';
  source_identifier: string;
  source_revision: string;
  page: PageChange | null;
  policy_revision: number;
  matched_at: string;
  created_at: string;
  state: 'pending' | 'started' | 'skipped';
  reason: string;
  source: { title: string; url: string; sha256: string };
  investigation: InvestigationSummary | null;
  outcome?: MonitoringOutcome | null;
};
export type MonitoringResearch = {
  dossier_id: string;
  can_manage: boolean;
  policy: {
    enabled: boolean;
    include_page_changes: boolean;
    page_disclosure: string;
    page_readiness: {
      allowed: boolean;
      linked: number;
      active: number;
      reason: string;
    };
    revision: number;
    daily_limit: number;
    used_today: number;
    starts_on: string | null;
    checked_at: string | null;
    reason: string;
    disclosure: string;
    history: {
      revision: number;
      action: string;
      at: string;
      daily_limit: number;
      include_page_changes?: boolean;
      reason: string;
    }[];
  };
  items: MonitoringTrigger[];
  total: number;
  offset: number;
  page_size: number;
};

export type PageChange = {
  document_id: string;
  version_id: string;
  revision: number;
  content_hash?: string;
  before_characters?: number;
  after_characters?: number;
  previous: {
    version_id: string;
    revision: number;
    captured_at: string;
    content_hash?: string;
  };
  first_difference: number;
  excerpt_start: number;
  before: string;
  after: string;
  partial: boolean;
  preview_partial: boolean;
};

export function currentMonitoring(
  data: MonitoringResearch | null,
  error: string,
  dossierId: string,
) {
  return !error && data?.dossier_id === dossierId ? data : null;
}
