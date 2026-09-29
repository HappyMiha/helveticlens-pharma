'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, date, uid } from '@/lib/api';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import type { Investigation, InvestigationSummary } from '@/lib/investigation';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { WebPolicyForm } from './web-research';
import { currentWebResearch, type WebResearch } from '@/lib/web-research';

import type {
  ExplorationState,
  SavedCheck,
  ExplorationCitation as Citation,
} from '@/lib/exploration';

type Episode = Investigation & { exploration: ExplorationState };
type Reply = {
  request_key: string;
  expected_revision: number;
  question: string;
  direction?: number;
  follow_up_id?: string;
  public_query_confirmed: true;
};

type ExplorationProps = {
  dossierId: string;
  initialId: string;
  canEdit: boolean;
  monitoringEnabled?: boolean;
  onChanged: () => Promise<void>;
  onOpen: (id: string) => void;
};
type Episodes = { items: InvestigationSummary[] };
/** Changing episodes remounts the editor; stale requests cannot change its successor. */
export function Exploration(props: ExplorationProps) {
  const root = `/products/${product.id}/dossiers/${props.dossierId}/investigations`;
  const list = useResource<Episodes>(root);
  if (list.error)
    return (
      <section aria-label="Developing your research">
        <p role="alert">
          {list.error} Saved research is hidden until access is checked again.
        </p>
        <Button variant="ghost" onClick={() => void list.refresh()}>
          Refresh research
        </Button>
      </section>
    );
  const id =
    list.data?.items.find((item) => item.exploratory)?.id || props.initialId;
  return <ExplorationEpisode key={id} {...props} id={id} list={list} />;
}
function ExplorationEpisode({
  dossierId,
  canEdit,
  monitoringEnabled = false,
  onChanged,
  onOpen,
  id,
  list,
}: ExplorationProps & {
  id: string;
  list: ReturnType<typeof useResource<Episodes>>;
}) {
  const root = `/products/${product.id}/dossiers/${dossierId}/investigations`;
  const resource = useResource<Episode>(id ? `${root}/${id}` : null);
  const page =
    !resource.error && !list.error && resource.data?.id === id
      ? resource.data
      : null;
  const state = page?.exploration;
  const brief = state?.briefing;
  const nextCheck = state?.next_check;
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{ id: string; body: Reply } | null>(
    null,
  );
  const sending = useRef(false);
  const lifecycle = useMemo(() => ({ generation: 0 }), []);
  const refreshList = list.refresh,
    refresh = resource.refresh;
  useEffect(() => {
    const reset = () => {
      lifecycle.generation++;
      sending.current = false;
      setBusy(false);
      setPending(null);
      setError('');
      setQuestion('');
    };
    const timer = setInterval(() => {
      void refreshList();
      void refresh();
    }, 10000);
    window.addEventListener('helvetic-session-changed', reset);
    return () => {
      lifecycle.generation++;
      clearInterval(timer);
      window.removeEventListener('helvetic-session-changed', reset);
    };
  }, [refreshList, refresh, lifecycle]);

  async function reply(text: string, direction?: number, followUpId?: string) {
    if (
      !page ||
      !state ||
      !canEdit ||
      sending.current ||
      text.trim().length < 5
    )
      return;
    const command = pending || {
      id: page.id,
      body: {
        request_key: uid(),
        expected_revision: state.revision,
        question: text.trim(),
        public_query_confirmed: true as const,
        ...(direction === undefined ? {} : { direction }),
        ...(followUpId === undefined ? {} : { follow_up_id: followUpId }),
      },
    };
    sending.current = true;
    setBusy(true);
    setError('');
    setPending(command);
    const current = lifecycle.generation;
    try {
      await api(`${root}/${command.id}/exploration/reply`, command.body);
      if (lifecycle.generation !== current) return;
      setPending(null);
      setQuestion('');
      await refreshList();
      if (lifecycle.generation === current) await onChanged();
    } catch (failure) {
      if (lifecycle.generation === current) {
        setError(
          failure instanceof Error
            ? failure.message
            : 'Could not continue. Retry the same direction safely.',
        );
        if (
          failure instanceof ApiError &&
          failure.status !== null &&
          [401, 403, 404, 409, 422].includes(failure.status)
        ) {
          setPending(null);
          await refreshList();
          await refresh();
        }
      }
    } finally {
      if (lifecycle.generation === current) {
        sending.current = false;
        setBusy(false);
      }
    }
  }
  async function control(action: 'pause' | 'resume' | 'cancel') {
    if (!page || !canEdit || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    const current = lifecycle.generation;
    try {
      await api(`${root}/${page.id}/control`, {
        expected_revision: page.revision,
        action,
      });
    } catch (failure) {
      if (lifecycle.generation === current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Could not update research.',
        );
    } finally {
      if (lifecycle.generation === current) {
        await refresh();
        if (lifecycle.generation === current) {
          sending.current = false;
          setBusy(false);
        }
      }
    }
  }
  function quote(item: Citation) {
    const source = state?.sources.find(
      (source) => source.id === item.source_id,
    );
    if (!source) return null;
    return (
      <details className="exploration-citation">
        <summary>Read supporting passage</summary>
        <blockquote>{item.quote}</blockquote>
        <a href={source.url} target="_blank" rel="noreferrer">
          {source.title}
        </a>
        <p className="muted">
          Captured {date(source.captured_at)} · {item.locator}
        </p>
      </details>
    );
  }
  const directionChoices = brief?.directions.map((direction, index) => (
    <article key={direction.question}>
      <Button
        variant="outline"
        disabled={busy || !!pending}
        onClick={() => void reply(direction.question, index)}
      >
        {direction.question}
      </Button>
      <p>{direction.why}</p>
      {quote(direction)}
    </article>
  ));
  const active = page && ['queued', 'running'].includes(page.status);
  return (
    <section className="exploration" aria-label="Developing your research">
      <p className="chapter-kicker">
        {active ? 'Research in progress' : 'Research checkpoint'}
      </p>
      <h2>
        {brief
          ? 'What the first evidence suggests'
          : active
            ? 'Getting to know your question'
            : 'Your research checkpoint'}
      </h2>
      {(list.error || resource.error) && (
        <p role="alert">
          {list.error || resource.error} Saved research is hidden until access
          is checked again.
          <Button
            variant="ghost"
            onClick={() => {
              void refreshList();
              void refresh();
            }}
          >
            Refresh research
          </Button>
        </p>
      )}
      {!page && !list.error && !resource.error && (
        <output>Loading saved research…</output>
      )}
      {page && state && (
        <>
          <p className="exploration-question">
            <span className="content-origin">Your question</span>
            {page.question}
          </p>
          {active && (
            <p>
              Checking possible meanings and reading sources. Findings appear
              here as they are saved. This episode ends at a short briefing.{' '}
              {monitoringEnabled
                ? 'Your previously enabled monitoring continues.'
                : 'Monitoring stays off until you enable it.'}
            </p>
          )}
          {canEdit && !pending && (
            <div className="research-start-actions">
              {active && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void control('pause')}
                >
                  {state.orientation?.status === 'ready'
                    ? 'Pause to change direction'
                    : 'Pause research'}
                </Button>
              )}
              {page.status === 'paused' && state.status === 'exploring' && (
                <Button disabled={busy} onClick={() => void control('resume')}>
                  Resume research
                </Button>
              )}
              {(active || page.status === 'paused') && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void control('cancel')}
                >
                  Stop this episode
                </Button>
              )}
            </div>
          )}
          {!brief && !active && (
            <output>
              {state.status === 'evidence_changed'
                ? 'Supporting evidence changed. The earlier interpretation is hidden; review the sources or start a corrected question.'
                : state.status === 'exploring'
                  ? page.stop_reason ||
                    'Research is paused. Saved sources remain below.'
                  : 'There is not enough validated evidence for a briefing yet. Saved passages remain below; you can correct the question and try another bounded episode.'}
            </output>
          )}
          <ExplorationBrief state={state} />
          {!brief &&
            state.orientation?.status !== 'ready' &&
            !!state.sources.length && (
              <section>
                <h3>Read so far</h3>
                {state.sources.slice(0, 3).map((source) => (
                  <article key={source.id}>
                    <span className="content-origin">
                      Source passage · not an AI conclusion
                    </span>
                    <blockquote>
                      {source.excerpts[0]?.text.slice(0, 600)}
                    </blockquote>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                  </article>
                ))}
              </section>
            )}
          {!active &&
            (state.status !== 'exploring' ||
              page.status === 'paused' ||
              page.status === 'cancelled') &&
            !state.continued_by &&
            canEdit && (
              <section className="exploration-choice">
                <h3>
                  {nextCheck
                    ? 'A useful next check'
                    : brief?.clarification ||
                      'Where would you like to go next?'}
                </h3>
                <p className="muted">
                  Your choice starts one more bounded episode using public
                  research providers. Earlier evidence is kept. No reply is
                  needed to keep this briefing.
                </p>
                {nextCheck && (
                  <article>
                    <p>
                      <strong>{nextCheck.question}</strong>
                    </p>
                    <p>{nextCheck.why}</p>
                    <SavedCheckPassage check={nextCheck} />
                    <Button
                      disabled={busy || !!pending}
                      onClick={() =>
                        void reply(
                          nextCheck.question,
                          undefined,
                          nextCheck.question_id,
                        )
                      }
                    >
                      Continue this check
                    </Button>
                  </article>
                )}
                {nextCheck && directionChoices?.length ? (
                  <details>
                    <summary>Other directions</summary>
                    {directionChoices}
                  </details>
                ) : (
                  directionChoices
                )}
                {pending && (
                  <Button
                    disabled={busy}
                    onClick={() => void reply(pending.body.question)}
                  >
                    {busy
                      ? 'Starting next episode…'
                      : 'Retry this direction safely'}
                  </Button>
                )}
                <details open={(!brief && !nextCheck) || undefined}>
                  <summary>Change direction in your own words</summary>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void reply(question);
                    }}
                  >
                    <label htmlFor="exploration-direction">
                      The public question to investigate next
                    </label>
                    <Textarea
                      id="exploration-direction"
                      rows={3}
                      minLength={5}
                      maxLength={300}
                      required
                      value={question}
                      disabled={busy || !!pending}
                      onChange={(event) => setQuestion(event.target.value)}
                    />
                    <Button
                      disabled={busy || !!pending || question.trim().length < 5}
                    >
                      Explore this direction
                    </Button>
                  </form>
                </details>
                {brief && !pending && !nextCheck && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void reply(page.question)}
                  >
                    Continue the broad exploration
                  </Button>
                )}
              </section>
            )}
          {error && <p role="alert">{error}</p>}
          <details className="dossier-secondary">
            <summary>Research journal & earlier episodes</summary>
            <p>
              Planned directions and recorded search/read steps. Candidates are
              not verified evidence.
            </p>
            <ul>
              {page.branches
                .filter(
                  (branch) =>
                    !['plan', 'brief', 'orient', 'compare'].includes(
                      branch.phase,
                    ),
                )
                .map((branch) => (
                  <li key={branch.id}>
                    <strong>{branch.query}</strong> · {branch.status}
                    <p>{branch.reason}</p>
                    <p className="muted">
                      {
                        branch.steps.filter(
                          (step) =>
                            step.phase === 'search' &&
                            step.status === 'completed',
                        ).length
                      }{' '}
                      completed search steps ·{' '}
                      {
                        branch.steps.filter(
                          (step) =>
                            step.phase === 'read' &&
                            step.status === 'completed',
                        ).length
                      }{' '}
                      completed reads
                    </p>
                    {branch.error && <p>{branch.error}</p>}
                  </li>
                ))}
            </ul>
            <Button variant="outline" onClick={() => onOpen(page.id)}>
              Read all findings and sources
            </Button>
            {list.data?.items
              .filter((item) => item.exploratory && item.id !== page.id)
              .map((item) => (
                <p key={item.id}>
                  <Button variant="ghost" onClick={() => onOpen(item.id)}>
                    {item.question}
                  </Button>
                </p>
              ))}
          </details>
          {brief && canEdit && (
            <ExplorationMonitor
              dossierId={dossierId}
              question={page.question}
              onChanged={onChanged}
            />
          )}
        </>
      )}
    </section>
  );
}

