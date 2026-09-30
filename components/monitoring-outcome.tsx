'use client';
import type { ComparedFinding } from '@/lib/claim-evolution';
import type { MonitoringOutcome } from '@/lib/web-research';
import { Button } from './ui/button';

const progress = {
  queued: ['Waiting to check', 'This check has not started yet.'],
  running: [
    'Checking the saved question',
    'The result will appear when this check finishes.',
  ],
  paused: [
    'Check paused',
    'The available work is saved. Open the research record to continue.',
  ],
  cancelled: ['Check stopped', 'This check was stopped before completion.'],
  failed: [
    'Check could not be completed',
    'This is a gap in monitoring, not evidence that nothing changed.',
  ],
  partial: [
    'Check partly completed',
    'Some work was unavailable. The evidence below covers only the completed parts.',
  ],
  unavailable: [
    'Evidence unavailable',
    'The original evidence or research scope is no longer available.',
  ],
};
const results = {
  changes: [
    'Evidence to compare',
    'New source-linked findings may affect earlier findings for this same question.',
  ],
  findings: [
    'New findings to read',
    'These source-linked findings were captured while checking your saved question.',
  ],
  unchanged: [
    'Captured sources unchanged',
    'The captured text matches the last successfully analysed version. Other sources may have changed.',
  ],
  no_matches: [
    'No sources returned',
    'This search returned no candidates. That does not establish that no relevant information exists.',
  ],
  no_findings: [
    'No supported finding to show',
    'This check did not produce a currently supported finding for this preview. Open the record for captured material and limitations.',
  ],
  pending: [
    'Result unavailable',
    'No completed result is available for this check.',
  ],
  unavailable: [
    'Evidence unavailable',
    'No current evidence can be shown for this check.',
  ],
};

function QuotedFinding({
  finding,
  label,
  onOpen,
}: {
  finding: ComparedFinding;
  label: string;
  onOpen: (id: string) => void;
}) {
  return (
    <figure>
      <figcaption>
        <strong>{label}</strong>
      </figcaption>
      <p>{finding.statement}</p>
      {finding.evidence && (
        <>
          <blockquote>{finding.evidence.quote}</blockquote>
          <figcaption>
            {finding.evidence.source.title} · {finding.evidence.locator}
          </figcaption>
        </>
      )}
      <Button variant="ghost" onClick={() => onOpen(finding.investigation_id)}>
        Open research record
      </Button>
    </figure>
  );
}

export function MonitoringOutcomeReader({
  outcome,
  onOpen,
}: {
  outcome: MonitoringOutcome;
  onOpen: (id: string) => void;
}) {
  const [title, description] =
    outcome.state === 'completed'
      ? results[outcome.finding_state] || results.unavailable
      : progress[outcome.state] || progress.unavailable;
  const showEvidence = ['completed', 'partial', 'failed'].includes(
    outcome.state,
  );
  const comparisons = showEvidence ? outcome.comparisons.slice(0, 3) : [];
  const compared = new Set(comparisons.map((item) => item.current.id));
  const findings = showEvidence
    ? outcome.findings.filter((item) => !compared.has(item.id)).slice(0, 3)
    : [];
  return (
    <div className="monitoring-outcome">
      <p>
        <strong>{title}</strong>
      </p>
      <p>{description}</p>
      {!!outcome.limitations.length && (
        <ul aria-label="Check limitations">
          {outcome.limitations.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
      )}
      {comparisons.map((change) => (
        <details key={change.id} className="research-update-comparison">
          <summary>
            {change.kind === 'CONTRADICTS'
              ? 'Possible contradiction'
              : change.kind === 'UPDATES'
                ? 'Proposed update'
                : 'Supporting evidence'}
            {' · '}
            {change.current.statement}
          </summary>
          <p className="content-origin">
            AI comparison · check both quotations
          </p>
          <QuotedFinding
            finding={change.previous}
            label="Earlier evidence"
            onOpen={onOpen}
          />
          <QuotedFinding
            finding={change.current}
            label="Later evidence"
            onOpen={onOpen}
          />
          <p className="source-meta">{change.explanation}</p>
        </details>
      ))}
      {findings.map((finding) => (
        <details key={finding.id} className="research-update-comparison">
          <summary>{finding.statement}</summary>
          <p className="content-origin">
            AI finding · source support is not independent verification
          </p>
          <QuotedFinding
            finding={finding}
            label="Captured evidence"
            onOpen={onOpen}
          />
        </details>
      ))}
      {showEvidence && (
        <p className="source-meta">
          {outcome.scope} Preview of up to three findings and three comparisons.
        </p>
      )}
    </div>
  );
}
