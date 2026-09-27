import type { Investigation, EvidenceLink } from '@/lib/investigation';
import { readable } from '@/lib/investigation';
import { SourceCard } from './source-card';
import { DossierSection } from './research-blocks';
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
      <DossierSection id="key-findings" number="01" title="Claims & evidence">
        <div className="investigation-section-title">
          <p className="eyebrow">What the evidence says</p>
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
                <div key={e.id} data-evidence-relation={e.relation}>
                  <strong className="investigation-relation">
                    {readable(e.relation)}
                  </strong>
                  <Evidence value={e} />
                </div>
              ))}
            <p className="claim-method">
              <a href="#research-method">How was this produced?</a> ·
              Machine-linked source evidence
            </p>
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
      </DossierSection>
      {!!value.entities.length && (
        <DossierSection
          id="research-connections"
          number="02"
          title="Entities & connections"
        >
          <p className="investigation-muted">
            Source mentions are machine extracted. Similar names do not
            establish that two entities are the same.
          </p>
          <ul>
            {value.entities.map((entity) => (
              <li key={entity.id} id={`entity-${entity.id}`}>
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
        </DossierSection>
      )}
      <DossierSection id="research-sources" number="03" title="Sources">
        <p className="investigation-muted">
          {value.sources.length} captured sources. Open a source to inspect
          exactly what was retained and where it is used.
        </p>
        {value.sources.map((source) => (
          <SourceCard key={source.id} source={source} value={value} />
        ))}
      </DossierSection>
    </div>
  );
}
