import type { InvestigationSummary } from './investigation';

export type WebCoverage = {
  selected_engine: string | null;
  latency_ms: number | null;
  scope: string | null;
  error: string | null;
  retrieval: {
    lanes?: { name: string; query: string; status: string; count: number }[];
    cost_usd?: number | null;
  } | null;
  engines: {
    engine: string;
    latency_ms: number | null;
    estimated_cost_usd: number | null;
    cost_scope: string | null;
    cost_basis: {
      input_usd_per_million: number;
      output_usd_per_million: number;
    } | null;
    mean_confidence: number | null;
    confidence_definition: string | null;
    error: string | null;
  }[];
};
export type WebTrigger = {
  id: string;
  policy_revision: number;
  question: string;
  scheduled_for: string;
  created_at: string;
  investigation: InvestigationSummary;
  analysed_sources: number;
  unchanged_sources: number;
  coverage: WebCoverage[];
};
export type WebResearch = {
  dossier_id: string;
  can_manage: boolean;
  policy: {
    enabled: boolean;
    revision: number;
    question: string;
    cadence_hours: 24 | 168;
    daily_limit: number;
    used_today: number;
    readiness: { configured: boolean; reason: string };
    next_run_at: string | null;
    checked_at: string | null;
    reason: string;
    disclosure: string;
    history: {
      revision: number;
      action: string;
      at: string;
      question: string;
      cadence_hours: number;
      reason: string;
    }[];
  };
  items: WebTrigger[];
  total: number;
  offset: number;
  page_size: number;
};

export function currentWebResearch(
  data: WebResearch | null,
  error: string,
  dossierId: string,
) {
  return !error && data?.dossier_id === dossierId ? data : null;
}
