import type { DocumentWatch } from './contracts';

export function pageWatchStatus(watch: DocumentWatch) {
  const canCheck = watch.active && !watch.active_scan;
  const state = watch.active_scan
    ? {
        tone: 'busy',
        label:
          watch.active_scan.status === 'queued'
            ? 'Check queued'
            : 'Check in progress',
      }
    : watch.last_result === 'failed'
      ? { tone: 'warning', label: 'Last attempt failed' }
      : watch.synthetic
        ? { tone: 'warning', label: 'Synthetic evidence' }
        : !watch.last_success_at
          ? { tone: 'warning', label: 'Successful check time unknown' }
          : watch.stale
            ? { tone: 'warning', label: 'Successful check over 48 hours ago' }
            : !watch.active
              ? { tone: 'muted', label: 'Page watch paused' }
              : watch.schedule === 'needs_operator' ||
                  watch.schedule === 'unscheduled'
                ? { tone: 'warning', label: 'Schedule needs attention' }
                : { tone: 'good', label: 'Successful check recorded' };
  return { ...state, canCheck };
}

export function pageWatchResult(result: string) {
  return (
    (
      {
        baseline_created: 'Baseline saved',
        baseline_reused: 'Existing baseline reused',
        successor_added: 'Successor connected',
        changed: 'Source changes found',
        unchanged: 'No source changes found',
        failed: 'Attempt failed',
      } as Record<string, string>
    )[result] || 'Result not classified'
  );
}
