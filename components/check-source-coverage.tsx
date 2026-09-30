'use client';
import { date } from '@/lib/api';
import { sourceReference } from '@/lib/source-reading';
import type { CheckSourceCoverage, CheckedSource } from '@/lib/web-research';
import { Button } from './ui/button';

const reading = {
  read: 'Read successfully',
  reading: 'Reading started; no result recorded',
  failed: 'Could not read',
  interrupted: 'Reading interrupted',
  not_checked: 'Not checked this time',
  unavailable: 'Source no longer available',
};
const analysis = {
  analysed: 'Evidence analysed',
  analysing: 'Analysis started; no result recorded',
  failed: 'Read, but analysis failed',
  interrupted: 'Read, but analysis was interrupted',
  not_started: 'Analysis not completed',
  not_needed: 'Matches an earlier analysed capture; analysis was not repeated',
  unavailable: 'Analysis unavailable',
};
const changes = {
  first_capture: 'First capture without an earlier analysed baseline',
  changed: 'Captured text differs from the earlier analysed version',
  unchanged: 'Captured text unchanged',
};

function SourceRow({
  source,
  onOpen,
}: {
  source: CheckedSource;
  onOpen: (id: string) => void;
}) {
  const href = sourceReference(source.url || '')?.href;
  return (
    <li>
      <strong>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
            {source.title} ↗
          </a>
        ) : source.title}
      </strong>
      <p>{reading[source.read_status] || 'Read status unavailable'}</p>
      {source.read_status === 'read' && (
        <>
          {source.capture_state && <p>{changes[source.capture_state]}</p>}
          <p>{analysis[source.analysis_status] || 'Analysis status unavailable'}</p>
        </>
      )}
      {source.attempt && (
        <p className="source-meta">
          Reading started {date(source.attempt.started_at)}
          {source.attempt.finished_at && <> · finished {date(source.attempt.finished_at)}</>}
          {source.attempt_count > 1 && <> · {source.attempt_count} recorded attempts</>}
        </p>
      )}
      {source.last_success_at && (
        <p className="source-meta">Last successful analysis {date(source.last_success_at)}</p>
      )}
      {source.investigation_id && source.source_id && (
        <Button variant="ghost" onClick={() => onOpen(source.investigation_id!)}>
          {source.read_status === 'not_checked' ? 'Open earlier capture' : 'Open captured evidence'}
        </Button>
      )}
    </li>
  );
}

export function CheckSourceCoverageReader({
  value,
  onOpen,
}: {
  value: CheckSourceCoverage;
  onOpen: (id: string) => void;
}) {
  if (value.contract !== 'check-source-coverage/v1') return null;
  const read = value.sources.filter((s) => s.read_status === 'read').length;
  const failed = value.sources.filter((s) => ['failed', 'interrupted'].includes(s.read_status)).length;
  const unchecked = value.sources.filter((s) => s.read_status === 'not_checked').length;
  return (
    <details className="check-source-coverage">
      <summary>Sources in this check{value.recorded ? ` · ${read} read` : ' · history unavailable'}</summary>
      <p>{value.scope}</p>
      {value.recorded && (
        <>
          <p>{read} read · {failed} failed or interrupted · {unchecked} not checked</p>
          {value.search?.status === 'unavailable' && <p>Search failed. Previously captured sources were not checked.</p>}
          {value.search?.status === 'interrupted' && <p>Search was interrupted. Source coverage is incomplete.</p>}
          {['running', 'not_started'].includes(value.search?.status || '') && <p>This search has not finished.</p>}
          {value.search?.status === 'completed' && !value.sources.length && <p>No readable candidates were recorded in this search.</p>}
          <ul className="coverage-list">
            {value.sources.map((source, i) => <SourceRow key={source.source_id || source.url || i} source={source} onOpen={onOpen} />)}
          </ul>
          <p className="source-meta">
            Earlier captures: up to {value.prior_limit} recent distinct sources for this exact saved question.
            {value.prior_truncated && ' More earlier material exists outside this bounded list.'}
            {!!value.prior_hidden && ' Some earlier source details are no longer available.'}
            {' '}Connected page watches have their own checks in Source coverage.
          </p>
        </>
      )}
    </details>
  );
}
