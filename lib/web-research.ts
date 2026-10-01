import type { ResearchCoverage } from './research-coverage';
import type { InvestigationSummary } from './investigation';
import type { ComparedFinding, EvidenceChange } from './claim-evolution';

export type MonitoringOutcome = {
  materiality?: import('./research-mission').Materiality;
  contract: 'monitoring-outcome/v1';
  state:
    | 'queued'
    | 'running'
    | 'paused'
    | 'cancelled'
    | 'failed'
    | 'partial'
    | 'completed'
    | 'unavailable';
  finding_state:
    | 'pending'
    | 'unavailable'
    | 'changes'
    | 'findings'
    | 'unchanged'
    | 'no_matches'
    | 'no_findings';
  limitations: string[];
  findings: ComparedFinding[];
  comparisons: EvidenceChange[];
  scope: string;
  source_coverage?: CheckSourceCoverage;
  coverage_manifest?: ResearchCoverage;
  question?: string;
};

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
  outcome?: MonitoringOutcome;
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

export type CheckAttempt = {
  status: 'not_started' | 'running' | 'completed' | 'unavailable' | 'interrupted';
  started_at: string | null;
  finished_at: string | null;
};
export type CheckedSource = {
  title: string;
  url: string | null;
  source_id: string | null;
  investigation_id: string | null;
  read_status: 'read' | 'reading' | 'failed' | 'interrupted' | 'not_checked' | 'unavailable';
  analysis_status: 'analysed' | 'analysing' | 'failed' | 'interrupted' | 'not_started' | 'not_needed' | 'unavailable';
  capture_state: 'first_capture' | 'changed' | 'unchanged' | null;
  attempt: CheckAttempt | null;
  attempt_count: number;
  analysis_attempt?: CheckAttempt | null;
  captured_at?: string;
  last_success_at: string | null;
};
export type CheckSourceCoverage = {
  contract: 'check-source-coverage/v1';
  recorded: boolean;
  scope: string;
  sources: CheckedSource[];
  search: CheckAttempt | null;
  prior_limit: number;
  prior_truncated: boolean;
  prior_hidden: number;
};
