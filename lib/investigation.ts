export type InvestigationSummary = {
  id: string;
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
};
export type Investigation = InvestigationSummary & {
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
    steps: { id: string; phase: string; status: string }[];
  }[];
  sources: {
    id: string;
    kind: string;
    title: string;
    url: string;
    sha256: string;
    created_at: string;
    snapshot: { scope: string; excerpts: { text: string; passage: string }[] };
  }[];
  claims: {
    id: string;
    statement: string;
    status: string;
    revision: number;
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
      capabilities?: { id: string; description: string; available: boolean }[];
    };
  }[];
  evidence_basis: string;
  coverage: string;
};
export const isRunning = (value: InvestigationSummary | null) =>
  !!value && ['queued', 'running'].includes(value.status);
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
