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
