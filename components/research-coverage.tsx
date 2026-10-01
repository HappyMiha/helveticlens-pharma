'use client';

import { date } from '@/lib/api';
import { sourceReference } from '@/lib/source-reading';
import { coverageSentence, type ResearchCoverage } from '@/lib/research-coverage';

export function ResearchCoverageReading({ value }: { value?: ResearchCoverage | null }) {
  if (!value?.recorded || value.contract !== 'research-coverage/v1') return null;
  const unchecked = value.candidates.filter(source => ['not_checked', 'failed', 'interrupted', 'unknown'].includes(source.read_status));
  return (
    <details className="dossier-secondary research-coverage">
      <summary>What was checked</summary>
      <p>{coverageSentence(value)}</p>
      {value.summary.reused_sources > 0 && <p>Earlier evidence keeps its original date. Reusing it does not mean the source was checked again.</p>}
      {value.sources.length > 0 && <ul className="coverage-list">
        {value.sources.map(source => {
          const href = sourceReference(source.url)?.href;
          return <li key={source.id}>
            {href ? <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc">{source.title} ↗</a> : <strong>{source.title}</strong>}
            <p className="coverage-caption">
              {source.read_status === 'reused' ? 'Retained evidence' : source.read_status === 'unchanged' ? 'Previously captured text' : 'Captured passages'}
              {' · '}{date(source.captured_at)}
              {source.analysis_status === 'failed' ? ' · Analysis unavailable' : source.analysis_status === 'analysed' ? ' · Analysed' : ''}
            </p>
          </li>;
        })}
      </ul>}
      {(unchecked.length > 0 || value.summary.omitted_candidates > 0) && <p>
        {unchecked.length > 0 && `${unchecked.length} discovered source${unchecked.length === 1 ? '' : 's'} could not be read or remain unchecked. `}
        {value.summary.omitted_candidates > 0 && `${value.summary.omitted_candidates} further candidates were outside this research pass.`}
      </p>}
      {value.channels.length > 0 && <details>
        <summary>Search coverage</summary>
        <ul className="coverage-list">{value.channels.map((channel, index) => <li key={`${channel.name}-${index}`}>
          <strong>{channel.name}</strong>{' — '}
          {channel.status === 'complete' ? channel.count === 0 ? 'No candidates returned' : `${channel.count ?? 'Unknown number of'} candidates returned` : channel.status === 'running' ? 'In progress' : channel.status === 'unknown' ? 'Outcome not recorded' : 'Unavailable'}
        </li>)}</ul>
      </details>}
      {value.open_questions.length > 0 && <details>
        <summary>Questions still open</summary>
        <ul>{value.open_questions.map((item, index) => <li key={index}>{item.question}</li>)}</ul>
      </details>}
      <p className="coverage-caption">This describes the sources checked for this research. Missing results do not prove that no evidence exists.</p>
    </details>
  );
}
