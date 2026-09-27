import type { InvestigationSummary } from './investigation';

export type MonitoringTrigger = {
  id: string;
  match_id: string;
  evaluation_fingerprint: string;
  policy_revision: number;
  matched_at: string;
  created_at: string;
  state: 'pending' | 'started' | 'skipped';
  reason: string;
  source: { title: string; url: string; sha256: string };
  investigation: InvestigationSummary | null;
};
export type MonitoringResearch = {
  dossier_id: string;
  can_manage: boolean;
  policy: {
    enabled: boolean;
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
      reason: string;
    }[];
  };
  items: MonitoringTrigger[];
  total: number;
  offset: number;
  page_size: number;
};

export function currentMonitoring(
  data: MonitoringResearch | null,
  error: string,
  dossierId: string,
) {
  return !error && data?.dossier_id === dossierId ? data : null;
}
