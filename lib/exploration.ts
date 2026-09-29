export type ExplorationCitation = {
  source_id: string;
  quote: string;
  locator: string;
};
export type ExplorationState = {
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
