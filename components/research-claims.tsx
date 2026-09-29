import type {
  ResearchClaim,
  ResearchSource,
  ResearchEditorContext,
} from '@/lib/contracts';
import { ClaimInterpretation } from './claim-interpretation';

function EditorContext({ value }: { value?: ResearchEditorContext }) {
  if (!value) return null;
  return (
    <div className="claim-method">
      <p>
        <strong>Editor context supplied to AI</strong> ·{' '}
        {value.status === 'stale'
          ? 'Evidence changed — assessments unknown'
          : value.status === 'unreviewed'
            ? 'Not reviewed'
            : 'Reviewed for this input'}
      </p>
      <ClaimInterpretation value={value.interpretation || undefined} />
      <p>
        Source roles apply only within this claim’s review. They do not prove
        authority, applicability, regulatory status or clinical value.
      </p>
      <ul>
        {value.source_assessments.items.map((item) => (
          <li key={item.citation_id}>
            {item.citation_id}: {item.label} ·{' '}
            {item.status === 'stale'
              ? 'Review again'
              : item.status.replaceAll('_', ' ')}
          </li>
        ))}
      </ul>
      {value.source_assessments.domain_pack && (
        <p className="muted">
          Source role registry: {value.source_assessments.domain_pack}{' '}
          {value.source_assessments.domain_pack_version}
        </p>
      )}
    </div>
  );
}

export function ResearchClaims({
  claims,
  sources,
}: {
  claims: ResearchClaim[];
  sources: ResearchSource[];
}) {
  return (
    <section className="research-preview-context">
      <h3>Claims supplied to AI</h3>
      <p>
        Human acceptance records an editor’s review, not independent
        verification. Machine assessment and human review remain separate.
        Conflicting evidence stays in the input.
      </p>
      {!claims.length && (
        <p>
          No complete claim groups fit this selection. Saved excerpts below can
          still contribute.
        </p>
      )}
      {claims.map((claim) => (
        <article key={claim.id}>
          <h4>{claim.statement}</h4>
          <p>
            Machine assessment: {claim.machine_status}. Human review:{' '}
            {claim.human_review.stale
              ? 'Changed — review again'
              : claim.human_review.decision?.replaceAll('_', ' ') ||
                'Not reviewed'}
            .
          </p>
          <p>Evidence: {claim.citations.join(', ')}.</p>
          <EditorContext value={claim.editor_context} />
          {claim.comparisons.map((comparison, index) => (
            <div key={index}>
              <p>
                <b>
                  {comparison.kind} · {comparison.status}
                </b>
                : {comparison.statement}
              </p>
              <p>
                Machine assessment: {comparison.machine_status}. Evidence:{' '}
                {comparison.citations.join(', ')}.
              </p>
              {comparison.human_review && (
                <p>
                  Human review:{' '}
                  {comparison.human_review.stale
                    ? 'Changed — review again'
                    : comparison.human_review.decision?.replaceAll('_', ' ') ||
                      'Not reviewed'}
                  .
                </p>
              )}
              <EditorContext value={comparison.editor_context} />
            </div>
          ))}
        </article>
      ))}
      <details>
        <summary>
          Exact claim quotations (
          {
            sources.filter((source) => source.kind === 'investigation_quote')
              .length
          }
          )
        </summary>
        {sources
          .filter((source) => source.kind === 'investigation_quote')
          .map((source) => (
            <blockquote key={source.id}>
              <p>
                {source.id} · {source.relation} · {source.title} ·{' '}
                {source.locator}
              </p>
              <p className="research-preview-excerpt">{source.text}</p>
            </blockquote>
          ))}
      </details>
    </section>
  );
}
