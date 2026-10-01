import type { ExplorationCitation, ExplorationState } from '@/lib/exploration';
import type { ResearchMission } from '@/lib/research-mission';

const stages = {
  mapping: 'Understanding the question and finding evidence',
  deepening: 'Following the gaps and checking contrary evidence',
  synthesizing: 'Bringing the evidence together',
  waiting_for_direction: 'One choice would help guide the next research',
  finished: 'Research saved',
  incomplete: 'Some documents still need reading or analysis',
  evidence_changed: 'The supporting evidence has changed',
};
const stops: Record<string, string> = {
  documents_incomplete:
    'This research is incomplete. The unread or unanalysed material is listed below; saved progress can be resumed.',
  available_checks_complete:
    'The useful checks available in this research have been completed. The remaining gaps are named below.',
  needs_direction:
    'The evidence points to different possible directions. Choose below when you are ready; the research is saved.',
  no_new_evidence:
    'Another round did not add new evidence. Repeating the same search would not improve the answer.',
  no_useful_next_check:
    'No further distinct, evidence-backed check could be started.',
  capacity_reached:
    'The available research time or analysis capacity was reached. The evidence and remaining work are saved.',
  rounds_complete:
    'This research has reached its saved checkpoint. Further work remains possible; coverage is not exhaustive.',
  answer_unavailable:
    'A validated answer could not be prepared. The captured material remains available.',
};

export function MissionProgress({
  mission,
}: {
  mission?: ResearchMission | null;
}) {
  if (!mission) return null;
  return (
    <div>
      <output className="mission-progress">
        {stages[mission.stage]}
        {mission.round && mission.round > 1 ? ` · Round ${mission.round}` : ''}
      </output>
      {mission.documents
        ?.filter((doc) => !doc.complete)
        .map((doc, index) => (
          <p className="muted" key={index}>
            {doc.title || 'Document'} ·{' '}
            {doc.page_count
              ? `${doc.pages_read || 0} of ${doc.page_count} pages read`
              : 'Reading source material'}
            {doc.read_complete
              ? ' · Analysing sections and checking the whole document'
              : ''}
            {doc.error ? ` · ${doc.error}` : ''}
          </p>
        ))}
    </div>
  );
}

