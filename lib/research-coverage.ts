export type ResearchCoverage = {
  contract: 'research-coverage/v1';
  recorded: boolean;
  status: 'in_progress' | 'partial' | 'bounded_checks_completed';
  summary: {
    captured_sources: number;
    reused_sources: number;
    failed_steps: number;
    unavailable_channels: number;
    unchecked_sources: number;
    open_questions: number;
    omitted_candidates: number;
  };
  channels: { name: string; status: string; count: number | null; reason?: string; scope?: string; more_available?: boolean }[];
  sources: {
    id: string;
    title: string;
    url: string;
    captured_at: string;
    read_status: string;
    analysis_status: string;
    fresh_source_check: boolean;
    extraction_methods?: string[];
    extraction_warnings?: string[];
    text_truncated?: boolean;
  }[];
  saved_evidence?: { method?: string; retrieval?: { semantic_status?: string; prepared_records?: number; examined_records?: number } | null };
  skipped_channels?: { name: string; reason: string }[];
  candidates: { title: string; url: string; read_status: string }[];
  open_questions: { question: string; status: string; reason?: string | null }[];
};

export function coverageSentence(value: ResearchCoverage) {
  const count = value.summary;
  const sources = `${count.captured_sources} source${count.captured_sources === 1 ? '' : 's'} with saved passages`;
  const reused = count.reused_sources ? `; ${count.reused_sources} from earlier research` : '';
  const gaps = count.unavailable_channels || count.failed_steps || count.unchecked_sources || count.omitted_candidates;
  return `${sources}${reused}. ${value.status === 'in_progress' ? 'Research is continuing.' : gaps || value.status === 'partial' ? 'Some checks remain incomplete.' : 'The planned checks finished.'}`;
}
