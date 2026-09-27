import type { Investigation, EvidenceLink } from '@/lib/investigation';
import { readable, sourceHref } from '@/lib/investigation';
import { date } from '@/lib/api';

function Evidence({ value }: { value: EvidenceLink }) {
  return (
    <div className="investigation-evidence">
      <blockquote>{value.quote}</blockquote>
      <a href={`#source-${value.source_id}`}>Source · {value.locator}</a>
    </div>
  );
}
export function InvestigationFindings({ value }: { value: Investigation }) {
  const names = new Map(
    value.entities.map((entity) => [entity.id, entity.name]),
  );
  return (
    <div className="investigation-findings">
      <section aria-label="Research findings">
        <div className="investigation-section-title">
          <h3>What the evidence says</h3>
          <span>{value.claims.length} claims</span>
        </div>
        <p className="investigation-muted">{value.evidence_basis}</p>
        {!value.claims.length && (
          <div className="investigation-empty">
            No validated findings yet. Captured sources and completed steps stay
            here even when a branch cannot finish.
          </div>
        )}
        {value.claims.map((claim) => (
          <article
            className="investigation-claim"
            id={`claim-${claim.id}`}
            key={claim.id}
          >
            <span className="investigation-status" data-status={claim.status}>
              {readable(claim.status)}
            </span>
            <h4>{claim.statement}</h4>
            {value.evidence
              .filter((e) => e.claim_id === claim.id)
              .map((e) => (
                <div key={e.id}>
                  <strong className="investigation-relation">
                    {readable(e.relation)}
                  </strong>
                  <Evidence value={e} />
                </div>
              ))}
            <details>
              <summary>
                Claim history · {claim.revision}{' '}
                {claim.revision === 1 ? 'revision' : 'revisions'}
              </summary>
              <ol>
                {claim.history.map((h) => (
                  <li key={h.revision}>
                    {readable(h.from)} → {readable(h.to)} · {date(h.at)}
                    <p>{h.basis}</p>
                  </li>
                ))}
              </ol>
            </details>
          </article>
        ))}
      </section>
      {!!value.entities.length && (
        <section
          className="investigation-connections"
          aria-label="Research connections"
        >
          <h3>Entities & connections</h3>
          <p className="investigation-muted">
            Source mentions are machine extracted. Similar names do not
            establish that two entities are the same.
          </p>
          <ul>
            {value.entities.map((entity) => (
              <li key={entity.id}>
                <strong>{entity.name}</strong> <span>{entity.kind}</span>{' '}
                <a href={`#source-${entity.evidence.source_id}`}>Evidence</a>
              </li>
            ))}
          </ul>
          {value.relationships.map((relation) => (
            <div key={relation.id} className="investigation-relationship">
              <p>
                <strong>{names.get(relation.subject_id)}</strong> ·{' '}
                {relation.predicate} ·{' '}
                <strong>{names.get(relation.object_id)}</strong>
              </p>
              <Evidence value={relation.evidence} />
            </div>
          ))}
        </section>
      )}
      <section aria-label="Captured sources">
        <div className="investigation-section-title">
          <h3>Source library</h3>
          <span>{value.sources.length} captures</span>
        </div>
        {value.sources.map((source) => (
          <article
            id={`source-${source.id}`}
            className="investigation-source"
            key={source.id}
          >
            <div className="eyebrow">{readable(source.kind)}</div>
            <h4>{source.title}</h4>
            {sourceHref(source.url) && (
              <a
                href={sourceHref(source.url)!}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
              >
                Open original source ↗
              </a>
            )}
            <p className="investigation-muted">
              Captured {date(source.created_at)}
            </p>
            <details>
              <summary>Preserved excerpts & provenance</summary>
              {source.snapshot.excerpts.map((excerpt) => (
                <div key={excerpt.passage}>
                  <small>{excerpt.passage}</small>
                  <blockquote>{excerpt.text}</blockquote>
                </div>
              ))}
              <p>{source.snapshot.scope}</p>
              <code>SHA-256 {source.sha256}</code>
            </details>
          </article>
        ))}
      </section>
    </div>
  );
}
