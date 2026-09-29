import type { ResearchClaim, ResearchSource } from '@/lib/contracts';

export function ResearchClaims({ claims, sources }: { claims: ResearchClaim[]; sources: ResearchSource[] }) {
  return <section className="research-preview-context">
    <h3>Claims supplied to AI</h3>
    <p>Human acceptance records an editor’s review, not independent verification. Machine assessment and human review remain separate. Conflicting evidence stays in the input.</p>
    {!claims.length && <p>No complete claim groups fit this selection. Saved excerpts below can still contribute.</p>}
    {claims.map(claim => <article key={claim.id}>
      <h4>{claim.statement}</h4>
      <p>Machine assessment: {claim.machine_status}. Human review: {claim.human_review.stale ? 'Changed — review again' : claim.human_review.decision?.replaceAll('_', ' ') || 'Not reviewed'}.</p>
      <p>Evidence: {claim.citations.join(', ')}.</p>
      {claim.comparisons.map((comparison, index) => <div key={index}>
        <p><b>{comparison.kind} · {comparison.status}</b>: {comparison.statement}</p>
        <p>Machine assessment: {comparison.machine_status}. Evidence: {comparison.citations.join(', ')}.</p>
      </div>)}
    </article>)}
    <details><summary>Exact claim quotations ({sources.filter(source => source.kind === 'investigation_quote').length})</summary>
      {sources.filter(source => source.kind === 'investigation_quote').map(source => <blockquote key={source.id}>
        <p>{source.id} · {source.relation} · {source.title} · {source.locator}</p>
        <p className="research-preview-excerpt">{source.text}</p>
      </blockquote>)}
    </details>
  </section>;
}
