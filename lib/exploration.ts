export type ExplorationCitation = {
  source_id: string;
  quote: string;
  locator: string;
};
export type SavedCheck = {
  basis?: 'open_question' | 'further_question';
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
export type SourceRecovery =
  | { contract: 'source-recovery/v1'; status: 'unknown' | 'evidence_changed' }
  | {
      contract: 'source-recovery/v1';
      status: 'ready';
      failed_reads: number;
      candidates_checked: number;
      reads_attempted: number;
      captures: number;
      candidate_sets_exhausted: number;
      unfinished: number;
    };
export type QueryRecovery =
  | { contract: 'query-recovery/v1'; status: 'unknown' | 'not_needed' }
  | {
      contract: 'query-recovery/v1';
      status: 'ready';
      outcome: string;
      original_query: string;
      query: string | null;
      searches_completed: number;
      searches_unavailable: number;
      captures: number;
      unfinished: boolean;
      proposal_unavailable: boolean;
    };
export type ReadRelevance =
  | { contract: 'read-relevance/v1'; status: 'unknown' }
  | {
      contract: 'read-relevance/v1';
      status: 'ready';
      assessments: (ExplorationCitation & {
        question_id: string;
        question: string;
        category:
          | 'direct'
          | 'context'
          | 'counterevidence'
          | 'unrelated'
          | 'uncertain';
        reason: string;
        limitations: ('entity' | 'jurisdiction' | 'date' | 'incomplete')[];
      })[];
      unassessed: number;
      alternative_reads: number;
      unfinished: number;
    };
export type ResearchScope =
  | {
      contract: 'observed-research-scope/v1';
      status: 'unknown' | 'evidence_changed';
    }
  | {
      contract: 'observed-research-scope/v1';
      status: 'ready';
      activity: string;
      source_recovery?: SourceRecovery;
      query_recovery?: QueryRecovery;
      read_relevance?: ReadRelevance;
      searches: ResearchAttempts;
      indexes: {
        completed: number;
        unavailable: number;
        unknown_searches: number;
      };
      reads: ResearchAttempts;
      candidates: {
        retrieved: number;
        not_evaluated: number;
        evaluation_unavailable: number;
        selected_not_read: number;
      };
      material: {
        sources: number;
        passages: number;
        truncated_sources: number;
        unknown_reader_scope: number;
      };
      questions: { open: number; not_started: number };
      budget_stops: string[];
    };
type ResearchAttempts = {
  completed: number;
  unavailable: number;
  interrupted: number;
  running: number;
};
export type ResearchActivity =
  | {
      contract: 'research-activity/v1';
      status:
        | 'unknown'
        | 'evidence_changed'
        | 'paused'
        | 'finished'
        | 'waiting'
        | 'stale';
    }
  | {
      contract: 'research-activity/v1';
      status: 'working';
      phase: string;
      question: string;
      observed_at: string;
      valid_for_ms: number;
      checking_alternative?: boolean;
      testing_query?: boolean;
      latest_source: {
        id: string;
        title: string;
        url: string;
        captured_at: string;
      } | null;
    };
export type BranchQuestionAssessments =
  | {
      contract: 'branch-question-assessment/v1';
      status: 'unknown' | 'evidence_changed';
    }
  | {
      contract: 'branch-question-assessment/v1';
      status: 'ready';
      unassessed: number;
      outdated?: number;
      assessments: (Pick<
        QuestionAssessment,
        'question_id' | 'question' | 'status' | 'points' | 'limitations'
      > & {
        stage?: 'final_briefing';
        saved_at?: string;
        earlier?: Pick<
          QuestionAssessment,
          'status' | 'points' | 'limitations'
        >[];
      })[];
    };
export type ExplorationState = {
  question_assessments?: BranchQuestionAssessments;
  current_activity?: ResearchActivity;
  research_scope?: ResearchScope;
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
      read_preparation?: {
        contract: 'read-informed-research/v1';
        assessed_sources: number;
        unassessed_sources: number;
      } | null;
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
    question_updates?: { status: 'unavailable' };
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
