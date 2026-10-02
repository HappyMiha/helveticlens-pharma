'use client';
import { useEffect } from 'react';
import { revealResearchTarget } from '@/lib/research-target';
import type { Investigation, EvidenceLink } from '@/lib/investigation';
import { readable } from '@/lib/investigation';
import { SourceCard } from './source-card';
import { DossierSection } from './research-blocks';
import { date } from '@/lib/api';

function Evidence({ value }: { value: EvidenceLink }) {
  return (
    <div className="investigation-evidence" data-content-kind="source">
      <p className="content-origin">Original source excerpt</p>
      <blockquote>{value.quote}</blockquote>
      <a href={`#source-${value.source_id}`}>Source · {value.locator}</a>
    </div>
  );
}
export function InvestigationFindings({ value }: { value: Investigation }) {
  useEffect(() => {
    const reveal = () => {
      const hash = window.location?.hash;
      if (!hash?.startsWith('#claim-')) return;
      const target = document.getElementById(hash.slice(1));
      revealResearchTarget(target);
      target?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    };
    reveal();
    window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, [value.id]);
  const names = new Map(
    value.entities.map((entity) => [entity.id, entity.name]),
  );
  return (
    <div className="investigation-findings">
      <DossierSection
        id="key-findings"
        number="01"
        title="AI findings & supporting evidence"
      >
        <div className="investigation-section-title">
          <p className="content-origin">
            AI interpretation · review with the sources
          </p>
          <span>{value.claims.length} claims</span>
        </div>
        <p className="investigation-muted">{value.evidence_basis}</p>
        {!value.claims.length && (
          <div className="investigation-empty">
            {value.exploration?.mission?.answer?.points.length &&
            value.exploration.status !== 'evidence_changed' &&
            value.exploration.mission.stage !== 'evidence_changed'
              ? 'No separate source-level findings were saved. The research answer and its citations are shown above.'
              : 'No validated findings yet. Captured sources and completed steps stay here even when a branch cannot finish.'}
          </div>
        )}
        {!!value.claims.length && <details className="dossier-secondary">
          <summary>Inspect {value.claims.length} source-level findings and their evidence</summary>
        {value.claims.map((claim) => (
          <article
            className="investigation-claim"
            data-content-kind="ai"
            id={`claim-${claim.id}`}
            key={claim.id}
          >
            <span className="investigation-status" data-status={claim.status}>
              {readable(claim.status)}
            </span>
            <h4>{claim.statement}</h4>
            {claim.later_evidence && (
              <aside className="claim-later-evidence">
                <strong>
                  Later evidence
                  {claim.later_evidence.status
                    ? `: ${readable(claim.later_evidence.status)}`
                    : ''}
                </strong>
                <p>
                  {claim.later_evidence.changes
                    .map((item) => `${readable(item.kind)} (${item.count})`)
                    .join(' · ')}
                  . The recorded finding above remains unchanged.
                </p>
                <a href="#evidence-changes">
                  Inspect source comparisons & editor history
                </a>
              </aside>
            )}
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
        </details>}
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
                {!!entity.evidence.mentions?.length && <details><summary>Names & identity evidence</summary>
                  {entity.evidence.mentions.map((mention, index) => <div key={`${mention.source_id}:${index}`}>
                    <strong>{mention.name}</strong><Evidence value={mention} />
                  </div>)}
                </details>}
                {entity.evidence.identifier && (
                  <p className="investigation-muted">
                    Source identifier: {entity.evidence.identifier.issuer}{' '}
                    {entity.evidence.identifier.value} ·{' '}
                    {entity.evidence.mentions?.length || 1} cited mentions.
                    Identity is not independently verified.
                  </p>
                )}
              </li>
            ))}
          </ul>
          {value.relationships.map((relation) => (
            <div key={relation.id} className="investigation-relationship">
              <p>
                <strong>{names.get(relation.subject_id)}</strong> ·{' '}
                {readable(relation.predicate)} ·{' '}
                <strong>{names.get(relation.object_id)}</strong>
              </p>
              {relation.evidence.claim_id && (
                <a href={`#claim-${relation.evidence.claim_id}`}>
                  Inspect the linked claim
                </a>
              )}
              <details>
                <summary>Evidence for this connection</summary>
                <Evidence value={relation.evidence} />
              </details>
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
