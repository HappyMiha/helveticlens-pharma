import type { EvidenceLink } from './investigation';

export const defaultResearchLimits = {
  branches: 8,
  depth: 4,
  sources_per_branch: 2,
  candidates_per_branch: 8,
  search_requests: 24,
  source_fetches: 12,
  model_calls: 24,
  decision_calls: 128,
  active_seconds: 1200,
};
export type ResearchLimits = typeof defaultResearchLimits;
export const maximumResearchLimits: ResearchLimits = {
  branches: 48,
  depth: 16,
  sources_per_branch: 6,
  candidates_per_branch: 24,
  search_requests: 144,
  source_fetches: 96,
  model_calls: 144,
  decision_calls: 768,
  active_seconds: 14400,
};
export function nextResearchLimits(current: ResearchLimits): ResearchLimits {
  return Object.fromEntries(
    Object.entries(current).map(([key, value]) => [
      key,
      Math.min(
        maximumResearchLimits[key as keyof ResearchLimits],
        ['sources_per_branch', 'candidates_per_branch'].includes(key)
          ? value
          : value * 2,
      ),
    ]),
  ) as ResearchLimits;
}
export type ResearchQuestion = {
  id: string;
  question: string;
  query: string;
  purpose: string;
  priority: number;
  kind: string;
  depth: number;
  parent_branch_id: string | null;
  claim_id: string | null;
  trigger: EvidenceLink | null;
  branch_id: string | null;
  status: 'open' | 'investigating' | 'evidence_found' | 'unresolved';
  outcome?: string;
  waiting_reason?: string | null;
  answer_evidence_ids?: string[];
};
export type ResearchState = {
  version: 'iterative-v1';
  limits: ResearchLimits;
  used: Partial<ResearchLimits>;
  questions: ResearchQuestion[];
  objective: string;
  completion_criteria: string[];
  stops: string[];
  budget_basis: string;
  search_budget_scope?: 'paid_provider_requests';
  decision_order?: 'jev_first' | 'laya_first';
};
export function questionLabel(question: ResearchQuestion) {
  return {
    open: 'Waiting to investigate',
    investigating: 'Investigating',
    evidence_found: 'New evidence found',
    unresolved: 'Still unresolved',
  }[question.status];
}
export const limitLabels: Record<keyof ResearchLimits, string> = {
  branches: 'Research directions',
  depth: 'Follow-up depth',
  sources_per_branch: 'Sources per direction',
  candidates_per_branch: 'Candidates per direction',
  search_requests: 'Search index requests',
  source_fetches: 'Source reads',
  model_calls: 'Analysis requests',
  decision_calls: 'Relevance decision reservations',
  active_seconds: 'Active execution seconds',
};
