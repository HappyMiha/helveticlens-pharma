import { date } from '@/lib/api';
import type { Investigation } from '@/lib/investigation';
import { readable } from '@/lib/investigation';

export function DossierTimeline({ value }: { value: Investigation }) {
  return (
    <ol className="dossier-timeline">
      {value.activity.map((event) => (
        <li key={event.sequence}>
          <time dateTime={event.created_at}>{date(event.created_at)}</time>
          <div>
            <strong>{readable(event.kind)}</strong>
            <p>
              {event.detail.reason ||
                event.detail.name ||
                (event.detail.phase ? readable(event.detail.phase) : '')}
            </p>
            {event.detail.source_id && (
              <a href={`#source-${event.detail.source_id}`}>Source evidence</a>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TransparencyPanel({ value }: { value: Investigation }) {
  const steps = value.branches.flatMap((b) => b.steps);
  const actions = [
    ['plan', 'Research planning'],
    ['search', 'Source discovery'],
    ['gate', 'Candidate relevance decisions'],
    ['gate_review', 'Uncertain candidate assessment'],
    ['reflect', 'Evidence gaps and follow-up questions'],
    ['read', 'Source retrieval'],
    ['extract', 'Claim and entity extraction'],
  ];
  return (
    <details className="transparency-panel" id="research-method">
      <summary>How was this produced?</summary>
      <p>{value.evidence_basis}</p>
      <dl className="transparency-facts">
        <div>
          <dt>Captured sources</dt>
          <dd>{value.sources.length}</dd>
        </div>
        <div>
          <dt>Primary / secondary classification</dt>
          <dd>
            {
              value.sources.filter((source) => source.snapshot?.source_class)
                .length
            }{' '}
            sources have cited AI classifications; these are not independent
            verification.
          </dd>
        </div>
        <div>
          <dt>Research plan</dt>
          <dd>Version {value.plan_version || 'pending'}</dd>
        </div>
      </dl>
      <h4>Recorded actions</h4>
      <ul>
        {actions.map(([phase, label]) => {
          const completed = steps.filter(
            (s) => s.phase === phase && s.status === 'completed',
          ).length;
          const interrupted = steps.filter(
            (s) =>
              s.phase === phase && !['running', 'completed'].includes(s.status),
          ).length;
          return (
            <li key={phase}>
              {label} · {completed} completed
              {interrupted > 0 &&
                ` · ${interrupted} unavailable or interrupted`}
            </li>
          );
        })}
      </ul>
      <p>{value.coverage}</p>
      {value.research && (
        <details>
          <summary>Candidate decisions & model routing</summary>
          <p>
            Rejected and uncertain candidates are research traces, not source
            evidence.
          </p>
          {value.branches.map((branch) => (
            <div key={branch.id} className="research-debug-branch">
              <h4>{branch.query}</h4>
              {(branch.decisions || []).map((decision, index) => (
                <p key={`${decision.id}:${index}`}>
                  {decision.title} · {readable(decision.verdict)} ·{' '}
                  {decision.engine || 'No decision engine'}
                  {decision.model ? ` (${decision.model})` : ''}.{' '}
                  {decision.reason || decision.basis}
                </p>
              ))}
              {(branch.model_routes || []).map((route) => (
                <p key={route.step_id}>
                  {readable(route.phase)} · {route.provider} / {route.model}.{' '}
                  {route.basis}
                </p>
              ))}
            </div>
          ))}
        </details>
      )}
      <details>
        <summary>Research plan & available tools</summary>
        {value.plans.map((plan) => (
          <div className="investigation-plan" key={plan.id}>
            <strong>Plan {plan.version}</strong>
            <p>{plan.reason}</p>
            {plan.document.trigger && (
              <a href={`#source-${plan.document.trigger.source_id}`}>
                Triggering evidence
              </a>
            )}
            <small>{date(plan.created_at)}</small>
          </div>
        ))}
        {value.activity
          .flatMap((event) => event.detail.capabilities || [])
          .map((capability) => (
            <p key={capability.id}>
              {capability.description} ·{' '}
              {capability.available ? 'Available' : 'Unavailable'}
            </p>
          ))}
      </details>
    </details>
  );
}
