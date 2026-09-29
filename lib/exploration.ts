export type ExplorationCitation = {
  source_id: string;
  quote: string;
  locator: string;
};
export type SavedCheck = {
  investigation_id: string;
  question_id: string;
  question: string;
  original_question: string;
  purpose: string;
  why: string;
  quote: string;
  locator: string;
  source: { id: string; title: string; url: string; captured_at: string };
};
export type CaptureReference = {
  id: string;
  investigation_id: string;
  title: string;
  url: string;
  captured_at: string;
};
export type CaptureProgress =
  | { status: 'evidence_changed' }
  | {
      status: 'ready';
      counts: {
        repeated: number;
        changed_capture: number;
        unmatched: number;
        unestablished: number;
      };
      scope: {
        previous_episodes: number;
        previous_captures: number;
        current_captures: number;
        truncated: boolean;
      };
      items: {
        current: CaptureReference;
        previous: CaptureReference | null;
        classification:
          | 'repeated'
          | 'changed_capture'
          | 'unmatched'
          | 'unestablished';
        comparison: { basis: string; temporal_basis: string };
      }[];
    };
export type QuestionAssessment = {
  contract: 'selected-question-assessment/v1';
  question_id: string;
  question: string;
  investigation_id: string;
  selected_from_investigation_id: string;
  status: 'possible_answer' | 'partial' | 'conflicting' | 'not_found';
  points: {
    statement: string;
    evidence: (ExplorationCitation & {
      role: 'support' | 'counterevidence' | 'context';
    })[];
  }[];
  limitations: string[];
};
export type ExplorationState = {
  capture_progress?: CaptureProgress | null;
  next_check?: SavedCheck | null;
  continuation?:
    | (SavedCheck & { status: 'ready' })
    | { status: 'evidence_changed' }
    | null;
  status:
    | 'exploring'
    | 'ready'
    | 'no_evidence'
    | 'unavailable'
    | 'evidence_changed';
  revision: number;
  continued_by?: string;
  orientation?: {
    status: 'scheduled' | 'ready' | 'unavailable' | 'evidence_changed';
    saved_at?: string;
    revision?: number;
    briefing: null | {
      interpretations: (ExplorationCitation & {
        meaning: string;
        why: string;
        signal: 'possible' | 'questioned';
      })[];
      uncertainties: string[];
    };
  };
  changes_unavailable?: boolean;
  changes?: (ExplorationCitation & {
    question_id: string;
    earlier_meaning: string;
    meaning: string;
    why: string;
    signal: 'questioned' | 'refined';
    question: string;
    status: string;
    waiting_reason?: string | null;
    searches_completed: number;
    reads_completed: number;
  })[];
  briefing: null | {
    assessment?: QuestionAssessment;
    understanding: string;
    findings: (ExplorationCitation & {
      statement: string;
      basis: 'direct' | 'contradiction' | 'analogy';
    })[];
    uncertainties: string[];
    clarification: string;
    directions: (ExplorationCitation & { question: string; why: string })[];
  };
  sources: {
    id: string;
    title: string;
    url: string;
    captured_at: string;
    excerpts: { text: string; passage: string }[];
  }[];
};
