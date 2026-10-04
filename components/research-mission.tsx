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
    'The unread or unanalysed material is listed below. Sources and completed work are saved.',
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
    'The latest attempt did not produce a new answer. Your sources and completed work are saved.',
  review_unavailable:
    'Your checked answer is saved. Some verification is pending and can be retried.',
};

export function MissionProgress({
  mission,
  status,
}: {
  mission?: ResearchMission | null;
  status?: ExplorationState['status'];
}) {
  if (!mission) return null;
  const active = status !== 'unavailable' &&
    ['mapping', 'deepening', 'synthesizing'].includes(mission.stage);
  return (
    <div>
      <output className="mission-progress">
        {mission.stop === 'answer_unavailable' ? 'Latest attempt stopped'
          : mission.stop === 'review_unavailable' ? 'Answer saved · verification pending'
          : stages[mission.stage]}
        {mission.round && mission.round > 1 ? ` · Round ${mission.round}` : ''}
      </output>
      {mission.documents
        ?.filter((doc) => !doc.complete)
        .map((doc, index) => (
          <p className="muted" key={index}>
            {doc.title || 'Document'} ·{' '}
            {doc.page_count
              ? `${doc.pages_read || 0} of ${doc.page_count} pages ${doc.read_complete ? 'read' : 'processed'}`
              : active ? 'Reading source material' : 'Source reading is incomplete'}
            {doc.read_complete
              ? !active || doc.review_failed
                ? ' · Analysis is pending'
                : doc.review_progress
                ? doc.review_progress.phase === 'synthesis'
                  ? ' · Bringing the document’s findings together'
                  : ' · Checking sections and citations across the document'
                : ' · Analysing sections and checking the whole document'
              : ''}
            {doc.error ? ` · ${doc.error}` : (!active || !doc.read_complete || doc.review_failed) && doc.unread_reason ? ` · ${doc.unread_reason}` : ''}
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
  const verification = mission.stop === 'review_unavailable' && mission.verification?.status === 'partial'
    ? mission.verification : null;
  const limitations = verification
    ? answer.limitations.filter((gap) => gap !== verification.basis)
    : answer.limitations;
  const knowledge = mission.knowledge;
  const sourceList = [
    ...state.sources,
    ...(knowledge?.document_origins.flatMap((o) => o.sources) || []),
  ];
  const sourceFor = (id: string) => sourceList.find((s) => s.id === id);
  const quote = (
    ref: ExplorationCitation & { role?: string },
    index: number,
  ) => {
    const source = sourceFor(ref.source_id);
    if (!source) return null;
    return (
      <details
        className="exploration-citation"
        key={`${ref.source_id}:${ref.locator}:${index}`}
      >
        <summary>
          {source.title} ·{' '}
          {ref.role === 'counterevidence'
            ? 'counterevidence'
            : ref.role === 'context'
              ? 'context'
              : 'supporting passage'}
        </summary>
        <blockquote>{ref.quote}</blockquote>
        <a href={source.url} target="_blank" rel="noreferrer">
          Open original source
        </a>
        <p className="muted">{ref.locator}</p>
      </details>
    );
  };
  const evidence = (refs: (ExplorationCitation & { role?: string })[]) => {
    const passages = refs.flatMap((ref) => {
      const source = sourceFor(ref.source_id);
      return source ? [{ ref, source }] : [];
    });
    if (!passages.length) return null;
    const sourceCount = new Set(passages.map(({ ref }) => ref.source_id)).size;
    return (
      <details className="mission-evidence">
        <summary>
          Sources and context{' '}
          <span className="muted">
            · {sourceCount} {sourceCount === 1 ? 'source' : 'sources'} ·{' '}
            {passages.length} {passages.length === 1 ? 'passage' : 'passages'}
          </span>
        </summary>
        <div className="mission-evidence-passages">
          {passages.map(({ ref, source }, index) => (
            <div
              className="exploration-citation"
              key={`${ref.source_id}:${ref.locator}:${index}`}
            >
              <p className="mission-evidence-source">
                {source.title} ·{' '}
                {ref.role === 'counterevidence'
                  ? 'counterevidence'
                  : ref.role === 'context'
                    ? 'context'
                    : 'supporting passage'}
              </p>
              <blockquote>{ref.quote}</blockquote>
              <a href={source.url} target="_blank" rel="noreferrer">
                Open original source
              </a>
              <p className="muted">{ref.locator}</p>
            </div>
          ))}
        </div>
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
    <article id="research-answer" className="research-mission" aria-label="Research answer">
      <span className="content-origin">
        AI · evidence-based assessment · open to human review
      </span>
      <h3>What the evidence says</h3>
      {mission.stop === 'answer_unavailable' && (
        <p className="muted"><strong>Last saved answer.</strong> This answer comes from an earlier round; the latest attempt has not replaced it.</p>
      )}
      <p className="exploration-question">{mission.question}</p>
      {verification && (
        <aside className="banner warning" aria-label="Verification pending">
          <strong>Some checks are still pending</strong>
          <p>{verification.basis}</p>
          <p>You can retry the remaining checks. Your sources and checked findings are saved.</p>
        </aside>
      )}
      {answer.status === 'not_found' && (
        <p>
          No answer was established in the material read. This does not
          establish that no answer exists.
        </p>
      )}
      {answer.status === 'partial' && !verification && (
        <p className="muted">
          This is a partial answer. Important gaps remain.
        </p>
      )}
      {points.map((point, i) => (
        <section key={i}>
          <p>{point.statement}</p>
          {evidence(point.evidence)}
        </section>
      ))}
      {!!conflicts.length && (
        <section aria-label="Contradictions">
          <h4>Where the evidence conflicts</h4>
          {conflicts.map((point, i) => (
            <div key={i}>
              <p>{point.statement}</p>
              {evidence(point.evidence)}
            </div>
          ))}
        </section>
      )}
      {!!limitations.length && (
        <section id="answer-gaps" aria-label="Unresolved gaps">
          <h4>What we still do not know</h4>
          <ul>
            {limitations.map((gap, i) => (
              <li key={i}>{gap}</li>
            ))}
          </ul>
        </section>
      )}
      <MissionProgress mission={mission} status={state.status} />
      {mission.stop && !verification && (
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
                    {doc.title || 'Original document'}
                  </a>
                ) : (
                  'Contributed document'
                )}
                <p>
                  {doc.page_count
                    ? `${doc.pages_read || 0} of ${doc.page_count} pages ${(doc.read_complete ?? doc.complete) ? 'read' : 'processed'}`
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