export function MissionReading({ state }: { state: ExplorationState }) {
  const mission = state.mission;
  if (
    !mission?.answer ||
    mission.stage === 'evidence_changed' ||
    state.status === 'evidence_changed'
  )
    return null;
  const answer = mission.answer;
  const knowledge = mission.knowledge;
  const sourceList = [
    ...state.sources,
    ...(knowledge?.document_origins.flatMap((o) => o.sources) || []),
  ];
  const sourceFor = (id: string) => sourceList.find((s) => s.id === id);
  const quote = (ref: ExplorationCitation, index: number) => {
    const source = sourceFor(ref.source_id);
    if (!source) return null;
    return (
      <details
        className="exploration-citation"
        key={`${ref.source_id}:${ref.locator}:${index}`}
      >
        <summary>{source.title} · supporting passage</summary>
        <blockquote>{ref.quote}</blockquote>
        <a href={source.url} target="_blank" rel="noreferrer">
          Open original source
        </a>
        <p className="muted">{ref.locator}</p>
      </details>
    );
  };
  const points = answer.points.filter(
    (p) => !p.evidence.some((e) => e.role === 'counterevidence'),
  );
  const conflicts = answer.points.filter((p) =>
    p.evidence.some((e) => e.role === 'counterevidence'),
  );
  return (
    <article className="research-mission" aria-label="Research answer">
      <span className="content-origin">
        AI · evidence-based assessment · open to human review
      </span>
      <h3>What the evidence says</h3>
      <p className="exploration-question">{mission.question}</p>
      {answer.status === 'not_found' && (
        <p>
          No answer was established in the material read. This does not
          establish that no answer exists.
        </p>
      )}
      {answer.status === 'partial' && (
        <p className="muted">
          This is a partial answer. Important gaps remain.
        </p>
      )}
      {points.map((point, i) => (
        <section key={i}>
          <p>{point.statement}</p>
          {point.evidence.map(quote)}
        </section>
      ))}
      {!!conflicts.length && (
        <section aria-label="Contradictions">
          <h4>Where the evidence conflicts</h4>
          {conflicts.map((point, i) => (
            <div key={i}>
              <p>{point.statement}</p>
              {point.evidence.map((ref, j) => (
                <div key={j}>
                  <span className="content-origin">
                    {ref.role === 'counterevidence'
                      ? 'Counterevidence'
                      : ref.role === 'support'
                        ? 'Supporting evidence'
                        : 'Context'}
                  </span>
                  {quote(ref, j)}
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
      <section aria-label="Unresolved gaps">
        <h4>What we still do not know</h4>
        <ul>
          {answer.limitations.map((gap, i) => (
            <li key={i}>{gap}</li>
          ))}
        </ul>
      </section>
      <MissionProgress mission={mission} />
      {mission.stop && (
        <p className="muted">
          {stops[mission.stop] || 'The current research is saved.'}
        </p>
      )}
      <details className="dossier-secondary">
        <summary>How this answer developed</summary>
        <ol>
          {mission.checkpoints.map((check) => (
            <li key={check.round}>
              <strong>Round {check.round}</strong>
              <p>{check.reason}</p>
              {!!check.gaps.length && (
                <ul>
                  {check.gaps.map((gap, i) => (
                    <li key={i}>
                      {gap.question}
                      <p className="muted">{gap.purpose}</p>
                      {quote(gap, i)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </details>
      {!!mission.documents?.length && (
        <details className="dossier-secondary">
          <summary>Document reading and analysis</summary>
          <ul>
            {mission.documents.map((doc, i) => (
              <li key={i}>
                {doc.url ? (
                  <a href={doc.url} target="_blank" rel="noreferrer">
                    Original document
                  </a>
                ) : (
                  'Contributed document'
                )}
                <p>
                  {doc.page_count
                    ? `${doc.pages_read || 0} of ${doc.page_count} pages read`
                    : `${doc.portions} saved portions`}
                  {doc.page_count
                    ? ` · ${doc.page_count} pages in the original`
                    : ''}
                  .{' '}
                  {doc.complete
                    ? 'Full text read, all sections analysed and whole-document review saved. AI interpretation remains open to review.'
                    : doc.error ||
                      doc.unread_reason ||
                      'Document reading or analysis remains incomplete.'}
                </p>
                {doc.warnings.map((warning, j) => (
                  <p className="muted" key={j}>
                    {warning}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </details>
      )}
      {!!knowledge?.professional_context.facts.length && (
        <details className="dossier-secondary">
          <summary>Professional context from the sources</summary>
          <p className="muted">{knowledge.professional_context.scope}</p>
          <dl>
            {knowledge.professional_context.facts.map((fact, i) => (
              <div key={i}>
                <dt>{fact.dimension.replaceAll('_', ' ')}</dt>
                <dd>
                  {fact.value}
                  {quote(fact, i)}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {knowledge && (
        <details className="dossier-secondary">
          <summary>What this dossier already knows</summary>
          <p className="muted">
            {knowledge.scope.note}
            {knowledge.scope.truncated
              ? ' This is a bounded view of the most recent records.'
              : ''}
          </p>
          {!!knowledge.identities.length && (
            <>
              <h4>Identities and names</h4>
              {knowledge.identities.slice(0, 12).map((group) => (
                <details key={group.id}>
                  <summary>{group.names.join(' / ')}</summary>
                  <p className="muted">
                    {group.basis === 'reviewed_pairs'
                      ? 'Current human identity decisions.'
                      : 'Same explicitly cited identifier; original mentions remain separate.'}
                  </p>
                  {group.mentions.map((m) => (
                    <div key={m.id}>
                      <p>
                        {m.identifier.issuer} · {m.identifier.value} ·{' '}
                        {m.identifier.jurisdiction}
                      </p>
                      <blockquote>{m.quote}</blockquote>
                      <a href={m.source.url} target="_blank" rel="noreferrer">
                        {m.source.title}
                      </a>
                    </div>
                  ))}
                </details>
              ))}
            </>
          )}
          <h4>Findings and their history</h4>
          {knowledge.claims.slice(0, 20).map((claim) => (
            <details key={claim.id}>
              <summary>{claim.statement}</summary>
              <p className="content-origin">
                {claim.reading_state.replaceAll('_', ' ')} ·{' '}
                {claim.human_status.toLowerCase().replaceAll('_', ' ')}
              </p>
              {claim.evidence.map(quote)}
              {claim.later_evidence.map((later, i) => (
                <p key={i}>
                  {later.explanation}{' '}
                  {!later.reviewed &&
                    'This relationship still needs human review.'}
                </p>
              ))}
            </details>
          ))}
          <p className="muted">
            Repeated document copies do not count as independent confirmation.
            Independence between different sources is unverified.
          </p>
        </details>
      )}
    </article>
  );
}
