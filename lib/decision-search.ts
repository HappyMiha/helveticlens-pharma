import type { SearchHit } from './contracts';

export type DecisionMode = 'auto' | 'jev' | 'laya' | 'compare';
export interface EngineMeasurement {
  engine: 'jev' | 'laya';
  models: string[];
  error: string | null;
  strategy?: string;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  cost_basis: {
    input_usd_per_million: number;
    output_usd_per_million: number;
  } | null;
  mean_selected_probability?: number | null;
  mean_confidence?: number | null;
  scores: Record<
    string,
    { relevance: number; selected_probability: number; confidence: number }
  >;
  evaluation: {
    labelled_count: number;
    candidate_count: number;
    accuracy: number | null;
    brier_score: number | null;
    basis: string;
  };
}
export interface DecisionRun {
  id: string;
  query: string;
  mode: DecisionMode;
  status: 'running' | 'interrupted' | 'complete' | 'failed';
  revision: number;
  labels: Record<string, boolean>;
  items: SearchHit[];
  engines?: EngineMeasurement[];
  selected_engine?: string | null;
  error?: string | null;
  created_at: string;
  checked_at: string;
  coverage?: string;
  inspections?: Record<
    string,
    {
      status: string;
      error?: string;
      url: string;
      fetched_at?: string;
      sha256?: string;
      excerpts?: { text: string; passage: string; relevance: number | null }[];
      links?: { title: string; url: string }[];
      engine?: string | null;
      scope?: string;
      extracted_characters?: number;
    }
  >;
  candidates_sha256?: string;
  latency_ms?: number;
  retrieval?: {
    provider: string;
    index: string;
    service: string;
    latency_ms: number;
    omitted_records: number;
    candidate_limit: number;
    ordering?: string;
    lanes?: { name: string; status: string; count: number }[];
  };
}
export interface DecisionReadiness {
  jev_configured: boolean;
  laya_configured: boolean;
  search_configured: boolean;
  daily_limit: number;
  privacy: string;
  retention: string;
}
export const percent = (value: number | null | undefined) =>
  value == null ? 'Not measured' : `${(value * 100).toFixed(1)}%`;
export function engineIssue(code: string | null) {
  if (!code) return 'Completed';
  return (
    (
      {
        not_configured: 'Connection needed',
        credentials: 'Access needs attention',
        quota: 'Provider credit or rate limit',
        timeout: 'Timed out',
        invalid_configuration: 'Local connection needs attention',
        invalid_response: 'Provider response could not be verified',
        unavailable: 'Temporarily unavailable',
      } as Record<string, string>
    )[code] || 'Could not complete'
  );
}
