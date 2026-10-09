import type { ExplorationCitation, QuestionAssessment } from './exploration';

export type MissionAnswer = Pick<
  QuestionAssessment,
  'status' | 'points' | 'limitations'
>;
export type ProfessionalFact = ExplorationCitation & {
  domain: 'legal' | 'pharma';
  dimension: string;
  value: string;
};
export type Materiality = {
  contract: 'research-materiality/v1';
  category: 'material' | 'coverage_gap' | 'findings' | 'quiet';
  reasons: string[];
  scope: string;
};
export type ResearchSourceCheck = {
  id: string;
  question_id: string;
  requested_source: string;
  origin?: 'planner_interpretation' | 'literal_request' | 'submitted_url';
  status: 'matched_read' | 'not_identified' | 'acquisition_unavailable' | 'reading_incomplete' | 'analysis_incomplete';
  reason: string;
};
export type ResearchMission = {
  contract: 'research-mission/v1';
  stage:
    | 'mapping'
    | 'deepening'
    | 'synthesizing'
    | 'waiting_for_direction'
    | 'finished'
    | 'incomplete'
    | 'evidence_changed';
  round?: number;
  stop?: string | null;
  question?: string;
  answer: MissionAnswer | null;
  requested_sources?: ResearchSourceCheck[];
  verification?: {
    status: 'partial';
    pending_checks: number;
    reasons: string[];
    basis: string;
  };
  checkpoints: {
    round: number;
    answer?: MissionAnswer;
    reason: string;
    action: string;
    gaps: (ExplorationCitation & { question: string; purpose: string })[];
  }[];
  documents?: {
    url: string;
    portions: number;
    title?: string;
    pages_read?: number | null;
    read_complete?: boolean;
    analysis_complete?: boolean;
    review_failed?: boolean;
    sections_analysed?: number;
    review_progress?: { phase: 'sections_and_references' | 'synthesis'; completed: number; complete: boolean };
    error?: string;
    pages: [number, number] | null;
    page_count: number | null;
    complete: boolean;
    next_cursor: { page: number; offset: number } | null;
    unread_reason: string | null;
    warnings: string[];
  }[];
  knowledge_deferred?: boolean;
  knowledge?: {
    claims: {
      id: string;
      statement: string;
      reading_state: string;
      human_status: string;
      evidence: ExplorationCitation[];
      later_evidence: {
        claim_id: string;
        kind: string;
        explanation: string;
        reviewed: boolean;
      }[];
    }[];
    identities: {
      id: string;
      names: string[];
      basis: string;
      mentions: {
        id: string;
        quote: string;
        locator: string;
        identifier: { value: string; issuer: string; jurisdiction: string };
        source: { id: string; title: string; url: string };
      }[];
    }[];
    document_origins: {
      sha256: string;
      independence: string;
      sources: { id: string; url: string; title: string }[];
    }[];
    professional_context: {
      facts: ProfessionalFact[];
      unassessed_sources: number;
      scope: string;
    };
    scope: { note: string; truncated: boolean };
  };
};
