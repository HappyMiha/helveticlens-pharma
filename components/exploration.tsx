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
  QuestionAssessment,
  SavedCheck,
  CaptureProgress,
  ResearchPurpose,
  ObservedQueries,
  ExplorationCitation as Citation,
} from '@/lib/exploration';

type Episode = Investigation & { exploration: ExplorationState };
type Reply = {
  request_key: string;
  expected_revision: number;
  question: string;
  direction?: number;
  orientation_revision?: number;
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
  const answerLink = nextCheck?.answer_link;
  const nextUncertainty =
    state?.status !== 'evidence_changed' &&
    brief?.assessment?.contract === 'selected-direction-assessment/v1' &&
    brief.assessment.status !== 'possible_answer' &&
    answerLink?.contract === 'selected-direction-next-check/v1' &&
    answerLink.question === brief.assessment.question &&
    Number.isSafeInteger(answerLink.limitation_index) &&
    answerLink.limitation_index >= 0 &&
    answerLink.limitation ===
      brief.assessment.limitations[answerLink.limitation_index]
      ? answerLink.limitation
      : null;
  const orientation = state?.orientation;
  const earlyChoice =
    !brief &&
    state?.status !== 'evidence_changed' &&
    orientation?.status === 'ready' &&
    orientation.revision &&
    orientation.briefing?.clarification?.trim() &&
    (orientation.briefing.directions?.length || 0) >= 2 &&
    orientation.briefing.directions?.every((direction) =>
      state?.sources.some((source) => source.id === direction.source_id),
    )
      ? orientation.briefing
      : null;
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

  async function reply(
    text: string,
    direction?: number,
    followUpId?: string,
    orientationRevision?: number,
  ) {
    if (
      !page ||
      !state ||
      !canEdit ||
      sending.current ||
      text.trim().length < 5
    )
      return;
    let command = pending || {
      id: page.id,
      body: {
        request_key: uid(),
        expected_revision: state.revision,
        question: text.trim(),
        public_query_confirmed: true as const,
        ...(direction === undefined ? {} : { direction }),
        ...(followUpId === undefined ? {} : { follow_up_id: followUpId }),
        ...(orientationRevision === undefined
          ? {}
          : { orientation_revision: orientationRevision }),
      },
    };
    sending.current = true;
    setBusy(true);
    setError('');
    const current = lifecycle.generation;
    let replySent = false;
    try {
      if (!pending && ['queued', 'running'].includes(page.status)) {
        const paused = await api<Episode>(`${root}/${page.id}/control`, {
          expected_revision: page.revision,
          action: 'pause',
        });
        if (lifecycle.generation !== current) return;
        command = {
          ...command,
          body: {
            ...command.body,
            expected_revision: paused.exploration.revision,
          },
        };
      }
      setPending(command);
      replySent = true;
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
          !replySent ||
          (failure instanceof ApiError &&
            failure.status !== null &&
            [401, 403, 404, 409, 422].includes(failure.status))
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
  const directionChoices = (brief?.directions || earlyChoice?.directions)?.map(
    (direction, index) => (
      <article key={direction.question}>
        <Button
          variant="outline"
          disabled={busy || !!pending}
          onClick={() =>
            void reply(
              direction.question,
              index,
              undefined,
              earlyChoice ? orientation?.revision : undefined,
            )
          }
        >
          {direction.question}
        </Button>
        <p>{direction.why}</p>
        {quote(direction)}
      </article>
    ),
  );
  const active = page && ['queued', 'running'].includes(page.status);
  return (
    <section className="exploration" aria-label="Developing your research">
      <p className="chapter-kicker">
        {active ? 'Research in progress' : 'Research checkpoint'}
      </p>
      <h2>
        {brief
          ? brief.assessment
            ? 'What the evidence says about your question'
            : 'What the first evidence suggests'
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
          {!brief?.assessment && (
            <p className="exploration-question">
              <span className="content-origin">Your question</span>
              {page.question}
            </p>
          )}
          {(active || page.status === 'paused') && (
            <ResearchActivity
              state={state}
              readStartedAt={resource.readStartedAt}
              originalQuestion={page.question}
            />
          )}
          {active && (
            <p className="muted">
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
          {(earlyChoice ||
            (!active &&
              (state.status !== 'exploring' ||
                page.status === 'paused' ||
                page.status === 'cancelled'))) &&
            !state.continued_by &&
            canEdit && (
              <section className="exploration-choice">
                <h3>
                  {earlyChoice?.clarification ||
                    (nextCheck
                      ? nextCheck.basis === 'further_question'
                        ? 'Another way to investigate this question'
                        : nextCheck.basis === 'open_question'
                          ? 'An open question to investigate'
                          : 'A useful next check'
                      : brief?.clarification ||
                        'Where would you like to go next?')}
                </h3>
                <p className="muted">
                  {active
                    ? 'Optional: choosing a direction pauses this episode and starts a focused public research episode. Earlier evidence is kept. Without a reply, the current research continues.'
                    : 'Your choice starts one more bounded episode using public research providers. Earlier evidence is kept. No reply is needed to keep this briefing.'}
                </p>
                {nextCheck && !earlyChoice && (
                  <article>
                    <p>
                      <strong>{nextCheck.question}</strong>
                    </p>
                    {nextUncertainty && (
                      <p className="muted">
                        <span className="content-origin">
                          AI · connection to your answer
                        </span>
                        To investigate: {nextUncertainty}
                      </p>
                    )}
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
                {nextCheck && !earlyChoice && directionChoices?.length ? (
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
                <details
                  open={(!brief && !nextCheck && !earlyChoice) || undefined}
                >
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

export function ResearchActivity({
  state,
  readStartedAt,
  originalQuestion,
}: {
  state: ExplorationState;
  readStartedAt: number | null;
  originalQuestion?: string;
}) {
  const activity = state.current_activity;
  const deadline =
    activity?.status === 'working' && readStartedAt !== null
      ? readStartedAt + Math.max(0, Math.min(90000, activity.valid_for_ms))
      : null;
  return (
    <CurrentResearchReceipt
      key={deadline ?? 'unconfirmed'}
      state={state}
      deadline={deadline}
      originalQuestion={originalQuestion}
    />
  );
}

function CurrentResearchReceipt({
  state,
  deadline,
  originalQuestion,
}: {
  state: ExplorationState;
  deadline: number | null;
  originalQuestion?: string;
}) {
  const activity = state.current_activity;
  const [valid, setValid] = useState(
    () =>
      deadline !== null &&
      Number.isFinite(deadline) &&
      deadline > performance.now(),
  );
  useEffect(() => {
    if (deadline === null || !Number.isFinite(deadline)) return;
    const wait = deadline - performance.now();
    const timer = setTimeout(() => setValid(false), Math.max(0, wait) + 1);
    return () => clearTimeout(timer);
  }, [deadline]);
  if (
    state.status === 'evidence_changed' ||
    activity?.status === 'evidence_changed'
  )
    return (
      <output>
        Current research details are hidden because supporting access or
        evidence changed.
      </output>
    );
  if (activity?.status === 'finished') return null;
  if (activity?.status === 'paused')
    return (
      <output>
        Research is paused. Saved passages remain available below.
      </output>
    );
  if (activity?.status === 'waiting')
    return (
      <output>
        Waiting for the next research step to start. Saved progress is kept.
      </output>
    );
  const labels: Record<string, string> = {
    plan: 'Planning the first checks',
    reformulate: 'Considering another search wording',
    search: 'Searching for sources',
    gate: 'Checking which sources may help',
    gate_review: 'Reviewing an uncertain source match',
    read: 'Reading selected source passages',
    extract: 'Analysing captured passages',
    reflect: 'Checking what to investigate next',
    orient: 'Preparing a first interpretation',
    brief: 'Preparing the research briefing',
    compare: 'Comparing saved evidence',
  };
  if (
    activity?.status !== 'working' ||
    deadline === null ||
    !Number.isFinite(deadline) ||
    !valid ||
    !labels[activity.phase]
  )
    return (
      <output>
        Current activity is not confirmed. Saved progress is kept; waiting for
        an update.
      </output>
    );
  return (
    <div aria-label="Current research step">
      <output>
        <strong>{labels[activity.phase]}</strong>
        {activity.question !== originalQuestion && <> · {activity.question}</>}
        {activity.testing_query && (
          <>
            {' '}
            · Testing an alternative wording; your original question is
            unchanged.
          </>
        )}
        {activity.checking_alternative && (
          <>
            . Checking another source after an earlier page could not be read.
          </>
        )}
      </output>
      <CurrentResearchPurpose value={activity.purpose} />
      {activity.latest_source && (
        <p className="muted">
          Latest captured source:{' '}
          <a href={activity.latest_source.url} target="_blank" rel="noreferrer">
            {activity.latest_source.title}
          </a>{' '}
          · {date(activity.latest_source.captured_at)}. Selected passages, not
          the whole document.
        </p>
      )}
    </div>
  );
}

function CurrentResearchPurpose({ value }: { value?: ResearchPurpose | null }) {
  if (
    value?.contract !== 'research-purpose/v1' ||
    typeof value.text !== 'string' ||
    value.text.trim().length < 5 ||
    value.text.length > 500 ||
    !['planned', 'source_follow_up'].includes(value.kind) ||
    (value.kind === 'source_follow_up' &&
      (!value.trigger?.quote ||
        !value.trigger?.locator ||
        !value.trigger?.source?.url ||
        !value.trigger?.source?.title))
  )
    return null;
  return (
    <div>
      <p className="muted">
        <span className="content-origin">AI · why this check</span> {value.text}
      </p>
      {value.kind === 'source_follow_up' && (
        <details className="exploration-citation">
          <summary>Passage behind this question</summary>
          <blockquote>{value.trigger.quote}</blockquote>
          <a href={value.trigger.source.url} target="_blank" rel="noreferrer">
            {value.trigger.source.title}
          </a>{' '}
          · {value.trigger.locator}
          <p className="muted">
            This passage prompted further research; it does not settle the
            question.
          </p>
        </details>
      )}
    </div>
  );
}

export function ExplorationBrief({ state }: { state: ExplorationState }) {
  const brief = state.briefing;
  const update = state.research_update;
  const promotedAssessment =
    !brief &&
    state.status !== 'evidence_changed' &&
    state.question_assessments?.status === 'ready' &&
    update?.contract === 'question-research-update/v1' &&
    Number.isSafeInteger(update.event_sequence) &&
    update.event_sequence > 0 &&
    !Number.isNaN(Date.parse(update.saved_at))
      ? state.question_assessments.assessments.find(
          (item) =>
            item.question_id === update.question_id &&
            item.stage !== 'final_briefing' &&
            item.points.every((point) =>
              point.evidence.every((ref) =>
                state.sources.some((source) => source.id === ref.source_id),
              ),
            ),
        )
      : undefined;
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
        {promotedAssessment && update ? (
          <>
            <section
              className="exploration-understanding"
              key={`${promotedAssessment.question_id}:${update.event_sequence}`}
            >
              <span className="content-origin">AI · saved research update</span>
              <h3>{promotedAssessment.question}</h3>
              <p className="muted">
                Saved {date(update.saved_at)} · Based on the passages read.
              </p>
              <QuestionCheckpointContent
                assessment={promotedAssessment}
                state={state}
              />
              <p className="muted">
                This assessment remains open to human review.
              </p>
            </section>
            {(state.orientation || !!state.changes?.length) && (
              <details className="dossier-secondary">
                <summary>Earlier research context</summary>
                <EarlyOrientation state={state} historical />
                <InterpretationChanges state={state} />
              </details>
            )}
          </>
        ) : (
          <>
            <EarlyOrientation state={state} />
            <InterpretationChanges state={state} />
          </>
        )}
        <BranchQuestionProgress
          state={state}
          excludeQuestionId={promotedAssessment?.question_id}
        />
        <ObservedResearchScope state={state} />
      </>
    );
  const questionUpdateNotice =
    state.status === 'ready' &&
    brief.question_updates?.status === 'unavailable' ? (
      <p className="muted">
        Question assessments could not be updated. The research summary is
        available; earlier assessments remain unchanged.
      </p>
    ) : null;
  const background = (
    <>
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
  const assessment = brief.assessment;
  if (!assessment)
    return (
      <>
        <ContinuedCheck state={state} />
        {brief.selected_direction_assessment?.status === 'unavailable' && (
          <p className="muted">
            An assessment of your selected question is unavailable. The research
            summary is still available below.
          </p>
        )}
        {background}
        {questionUpdateNotice}
        <BranchQuestionProgress state={state} />
        <ObservedResearchScope state={state} />
      </>
    );
  const label = {
    possible_answer: 'A possible answer from the sources',
    partial: 'Some evidence; the question remains open',
    conflicting: 'The read evidence conflicts',
    not_found: 'No answer found in the material read',
  }[assessment.status];
  return (
    <>
      <section aria-label="Assessment of the selected question">
        <span className="content-origin">AI · source-backed assessment</span>
        <h3>{label}</h3>
        <p className="exploration-question">{assessment.question}</p>
        {assessment.points.map((point, index) => (
          <article key={index}>
            <p>{point.statement}</p>
            <details className="exploration-citation">
              <summary>Read the evidence for this point</summary>
              {point.evidence.map((ref, i) => {
                const source = state.sources.find(
                  (item) => item.id === ref.source_id,
                );
                if (!source) return null;
                return (
                  <div key={i}>
                    <span className="content-origin">
                      {ref.role === 'counterevidence'
                        ? 'Counterevidence'
                        : ref.role === 'support'
                          ? 'Supporting passage'
                          : 'Context passage'}
                    </span>
                    <blockquote>{ref.quote}</blockquote>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                    <p className="muted">
                      Captured {date(source.captured_at)} · {ref.locator}
                    </p>
                  </div>
                );
              })}
            </details>
          </article>
        ))}
        <h4>What remains uncertain</h4>
        <ul>
          {assessment.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="muted">
          An interpretation of the cited material, still open to review.
        </p>
      </section>
      {questionUpdateNotice}
      <BranchQuestionProgress state={state} />
      <ObservedResearchScope state={state} />
      <details className="dossier-secondary">
        <summary>Research context & earlier understanding</summary>
        <ContinuedCheck state={state} />
        {background}
      </details>
    </>
  );
}

function BranchQuestionProgress({
  state,
  excludeQuestionId,
}: {
  state: ExplorationState;
  excludeQuestionId?: string;
}) {
  const value = state.question_assessments;
  if (
    state.status === 'evidence_changed' ||
    value?.status !== 'ready' ||
    (!value.assessments.some(
      (item) => item.question_id !== excludeQuestionId,
    ) &&
      !value.unassessed &&
      !value.outdated)
  )
    return null;

  return (
    <details className="dossier-secondary">
      <summary>Research checkpoints by question</summary>
      <p className="muted">
        AI assessments of the passages read at each checkpoint. Capturing
        material does not mean the question is answered.
      </p>
      {value.assessments
        .filter((item) => item.question_id !== excludeQuestionId)
        .map((assessment) => (
          <article key={assessment.question_id}>
            <h4>{assessment.question}</h4>
            {assessment.stage === 'final_briefing' && (
              <p className="content-origin">Updated in the research summary</p>
            )}
            <QuestionCheckpointContent assessment={assessment} state={state} />
            {!!assessment.earlier?.length && (
              <details className="exploration-citation">
                <summary>Earlier assessment</summary>
                <p className="muted">
                  Saved before the later evidence was considered.
                </p>
                {assessment.earlier.map((earlier, index) => (
                  <QuestionCheckpointContent
                    key={index}
                    assessment={earlier}
                    state={state}
                  />
                ))}
              </details>
            )}
          </article>
        ))}
      {!!value.outdated && (
        <p className="muted">
          Earlier assessments changed with new public evidence and need a fresh
          review. Their earlier continuation proposals are unavailable.
        </p>
      )}
      {value.unassessed > 0 && (
        <p className="muted">{`${value.unassessed} completed ${value.unassessed === 1 ? 'question has' : 'questions have'} no validated answer assessment. Their outcome remains unknown.`}</p>
      )}
      <p className="muted">
        These interpretations remain open to human review.
      </p>
    </details>
  );
}

function QuestionCheckpointContent({
  assessment,
  state,
}: {
  assessment: Pick<QuestionAssessment, 'status' | 'points' | 'limitations'>;
  state: ExplorationState;
}) {
  const labels = {
    possible_answer: 'A possible answer from the read sources',
    partial: 'Some evidence; the question remains open',
    conflicting: 'Conflicting evidence; the question remains open',
    not_found: 'No answer found in the material read',
  };
  return (
    <>
      <p>
        <strong>{labels[assessment.status]}</strong>
      </p>
      {assessment.points.map((point, i) => (
        <div key={i}>
          <p>{point.statement}</p>
          <details className="exploration-citation">
            <summary>Read the evidence for this assessment</summary>
            {point.evidence.map((ref, j) => {
              const source = state.sources.find((s) => s.id === ref.source_id);
              return source ? (
                <div key={j}>
                  <span className="content-origin">
                    {ref.role === 'support'
                      ? 'Supporting passage'
                      : ref.role === 'counterevidence'
                        ? 'Counterevidence'
                        : 'Context passage'}
                  </span>
                  <blockquote>{ref.quote}</blockquote>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                  </a>
                  <p className="muted">
                    Captured {date(source.captured_at)} · {ref.locator}
                  </p>
                </div>
              ) : null;
            })}
          </details>
        </div>
      ))}
      <ul>
        {assessment.limitations.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </>
  );
}

function ReadRelevanceDetails({ state }: { state: ExplorationState }) {
  const scope = state.research_scope;
  if (scope?.status !== 'ready' || scope.read_relevance?.status !== 'ready')
    return null;
  const relevance = scope.read_relevance;
  const labels = {
    direct: 'Helps answer this question',
    context: 'Provides context',
    counterevidence: 'Questions an assumption',
    unrelated: 'Appears unrelated to this question',
    uncertain: 'Relevance is uncertain',
  };
  const limits = {
    entity: 'Entity match needs attention',
    jurisdiction: 'Jurisdiction needs attention',
    date: 'Date or period needs attention',
    incomplete: 'The captured passages are incomplete',
  };
  return (
    <div aria-label="Relevance of read sources">
      <p className="muted">
        AI assessments of captured passages, not human review or a judgment of
        source truth. Context and counterevidence can still help. No assessment
        does not mean irrelevant.
      </p>
      {relevance.assessments.map((item) => {
        const source = state.sources.find((s) => s.id === item.source_id);
        if (!source) return null;
        return (
          <article key={item.source_id + item.question_id}>
            <p>
              <strong>AI · {labels[item.category]}</strong>
            </p>
            <p>
              For: <q>{item.question}</q>
            </p>
            <p>{item.reason}</p>
            {item.limitations.length > 0 && (
              <p className="muted">
                {item.limitations.map((v) => limits[v]).join('. ')}.
              </p>
            )}
            <blockquote>{item.quote}</blockquote>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.title}
            </a>
            <p className="muted">
              Captured {date(source.captured_at)} · {item.locator}. The source
              remains saved.
            </p>
          </article>
        );
      })}
      {relevance.unassessed > 0 && (
        <p>{`${relevance.unassessed} captured ${relevance.unassessed === 1 ? 'source has' : 'sources have'} no validated relevance assessment yet.`}</p>
      )}
    </div>
  );
}

function RecordedQueries({ journal }: { journal?: ObservedQueries }) {
  if (!journal || journal.contract !== 'observed-public-queries/v1')
    return null;
  if (journal.status === 'evidence_changed')
    return (
      <p className="muted">
        The search journal is unavailable because its supporting context
        changed.
      </p>
    );
  if (journal.status === 'unknown')
    return (
      <p className="muted">
        Exact search wording was not recorded for this earlier episode.
      </p>
    );
  if (journal.status !== 'ready') return null;
  const outcome = (item: (typeof journal.items)[number]) => {
    if (item.outcome === 'unavailable')
      return 'No usable search result was recorded.';
    if (item.outcome === 'interrupted')
      return 'Interrupted; execution outcome is unconfirmed.';
    if (item.outcome !== 'completed')
      return 'Dispatch recorded; execution outcome is unconfirmed.';
    if (item.retrieval?.status === 'partial')
      return 'Some search indexes did not respond.';
    if (item.retrieval?.status === 'unavailable')
      return 'Search indexes were unavailable.';
    if (item.retrieval?.status !== 'complete')
      return 'Index outcomes were not recorded.';
    return item.retrieval.candidate_appearances
      ? 'Search returned candidates.'
      : 'Search returned no candidates.';
  };
  return (
    <div aria-label="Recorded search attempts">
      <p className="content-origin">Recorded search attempts</p>
      {journal.items.length ? (
        <ul>
          {journal.items.map((item) => (
            <li key={item.step_id}>
              <q>{item.query}</q> — {outcome(item)}{' '}
              <span className="muted">Recorded {date(item.started_at)}.</span>
            </li>
          ))}
        </ul>
      ) : journal.scope.search_steps === 0 ? (
        <p>No search dispatch has been recorded in this episode.</p>
      ) : null}
      {journal.scope.unrecorded_steps > 0 && (
        <p>
          Exact wording is unavailable for {journal.scope.unrecorded_steps}{' '}
          earlier search steps.
        </p>
      )}
      {journal.scope.truncated && (
        <p>
          Showing the latest {journal.scope.limit} search steps in this episode.
        </p>
      )}
      <p className="muted">
        Planned questions and proposed alternatives are not completed searches.
        Search results are not read evidence or an answer.
      </p>
    </div>
  );
}

function ObservedResearchScope({ state }: { state: ExplorationState }) {
  const scope = state.research_scope;
  if (
    scope?.status === 'evidence_changed' ||
    state.status === 'evidence_changed'
  )
    return (
      <p className="muted">
        The research scope is hidden because supporting access or evidence
        changed.
      </p>
    );
  if (!scope || scope.status === 'unknown')
    return (
      <p className="muted">
        This earlier episode has no reliable record of its research scope. Its
        coverage is unknown.
      </p>
    );
  if (scope.status !== 'ready') return null;
  const { material, searches, reads, candidates, questions, indexes } = scope;
  if (scope.activity === 'queued' && !material.sources) return null;
  const gaps =
    searches.unavailable +
    searches.interrupted +
    reads.unavailable +
    reads.interrupted;
  const count = (n: number, singular: string, plural = singular + 's') =>
    `${n} ${n === 1 ? singular : plural}`;
  const budgets: Record<string, string> = {
    search_requests: 'search budget',
    source_fetches: 'source reading budget',
    model_calls: 'analysis budget',
    decision_calls: 'source selection budget',
    active_seconds: 'time budget',
    branch_budget: 'number of research directions',
    depth_budget: 'depth of follow-up research',
  };
  return (
    <div aria-label="Observed research scope">
      <p className="muted">
        {material.passages
          ? `${count(material.passages, 'saved passage')} from ${count(material.sources, 'captured source')}.`
          : 'No public source passages captured in this episode.'}{' '}
        {gaps > 0 &&
          `${count(gaps, 'search or reading attempt')} did not complete. `}
        {indexes.unavailable > 0 &&
          `${count(indexes.unavailable, 'search index request')} unavailable. `}
        {questions.open > 0 &&
          `${count(questions.open, 'research question')} still open. `}
        Selected passages; wider coverage remains unverified.
      </p>
      {scope.source_recovery?.status === 'ready' &&
        scope.source_recovery.failed_reads > 0 && (
          <p className="muted" aria-label="Source recovery">
            After unsuccessful reading attempts,{' '}
            {count(
              scope.source_recovery.reads_attempted,
              'alternative reading attempt',
            )}{' '}
            saved passages from{' '}
            {count(scope.source_recovery.captures, 'alternative source')}.{' '}
            {scope.source_recovery.candidate_sets_exhausted > 0 &&
              'Some directions have no further candidates in the saved search results. '}
            {scope.source_recovery.unfinished > 0 &&
              'Alternative checks remain unfinished. '}
            These sources do not establish equal authority or a settled answer.
          </p>
        )}
      {scope.query_recovery?.status === 'ready' && (
        <p className="muted" aria-label="Query recovery">
          {scope.query_recovery.proposal_unavailable
            ? 'Another search wording could not be prepared.'
            : scope.query_recovery.searches_completed > 0
              ? `A different search wording was checked; ${count(scope.query_recovery.captures, 'source')} captured.`
              : scope.query_recovery.searches_unavailable > 0
                ? 'The alternative search did not complete.'
                : scope.query_recovery.outcome === 'no_alternative'
                  ? 'No distinct alternative search wording was selected.'
                  : 'An alternative wording has not been searched yet.'}{' '}
          {scope.query_recovery.unfinished && 'This check remains unfinished. '}
          Your original question is unchanged. Search wording is a hypothesis,
          not a confirmed interpretation.
        </p>
      )}
      {scope.read_relevance?.status === 'ready' &&
        scope.read_relevance.assessments.length > 0 && (
          <p className="muted" aria-label="Read relevance summary">
            {`AI assessed relevance for ${count(scope.read_relevance.assessments.length, 'captured source')} against the research questions. `}
            {scope.read_relevance.alternative_reads > 0 &&
              `${scope.read_relevance.alternative_reads} additional reading attempts followed passages assessed as unrelated. `}
            {scope.read_relevance.unfinished > 0 &&
              'Further checks remain unfinished. '}
            These assessments do not establish an answer.
          </p>
        )}
      <details className="dossier-secondary">
        <summary>What was checked and what remains</summary>
        <RecordedQueries journal={scope.observed_queries} />
        <ReadRelevanceDetails state={state} />
        {scope.query_recovery?.status === 'ready' &&
          scope.query_recovery.query && (
            <p>
              Original search wording:{' '}
              <q>{scope.query_recovery.original_query}</q>.<br />
              Alternative wording (unconfirmed):{' '}
              <q>{scope.query_recovery.query}</q>.
            </p>
          )}
        <ul>
          <li>
            Search: {searches.completed} completed, {searches.unavailable}{' '}
            unavailable, {searches.interrupted} interrupted, {searches.running}{' '}
            in progress.
          </li>
          <li>
            Search indexes: {indexes.completed} completed requests,{' '}
            {indexes.unavailable} unavailable.{' '}
            {indexes.unknown_searches > 0 &&
              `Index outcomes were not recorded for ${count(indexes.unknown_searches, 'search step')}.`}
          </li>
          <li>
            Source reading: {reads.completed} completed, {reads.unavailable}{' '}
            unavailable, {reads.interrupted} interrupted, {reads.running} in
            progress. A completed reading captures selected passages, not the
            whole document.
          </li>
          <li>
            {count(candidates.retrieved, 'candidate appearance')} in search
            results; {candidates.not_evaluated} not evaluated,{' '}
            {candidates.evaluation_unavailable} without a usable relevance
            decision, {candidates.selected_not_read} selected with reading not
            yet started. Repeated appearances can refer to the same source.
          </li>
          <li>
            {count(questions.open, 'question')} open or unresolved;{' '}
            {questions.not_started} not yet started. Other questions may have
            evidence without a settled answer.
          </li>
          {material.truncated_sources > 0 && (
            <li>
              {count(material.truncated_sources, 'capture')} used only the
              beginning of the extracted text.
            </li>
          )}
          {material.unknown_reader_scope > 0 && (
            <li>
              Reading limits were not recorded for{' '}
              {count(material.unknown_reader_scope, 'capture')}.
            </li>
          )}
          {scope.budget_stops.length > 0 && (
            <li>
              Work remains outside this episode’s{' '}
              {scope.budget_stops
                .map((key) => budgets[key])
                .filter(Boolean)
                .join(', ')}
              .
            </li>
          )}
        </ul>
        <p className="muted">
          Recorded public research work only. These counts do not establish
          independent sources or answer quality.
        </p>
      </details>
    </div>
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
      {brief.read_preparation?.contract === 'read-informed-research/v1' && (
        <details className="exploration-citation">
          <summary>How this first reading was prepared</summary>
          <p>
            {`This first reading included ${brief.read_preparation.assessed_sources} ${brief.read_preparation.assessed_sources === 1 ? 'source' : 'sources'} with an AI relevance assessment. ${brief.read_preparation.unassessed_sources} ${brief.read_preparation.unassessed_sources === 1 ? 'source was' : 'sources were'} still unassessed. `}
            Each assessment concerns a specific research question. A source may
            help one question and leave another unanswered.
          </p>
          <p className="muted">
            Later research may change the picture. This note records what was
            available at this checkpoint.
          </p>
        </details>
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

function SavedCheckPassage({
  check,
  originalQuestion,
}: {
  check: Pick<SavedCheck, 'quote' | 'locator' | 'source'>;
  originalQuestion?: string;
}) {
  return (
    <details className="exploration-citation">
      <summary>
        {originalQuestion
          ? 'Why this direction arose · earlier source passage'
          : 'Why this check arose · earlier source passage'}
      </summary>
      {originalQuestion && (
        <p>
          <span className="content-origin">Your original question</span>
          {originalQuestion}
        </p>
      )}
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
  const direction = state.selected_direction;
  if (direction) {
    if (direction.status !== 'ready' || state.status === 'evidence_changed')
      return (
        <p className="muted">
          The earlier evidence behind your chosen direction changed. Its context
          is hidden; review the earlier episode or correct your question.
        </p>
      );
    if (direction.contract !== 'selected-direction/v1') return null;
    return (
      <section
        className="dossier-secondary"
        aria-label="Following your chosen direction"
      >
        <span className="content-origin">
          Your selected direction · earlier research context
        </span>
        <p>
          <span className="content-origin">AI · why this direction</span>
          {direction.why}
        </p>
        <SavedCheckPassage
          check={direction}
          originalQuestion={direction.original_question}
        />
        <EpisodeProgress progress={state.capture_progress} />
      </section>
    );
  }
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
        {check.basis === 'further_question'
          ? 'Your continued question · earlier research context'
          : check.basis === 'open_question'
            ? 'Your selected open question · earlier research context'
            : 'Your selected check · earlier research context'}
      </span>
      <p>{check.purpose}</p>
      <SavedCheckPassage check={check} />
      <EpisodeProgress progress={state.capture_progress} />
    </section>
  );
}

function EpisodeProgress({ progress }: { progress?: CaptureProgress | null }) {
  if (!progress) return null;
  if (progress.status !== 'ready')
    return (
      <p className="muted">
        The comparison&apos;s source material changed. Its results are hidden
        until the evidence is reviewed.
      </p>
    );
  const { counts, scope, items } = progress;
  const onlyRepeated =
    counts.repeated > 0 &&
    counts.unmatched + counts.changed_capture + counts.unestablished === 0;
  const labels = {
    repeated: 'Previously captured content',
    changed_capture: 'Saved content changed',
    unmatched: 'Not seen in the compared material',
    unestablished: 'Comparison unavailable',
  };
  return (
    <div aria-label="What this check added">
      <h3>What this check added</h3>
      {scope.current_captures === 0 ? (
        <p>No eligible source material has been captured in this episode.</p>
      ) : (
        <>
          <p>{`${counts.unmatched} new to this comparison · ${counts.changed_capture} changed · ${counts.repeated} repeated${counts.unestablished ? ` · ${counts.unestablished} unestablished` : ''}.`}</p>
          {onlyRepeated && <p>Only previously captured content was read.</p>}
        </>
      )}
      {scope.truncated && (
        <p className="muted">
          This comparison covers part of the saved history.
        </p>
      )}
      <details>
        <summary>Compare the saved sources</summary>
        <p className="muted">{`Compared with ${scope.previous_captures} saved sources from ${scope.previous_episodes} earlier episodes. Capture comparisons do not establish independent confirmation or an answer to the question.`}</p>
        {items.map((item) => (
          <article key={item.current.id}>
            <strong>{labels[item.classification]}</strong>
            <p>
              <a href={item.current.url} target="_blank" rel="noreferrer">
                {item.current.title}
              </a>
              {` · captured ${date(item.current.captured_at)}`}
            </p>
            {item.previous && (
              <p>
                Earlier:{' '}
                <a href={item.previous.url} target="_blank" rel="noreferrer">
                  {item.previous.title}
                </a>
                {` · captured ${date(item.previous.captured_at)}`}
              </p>
            )}
            <p>{item.comparison.basis}</p>
            <p className="muted">{item.comparison.temporal_basis}</p>
          </article>
        ))}
      </details>
    </div>
  );
}