function ExplorationMonitor({
  dossierId,
  question,
  onChanged,
}: {
  dossierId: string;
  question: string;
  onChanged: () => Promise<void>;
}) {
  const base = `/products/${product.id}/dossiers/${dossierId}/web-research`;
  const resource = useResource<WebResearch>(base);
  const value = currentWebResearch(resource.data, resource.error, dossierId);
  return (
    <section className="dossier-secondary">
      <h3>Keep watching this topic</h3>
      <p>
        Choose the understood public question and daily or weekly checks.
        Monitoring starts only when you explicitly save it.
      </p>
      {resource.error && (
        <p role="alert">
          {resource.error}
          <Button variant="ghost" onClick={() => void resource.refresh()}>
            Refresh monitoring
          </Button>
        </p>
      )}
      {value?.can_manage && (
        <WebPolicyForm
          key={value.policy.revision}
          base={base}
          policy={value.policy}
          initialQuestion={question}
          onSaved={() => {
            void resource.refresh();
            void onChanged();
          }}
        />
      )}
    </section>
  );
}

export function ExplorationBrief({ state }: { state: ExplorationState }) {
  const brief = state.briefing;
  function quote(item: Citation) {
    const source = state?.sources.find(
      (source) => source.id === item.source_id,
    );
    if (!source) return null;
    return (
      <details className="exploration-citation">
        <summary>Read supporting passage</summary>
        <blockquote>{item.quote}</blockquote>
        <a href={source.url} target="_blank" rel="noreferrer">
          {source.title}
        </a>
        <p className="muted">
          Captured {date(source.captured_at)} · {item.locator}
        </p>
      </details>
    );
  }
  if (!brief)
    return (
      <>
        <ContinuedCheck state={state} />
        <EarlyOrientation state={state} />
        <InterpretationChanges state={state} />
      </>
    );
  return (
    <>
      <ContinuedCheck state={state} />
      <section className="exploration-understanding">
        <span className="content-origin">AI · tentative understanding</span>
        <p>{brief.understanding}</p>
      </section>
      <div className="exploration-findings">
        {brief.findings.map((finding, index) => (
          <article key={index}>
            <span className="content-origin">
              {finding.basis === 'analogy'
                ? 'AI · analogy, not a direct match'
                : finding.basis === 'contradiction'
                  ? 'AI · conflicting evidence'
                  : 'AI · source-backed finding'}
            </span>
            <p>{finding.statement}</p>
            {quote(finding)}
          </article>
        ))}
      </div>
      <InterpretationChanges state={state} />
      <section>
        <h3>Still uncertain</h3>
        <ul>
          {brief.uncertainties.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      {state.orientation && (
        <details className="dossier-secondary">
          <summary>Earlier working interpretation</summary>
          <p className="muted">
            This is the earlier checkpoint, before the completed briefing above.
            It may have been revised by later evidence.
          </p>
          <EarlyOrientation state={state} historical />
        </details>
      )}
    </>
  );
}

function EarlyOrientation({
  state,
  historical = false,
}: {
  state: ExplorationState;
  historical?: boolean;
}) {
  const orientation = state.orientation;
  if (!orientation || orientation.status === 'scheduled') return null;
  const brief = orientation.briefing;
  if (orientation.status !== 'ready' || !brief)
    return (
      <p className="muted">
        {orientation.status === 'evidence_changed'
          ? 'An earlier working interpretation is hidden because its supporting sources changed.'
          : 'No validated early interpretation was saved. Read the captured passages below; the research journal records any remaining work.'}
      </p>
    );
  return (
    <section
      className="exploration-orientation"
      aria-label="Early source-backed understanding"
    >
      <span className="content-origin">AI · early working interpretation</span>
      <h3>
        {historical
          ? 'How the question first appeared'
          : 'A first reading of your question'}
      </h3>
      <p>
        These possible meanings come from the passages read so far. They are
        tentative; your original question stays unchanged.
      </p>
      {orientation.saved_at && (
        <p className="muted">Saved {date(orientation.saved_at)}</p>
      )}
      <div className="exploration-findings">
        {brief.interpretations.map((item, index) => {
          const source = state.sources.find(
            (source) => source.id === item.source_id,
          );
          return (
            <article key={index}>
              <span className="content-origin">
                {item.signal === 'questioned'
                  ? 'Evidence questions this interpretation'
                  : 'Possible meaning · not confirmed'}
              </span>
              <p>
                <strong>{item.meaning}</strong>
              </p>
              <p>{item.why}</p>
              {source && (
                <details className="exploration-citation">
                  <summary>Read the passage behind this interpretation</summary>
                  <blockquote>{item.quote}</blockquote>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                  </a>
                  <p className="muted">
                    Captured {date(source.captured_at)} · {item.locator}
                  </p>
                </details>
              )}
            </article>
          );
        })}
      </div>
      <p>
        <strong>Still to establish</strong>
      </p>
      <ul>
        {brief.uncertainties.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function InterpretationChanges({ state }: { state: ExplorationState }) {
  if (state.changes_unavailable)
    return (
      <p className="muted">
        The revised research direction is hidden because its supporting evidence
        changed.
      </p>
    );
  if (!state.changes?.length) return null;
  return (
    <section
      aria-label="How new evidence changed the research"
      className="exploration-findings"
    >
      <h3>Why we are looking further</h3>
      {state.changes.map((change) => {
        const source = state.sources.find(
          (item) => item.id === change.source_id,
        );
        if (!source) return null;
        const progress = change.waiting_reason
          ? 'Not completed within this episode’s limits.'
          : change.status === 'evidence_found'
            ? 'Supporting material saved; the interpretation remains tentative.'
            : change.status === 'unresolved'
              ? 'This check finished without resolving the question.'
              : change.searches_completed
                ? 'Search completed; this check is still in progress.'
                : 'Queued for this episode; search has not completed yet.';
        return (
          <article key={change.question_id}>
            <span className="content-origin">
              AI ·{' '}
              {change.signal === 'questioned'
                ? 'earlier interpretation questioned'
                : 'interpretation refined'}
            </span>
            <p>
              <strong>{change.meaning}</strong>
            </p>
            <p>{change.why}</p>
            <p>
              <strong>Following up:</strong> {change.question}
            </p>
            <p className="muted">
              {progress}{' '}
              {change.reads_completed > 0 &&
                `${change.reads_completed} completed reads.`}
            </p>
            <details className="exploration-citation">
              <summary>Earlier interpretation & new supporting passage</summary>
              <p>
                <strong>Earlier:</strong> {change.earlier_meaning}
              </p>
              <blockquote>{change.quote}</blockquote>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title}
              </a>
              <p className="muted">
                Captured {date(source.captured_at)} · {change.locator}
              </p>
            </details>
          </article>
        );
      })}
    </section>
  );
}

function SavedCheckPassage({ check }: { check: SavedCheck }) {
  return (
    <details className="exploration-citation">
      <summary>Why this check arose · earlier source passage</summary>
      <blockquote>{check.quote}</blockquote>
      <a href={check.source.url} target="_blank" rel="noreferrer">
        {check.source.title}
      </a>
      <p className="muted">
        Captured {date(check.source.captured_at)} · {check.locator}
      </p>
    </details>
  );
}

function ContinuedCheck({ state }: { state: ExplorationState }) {
  const check = state.continuation;
  if (!check) return null;
  if (check.status !== 'ready')
    return (
      <p className="muted">
        The earlier evidence behind this check changed. Its context is hidden;
        review the earlier episode or correct your question.
      </p>
    );
  return (
    <section
      className="dossier-secondary"
      aria-label="Continuing a saved check"
    >
      <span className="content-origin">
        Your selected check · earlier research context
      </span>
      <p>{check.purpose}</p>
      <SavedCheckPassage check={check} />
    </section>
  );
}
