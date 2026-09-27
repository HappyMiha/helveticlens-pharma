import type { Investigation } from './investigation';

export type LensState =
  | 'idle'
  | 'searching'
  | 'reading'
  | 'extracting'
  | 'cross-referencing'
  | 'verifying'
  | 'contradiction'
  | 'synthesizing'
  | 'complete';
export type LensActivity = { state: LensState; label: string; detail: string };

/** Only a persisted, recent in-flight step can activate the optical treatment.
 * Other Lens states are reserved for corresponding future native capabilities. */
export function investigationActivity(
  value: Investigation,
  now: number,
): LensActivity {
  if (value.status === 'completed')
    return {
      state: 'complete',
      label: 'Research finished',
      detail: value.stop_reason,
    };
  if (value.status !== 'running')
    return {
      state: 'idle',
      label:
        value.status === 'queued'
          ? 'Waiting to begin'
          : `Research ${value.status}`,
      detail: value.stop_reason,
    };
  const branch = value.branches.find(
    (b) =>
      b.status === 'running' && b.steps.some((s) => s.status === 'running'),
  );
  const step = branch?.steps.find((s) => s.status === 'running');
  const started = step?.started_at ? Date.parse(step.started_at) : NaN;
  // Native operations have a 90-second maximum; stale snapshots never look live.
  if (
    !step ||
    !Number.isFinite(started) ||
    now - started > 95_000 ||
    now < started - 5_000
  )
    return {
      state: 'idle',
      label: 'Waiting for a saved checkpoint',
      detail: 'Completed evidence remains available below.',
    };
  const phase = {
    search: { state: 'searching', label: 'Discovering sources' },
    read: { state: 'reading', label: 'Reading source material' },
    extract: { state: 'extracting', label: 'Extracting claims and evidence' },
  }[step.phase] as Pick<LensActivity, 'state' | 'label'> | undefined;
  return phase
    ? { ...phase, detail: branch?.query || '' }
    : { state: 'idle', label: 'Research in progress', detail: '' };
}

export function evidenceCounts(value: Investigation) {
  return {
    sources: value.sources.length,
    claims: value.claims.length,
    contested: value.claims.filter((c) => c.status === 'CONTESTED').length,
    unfinished: value.branches.filter((b) => b.status !== 'completed').length,
  };
}

export function sourceUsage(value: Investigation, sourceId: string) {
  const links = value.evidence.filter((e) => e.source_id === sourceId);
  return {
    claims: [...new Set(links.map((e) => e.claim_id))],
    contradictions: new Set(
      links.filter((e) => e.relation === 'CONTRADICTS').map((e) => e.claim_id),
    ).size,
  };
}
