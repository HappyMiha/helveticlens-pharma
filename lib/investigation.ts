import type { MonitoringOutcome } from './web-research';
import type { ResearchCoverage } from './research-coverage';
import type { ExplorationState } from './exploration';
import type { ResearchState } from './research-engine';
import type { MonitoringTrigger } from './monitoring-research';
export type ContributionOriginal = {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string;
  byte_size: number;
  sha256: string;
  author: string;
  created_at: string;
};
export type InvestigationSummary = {
  exploratory?: boolean;
  engine?: string;
  created_by_user_id?: string | null;
  id: string;
  trigger_entry_id?: string | null;
  external_discovery?: boolean;
  question: string;
  status:
    | 'queued'
    | 'running'
    | 'paused'
    | 'completed'
    | 'failed'
    | 'cancelled';
  revision: number;
  plan_version: number;
  event_sequence: number;
  stop_reason: string;
  created_at: string;
  updated_at: string;
};
export type EvidenceLink = {
  source_id: string;
  quote: string;
  locator: string;
  claim_id?: string;
  amount_text?: string;
  period_text?: string;
  identity?: string;
  identifier?: {
    value: string;
    issuer: string;
    jurisdiction: string;
    kind: string;
  } | null;
  mentions?: (EvidenceLink & { name: string })[];
};
export type Investigation = InvestigationSummary & {
  retry?: { available: boolean };
  coverage_manifest?: ResearchCoverage | null;
  outcome?: MonitoringOutcome | null;
  exploration?: ExplorationState | null;
  research?: ResearchState | null;
  monitoring_trigger?: MonitoringTrigger | null;
  web_research_trigger?: {
    id: string;
    policy_revision: number;
    scheduled_for: string;
  } | null;
  original?: ContributionOriginal | null;
  plans: {
    id: string;
    version: number;
    reason: string;
    created_at: string;
    document: { trigger: EvidenceLink | null };
  }[];
  branches: {
    id: string;
    query: string;
    status: string;
    phase: string;
    reason: string;
    error: string | null;
    question_id?: string | null;
    parent_branch_id?: string | null;
    depth?: number | null;
    outcome?: string;
    decisions?: {
      id: string;
      url: string;
      title: string;
      verdict: string;
      engine: string | null;
      reason?: string;
      basis?: string;
      model?: string;
    }[];
    model_routes?: {
      step_id: string;
      phase: string;
      model: string;
      provider: string;
      basis: string;
    }[];
    steps: {
      id: string;
      phase: string;
      status: string;
      started_at?: string;
      finished_at?: string;
    }[];
  }[];
  sources: {
    id: string;
    kind: string;
    title: string;
    url: string;
    sha256: string;
    created_at: string;
    original?: ContributionOriginal | null;
    snapshot: {
      source_class?: EvidenceLink & { category: string; basis: string };
      duplicate_of?: string;
      independence?: string;
      unchanged_from?: string | null;
      retained_origin?: { source_id?: string; captured_at?: string | null };
      scope: string;
      excerpts: { text: string; passage: string }[];
    };
  }[];
  claims: {
    id: string;
    statement: string;
    status: string;
    revision: number;
    later_evidence?: {
      status: string | null;
      changes: { kind: string; count: number }[];
    } | null;
    history: {
      revision: number;
      from: string;
      to: string;
      at: string;
      basis: string;
    }[];
  }[];
  evidence: (EvidenceLink & {
    id: string;
    claim_id: string;
    relation: string;
  })[];
  entities: {
    id: string;
    name: string;
    kind: string;
    evidence: EvidenceLink;
  }[];
  relationships: {
    id: string;
    subject_id: string;
    object_id: string;
    predicate: string;
    evidence: EvidenceLink;
  }[];
  activity: {
    sequence: number;
    kind: string;
    created_at: string;
    detail: {
      reason?: string;
      name?: string;
      phase?: string;
      source_id?: string;
      capabilities?: { id: string; description: string; available: boolean }[];
    };
  }[];
  evidence_basis: string;
  coverage: string;
};
export const isRunning = (value: InvestigationSummary | null) =>
  !!value && ['queued', 'running'].includes(value.status);
export function researchDeliveryLabel(
  value: InvestigationSummary & { exploration?: ExplorationState | null },
) {
  const state = value.exploration;
  if (state?.status === 'evidence_changed' || state?.mission?.stage === 'evidence_changed')
    return 'Evidence changed';
  if (['completed', 'failed'].includes(value.status)) {
    const answer = state?.mission?.answer;
    if (answer?.status === 'not_found') return 'Answer not established';
    if (answer?.points.length) {
      if (value.status === 'failed' || answer.status === 'partial') return 'Partial answer saved';
      if (answer.status === 'conflicting') return 'Conflicting evidence';
      return 'Answer saved';
    }
    return value.status === 'failed' ? 'Research incomplete' : 'Research saved';
  }
  return readable(value.status);
}
export function canRetryResearch(value: Pick<Investigation, 'status' | 'retry' | 'exploration'>) {
  return ['completed', 'failed'].includes(value.status) &&
    value.retry?.available === true && !value.exploration?.continued_by &&
    value.exploration?.status !== 'evidence_changed' &&
    value.exploration?.mission?.stage !== 'evidence_changed';
}
export function readable(value: string) {
  const text = value.toLowerCase().replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
export function sourceHref(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
