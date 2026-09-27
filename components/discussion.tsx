'use client';

import { dossierHref } from '@/lib/dossier-navigation';
import { sourceImport } from '@/lib/discovery-reference';
import { answerReviewRequest } from '@/lib/answer-review';
import {
  firstQuestionPage,
  questionFilters,
  questionLibraryPath,
  questionPage,
  questionReads,
} from '@/lib/question-library';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  CircleHelp,
  ClipboardList,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type {
  DossierRecord,
  Entry,
  ResearchActionSeed,
  Run,
  SearchHit,
  SearchRecipe,
  SavedSearchInput,
  ThreadDetail,
  ThreadPage,
  QuestionSelection,
  QuestionStatus,
  WorkAction,
} from '@/lib/contracts';
import { api, date, uid } from '@/lib/api';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import { ActionDialog, WorkField } from './action-dialog';
import { Discovery } from './discovery';
import { ResearchFollowups } from './research-followups';
import { SavedSearches } from './saved-searches';
import { ResearchPreview } from './research-preview';
import { ResearchSourceAccess } from './research-source-access';

function safeSource(url: string) {
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function ResearchPost({
  dossierId,
  post,
  onSearch,
  onFollowup,
  busy = false,
}: {
  dossierId: string;
  post: Entry;
  onSearch: (query: string) => void;
  onFollowup?: (post: Entry, gapIndex: number) => void;
  busy?: boolean;
}) {
  if (post.kind !== 'research')
    return (
      <>
        <p className="discussion-body">{post.body}</p>
        {safeSource(post.url) && (
          <a
            className="source-link"
            href={post.url}
            target="_blank"
            rel="noreferrer"
          >
            Contributed source <ArrowUpRight size={15} />
          </a>
        )}
      </>
    );
  return (
    <div className="research-note">
      <div className="research-note-label">
        <Sparkles size={16} />
        AI research note · verify before accepting
        <span>
          {post.data.provider} · {post.data.model}
        </span>
      </div>
      {post.data.findings?.length ? (
        post.data.findings.map((finding, i) => (
          <section key={i}>
            <p className="discussion-body">{finding.claim}</p>
            {finding.citations.map((citation, j) => {
              const source = post.data.sources?.find(
                (s) => s.id === citation.source_id,
              );
              return (
                <blockquote className="research-citation" key={j}>
                  <p>“{citation.quote}”</p>
                  <footer>
                    {source?.title || citation.source_id} ·{' '}
                    {source?.kind.replaceAll('_', ' ')}
                    {source?.url && safeSource(source.url) && (
                      <a href={source.url} target="_blank" rel="noreferrer">
                        Open source <ArrowUpRight size={13} />
                      </a>
                    )}
                  </footer>
                  {source && post.thread_id && (
                    <ResearchSourceAccess
                      key={`${post.id}:${source.id}`}
                      dossierId={dossierId}
                      source={source}
                      note={{ id: post.id, questionId: post.thread_id }}
                    />
                  )}
                </blockquote>
              );
            })}
          </section>
        ))
      ) : (
        <p>{post.body}</p>
      )}
      <div className="research-gaps">
        <h4>
          <CircleHelp size={17} />
          Still to establish
        </h4>
        <ul>
          {post.data.unknowns?.map((gap, i) => (
            <li key={i}>
              <span>{gap}</span>
              {onFollowup && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => onFollowup(post, i)}
                >
                  <ClipboardList size={14} /> Create follow-up
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="research-query-list">
        <h4>Search next</h4>
        {post.data.search_queries?.map((query) => (
          <Button
            key={query}
            variant="outline"
            size="sm"
            onClick={() => onSearch(query)}
          >
            <Search size={14} />
            {query}
          </Button>
        ))}
      </div>
      <details className="research-source-details">
        <summary>
          Evidence used · {post.data.sources?.length || 0} snapshots
        </summary>
        {post.data.sources?.map((source) => (
          <div key={source.id}>
            <b>
              {source.id} · {source.title}
            </b>
            <span>
              {source.kind.replaceAll('_', ' ')} · saved {date(source.date)}
            </span>
            <p>{source.text}</p>
            {post.thread_id && (
              <ResearchSourceAccess
                key={`${post.id}:${source.id}`}
                dossierId={dossierId}
                source={source}
                note={{ id: post.id, questionId: post.thread_id }}
              />
            )}
          </div>
        ))}
      </details>
    </div>
  );
}

export function Discussion({
  dossier,
  initialQuestionId,
  canEdit,
  busy,
  run,
  reload,
  notify,
  onRefine,
}: {
  dossier: DossierRecord;
  initialQuestionId?: string | null;
  canEdit: boolean;
  busy: string;
  run: Run;
  reload: () => Promise<void>;
  notify: (text: string) => void;
  onRefine: (question: string) => void;
}) {
  const canContribute = dossier.access?.can_contribute ?? canEdit;
  const [selected, setSelected] = useState<ThreadDetail | null>(null),
    [failure, setFailure] = useState(''),
    [selection, setSelection] = useState<QuestionSelection>(() =>
      firstQuestionPage({ query: '', status: 'all' }),
    ),
    [draftQuery, setDraftQuery] = useState(''),
    [refreshing, setRefreshing] = useState(false),
    [failedQuestion, setFailedQuestion] = useState<{
      id: string;
      offset: number;
    } | null>(null),
    [openingQuestion, setOpeningQuestion] = useState<string | null>(
      initialQuestionId || null,
    ),
    [postOffset, setPostOffset] = useState(0),
    [adding, setAdding] = useState(false),
    [question, setQuestion] = useState({ title: '', body: '' }),
    [questionKey, setQuestionKey] = useState(uid),
    [reply, setReply] = useState(''),
    [source, setSource] = useState(''),
    [replyKey, setReplyKey] = useState(uid),
    [discoveryQuery, setDiscoveryQuery] = useState<string | null>(null),
    [discoveryRecipe, setDiscoveryRecipe] = useState<SearchRecipe | null>(null),
    [savedSearchesOpen, setSavedSearchesOpen] = useState(false),
    [previewQuestion, setPreviewQuestion] = useState<string | null>(null),
    [actionSeed, setActionSeed] = useState<ResearchActionSeed | null>(null),
    [editingAction, setEditingAction] = useState<WorkAction | null>(null),
    [actionsRefresh, setActionsRefresh] = useState(0);
  const sourceKeys = useRef(new Map<string, string>());
  const reads = useRef(questionReads());
  const root = `/products/${product.id}/dossiers/${dossier.id}`;
  const url = questionLibraryPath(product.id, dossier.id, selection);
  const {
    data,
    error: listFailure,
    loading,
    refresh: load,
  } = useResource<ThreadPage>(url);
  const fetchQuestion = useCallback(
    async (id: string, page = 0) => {
      try {
        const thread = await reads.current.read(() =>
          api<ThreadDetail>(
            `${root}/discussion/${encodeURIComponent(id)}?offset=${page}`,
          ),
        );
        if (!thread) return;
        setSelected(thread);
        setPostOffset(page);
        setFailure('');
        setFailedQuestion(null);
        setOpeningQuestion(null);
        window.history.replaceState(
          {},
          '',
          dossierHref({ id: dossier.id, questionId: id }),
        );
      } catch (error) {
        setFailure((error as Error).message);
        setFailedQuestion({ id, offset: page });
        setOpeningQuestion(null);
      }
    },
    [root, dossier.id],
  );
  const open = useCallback(
    async (id: string, page = 0) => {
      setOpeningQuestion(id);
      setFailure('');
      setFailedQuestion(null);
      await fetchQuestion(id, page);
    },
    [fetchQuestion],
  );
  useEffect(() => {
    const currentReads = reads.current;
    const questionToOpen = new URLSearchParams(window.location.search).get(
      'question',
    );
    if (questionToOpen) void fetchQuestion(questionToOpen);
    return () => currentReads.cancel();
  }, [initialQuestionId, fetchQuestion]);
  function returnToQuestions() {
    reads.current.cancel();
    setSelected(null);
    setFailure('');
    setFailedQuestion(null);
    setOpeningQuestion(null);
    setReply('');
    setSource('');
    setReplyKey(uid());
    window.history.replaceState({}, '', dossierHref({ id: dossier.id }));
  }
  async function refreshQuestions() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }
  function searchQuestions(next: QuestionSelection) {
    if (questionLibraryPath(product.id, dossier.id, next) === url)
      void refreshQuestions();
    else setSelection(next);
  }
  const waiting = !!busy || loading || refreshing || !!openingQuestion;
  async function changed(id: string) {
    await open(id, postOffset);
    await load();
    await reload();
  }
  function prepareFollowup(post?: Entry, gapIndex?: number) {
    if (!selected || !canEdit || busy) return;
    setActionSeed({
      origin: {
        thread_id: selected.id,
        ...(post && gapIndex !== undefined
          ? { entry_id: post.id, gap_index: gapIndex }
          : {}),
      },
      question: selected.title,
      context: selected.body,
      ...(post && gapIndex !== undefined
        ? { gap: post.data.unknowns?.[gapIndex] }
        : {}),
    });
  }
  async function saveSource(hit: SearchHit) {
    await api(
      `${root}/discovery-references`,
      sourceImport(hit, sourceKeys.current, uid),
    );
    await reload();
    notify(
      'Source saved to the topic. Open Evidence & sources to connect a page watch.',
    );
  }
  function openDiscovery(query: string, recipe?: SearchRecipe) {
    setSavedSearchesOpen(false);
    setDiscoveryRecipe(recipe || null);
    setDiscoveryQuery(query);
  }
  async function saveSearch(recipe: SavedSearchInput) {
    await api(`${root}/searches`, recipe);
    await reload();
    notify(
      'Search saved for your team. Open Saved searches to review and reuse it.',
    );
  }
  return (
    <>
      {failure && failedQuestion && (
        <div role="alert" className="banner error">
          <span>{failure}</span>
          <Button
            variant="outline"
            disabled={!!openingQuestion}
            onClick={() => void open(failedQuestion.id, failedQuestion.offset)}
          >
            <RefreshCw size={16} /> Retry question
          </Button>
          <Button variant="ghost" onClick={returnToQuestions}>
            Return to questions
          </Button>
        </div>
      )}
      {openingQuestion && !selected && (
        <div className="banner">
          <output>Opening question…</output>
          <Button variant="ghost" onClick={returnToQuestions}>
            Return to questions
          </Button>
        </div>
      )}
      {!selected ? (
        <>
          <div className="discussion-intro">
            <div>
              <h2>Develop this topic together.</h2>
              <p>
                Ask a focused question. Add evidence, compare interpretations
                and keep the working answer open to new information.
              </p>
            </div>
            <div className="discussion-intro-actions">
              <Button variant="outline" onClick={() => openDiscovery('')}>
                <Search size={16} />
                Find sources
              </Button>
              <Button
                variant="outline"
                onClick={() => setSavedSearchesOpen(true)}
              >
                <Bookmark size={16} />
                Saved searches
              </Button>
              <Button
                disabled={!canContribute || !!busy}
                onClick={() => setAdding(true)}
              >
                <Plus size={16} />
                Ask a question
              </Button>
            </div>
          </div>
          <form
            className="grid gap-3 my-5"
            onSubmit={(event) => {
              event.preventDefault();
              searchQuestions(
                firstQuestionPage({
                  query: draftQuery,
                  status: selection.status,
                }),
              );
            }}
          >
            <WorkField label="Find questions in this topic">
              <Input
                type="search"
                maxLength={300}
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                placeholder={
                  product.id === 'pharma'
                    ? 'For example: renal safety'
                    : 'For example: data protection'
                }
                aria-describedby="question-search-scope"
              />
            </WorkField>
            <div className="reference-library-controls">
              <Button type="submit" disabled={waiting}>
                <Search size={16} /> Search questions
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={waiting || (!draftQuery && !selection.query)}
                onClick={() => {
                  setDraftQuery('');
                  searchQuestions(
                    firstQuestionPage({ query: '', status: selection.status }),
                  );
                }}
              >
                Clear search
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={waiting}
                onClick={() => void refreshQuestions()}
              >
                <RefreshCw size={16} /> {refreshing ? 'Refreshing…' : 'Refresh'}
              </Button>
            </div>
          </form>
          <p id="question-search-scope" className="muted">
            Matches all words across question titles and context in this topic,
            with title matches first. Up to 12 distinct words. Use Find sources
            for broader discovery.
          </p>
          <div className="discussion-filters filters">
            {(
              Object.entries(questionFilters) as [QuestionStatus, string][]
            ).map(([value, label]) => (
              <Button
                key={value}
                variant={selection.status === value ? 'secondary' : 'ghost'}
                aria-pressed={selection.status === value}
                disabled={waiting}
                onClick={() =>
                  searchQuestions(
                    firstQuestionPage({
                      query: selection.query,
                      status: value,
                    }),
                  )
                }
              >
                {label}
                {data && !listFailure ? ` (${data.counts[value]})` : ''}
              </Button>
            ))}
          </div>
          {listFailure && (
            <div className="banner error" role="alert">
              <span>{listFailure}</span>
              <Button
                variant="outline"
                disabled={waiting}
                onClick={() => void refreshQuestions()}
              >
                Retry list
              </Button>
              <Button
                variant="ghost"
                disabled={waiting}
                onClick={() => {
                  setDraftQuery('');
                  searchQuestions(
                    firstQuestionPage({ query: '', status: 'all' }),
                  );
                }}
              >
                Show all questions
              </Button>
            </div>
          )}
          {loading && (
            <output className="muted">Loading research questions…</output>
          )}
          {data && !listFailure && (
            <>
              <p className="muted" aria-live="polite">
                {data.total} {questionFilters[data.status].toLowerCase()} in
                this view · {data.dossier_total} questions in this topic
                {data.query && <> · Search: “{data.query}”</>}
              </p>
              <div className="question-list">
                {data.items.map((thread) => (
                  <button
                    key={thread.id}
                    className="question-row"
                    disabled={waiting}
                    onClick={() =>
                      void run('Opening question', () => open(thread.id))
                    }
                  >
                    <span
                      className={
                        thread.accepted_entry_id
                          ? 'question-state answered'
                          : 'question-state'
                      }
                    >
                      {thread.accepted_entry_id ? (
                        <Check size={20} />
                      ) : (
                        <CircleHelp size={20} />
                      )}
                    </span>
                    <div>
                      <h3>{thread.title}</h3>
                      <p>
                        {thread.body ||
                          'A question for this topic’s contributors.'}
                      </p>
                      <span className="question-byline">
                        {thread.author} · {date(thread.updated_at)} ·{' '}
                        {thread.reply_count} contributions
                      </span>
                    </div>
                    <span className="question-state-label">
                      {thread.accepted_entry_id ? 'Working answer' : 'Open'}
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
              {!data.items.length && (
                <div className="discussion-empty">
                  <MessageSquare size={30} />
                  <h3>
                    {data.offset > 0
                      ? 'No questions on this page'
                      : data.dossier_total === 0
                        ? 'What does the team still need to know?'
                        : 'No matching questions'}
                  </h3>
                  <p>
                    {data.dossier_total === 0
                      ? 'Open a focused question to develop this topic with evidence and contributions.'
                      : 'Try fewer words, change the answer filter or return to all questions.'}
                  </p>
                  {data.offset > 0 && (
                    <Button
                      variant="outline"
                      disabled={waiting}
                      onClick={() => searchQuestions(questionPage(data, 0))}
                    >
                      Return to first page
                    </Button>
                  )}
                  {(data.query || data.status !== 'all') && (
                    <Button
                      variant="outline"
                      disabled={waiting}
                      onClick={() => {
                        setDraftQuery('');
                        searchQuestions(
                          firstQuestionPage({ query: '', status: 'all' }),
                        );
                      }}
                    >
                      Show all questions
                    </Button>
                  )}
                  {canContribute && data.dossier_total === 0 && (
                    <Button
                      disabled={waiting}
                      onClick={() => {
                        setQuestion({
                          title: dossier.profile.config.goal.slice(0, 240),
                          body: '',
                        });
                        setAdding(true);
                      }}
                    >
                      Open the first question <ArrowRight size={16} />
                    </Button>
                  )}
                </div>
              )}
              {(data.total > data.page_size || data.offset > 0) && (
                <div className="work-pagination">
                  <Button
                    variant="outline"
                    disabled={waiting || !data.offset}
                    onClick={() => searchQuestions(questionPage(data, -1))}
                  >
                    Previous
                  </Button>
                  <span>
                    {data.items.length
                      ? `${data.offset + 1}–${data.offset + data.items.length} of ${data.total}`
                      : `0 shown · ${data.total} matching questions`}
                  </span>
                  <Button
                    variant="outline"
                    disabled={
                      waiting || data.offset + data.page_size >= data.total
                    }
                    onClick={() => searchQuestions(questionPage(data, 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="thread-toolbar">
            <Button variant="ghost" onClick={returnToQuestions}>
              <ArrowLeft size={16} />
              All questions
            </Button>
            <span
              className={
                selected.accepted_entry_id
                  ? 'thread-state answered'
                  : 'thread-state'
              }
            >
              {selected.accepted_entry_id
                ? 'Working answer accepted'
                : 'Open question'}
            </span>
          </div>
          <article className="thread-question surface">
            <div className="question-byline">
              {selected.author} opened this question ·{' '}
              {date(selected.created_at)}
            </div>
            <h2>{selected.title}</h2>
            <p className="discussion-body">{selected.body}</p>
            <div className="thread-actions">
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() => setPreviewQuestion(selected.id)}
              >
                <Sparkles size={16} />
                Review AI inputs
              </Button>
              <Button
                variant="outline"
                disabled={!canEdit || !!busy}
                onClick={() => prepareFollowup()}
              >
                <ClipboardList size={16} /> Create follow-up
              </Button>
              <Button variant="outline" onClick={() => openDiscovery('')}>
                <Search size={16} />
                Find sources
              </Button>
              <Button
                variant="outline"
                onClick={() => setSavedSearchesOpen(true)}
              >
                <Bookmark size={16} />
                Saved searches
              </Button>
              <Button
                variant="ghost"
                disabled={!canEdit || !!busy}
                onClick={() =>
                  onRefine(
                    `${selected.title}\n${selected.body}\nOpen gaps: ${(selected.accepted?.data.unknowns || selected.replies.findLast((post) => post.kind === 'research')?.data.unknowns || []).join('; ')}`,
                  )
                }
              >
                <RefreshCw size={16} />
                Refine monitoring
              </Button>
            </div>
            <p className="muted">
              AI uses saved page excerpts, current event metadata and team
              contributions from this topic. External discovery is a separate
              search you control.
            </p>
          </article>
          {selected.accepted && (
            <section className="accepted-answer">
              {selected.answer_needs_review && (
                <div className="answer-review">
                  <div>
                    <b>The working answer needs your review</b>
                    <ul className="answer-review-reasons">
                      {selected.answer_review?.reasons?.map((reason) => (
                        <li key={reason.code}>
                          {reason.message}
                          {reason.source_ids.length > 0 && (
                            <span>
                              {' '}
                              Sources: {reason.source_ids.join(', ')}.
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p>
                      Inspect the sources and new material before reconfirming.
                      Your review records the current evidence state; the AI
                      note remains a historical snapshot.
                    </p>
                  </div>
                  <div className="answer-review-actions">
                    <Button
                      variant="outline"
                      disabled={!!busy}
                      onClick={() =>
                        void run('Refreshing answer review', () =>
                          changed(selected.id),
                        )
                      }
                    >
                      <RefreshCw size={15} /> Refresh review
                    </Button>
                    {canEdit && (
                      <Button
                        variant="outline"
                        disabled={
                          !!busy || !selected.answer_review?.fingerprint
                        }
                        onClick={() =>
                          void run('Recording answer review', async () => {
                            await api(
                              `${root}/discussion/${selected.id}/accept`,
                              answerReviewRequest(selected),
                            );
                            await changed(selected.id);
                            notify(
                              'Working answer reconfirmed after your review.',
                            );
                          })
                        }
                      >
                        Reconfirm after review
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="accepted-heading">
                <Check size={18} />
                <h3>Team’s working answer</h3>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!!busy}
                    onClick={() =>
                      void run('Reopening question', async () => {
                        await api(`${root}/discussion/${selected.id}/accept`, {
                          expected_revision: selected.revision,
                          entry_id: null,
                        });
                        await changed(selected.id);
                      })
                    }
                  >
                    Reopen
                  </Button>
                )}
              </div>
              <p className="question-byline">
                {selected.accepted.author} ·{' '}
                {date(selected.accepted.created_at)} · acceptance is a team
                decision
              </p>
              <p className="question-byline">
                Accepted / reviewed{' '}
                {date(selected.accepted_at || selected.accepted.created_at)}
              </p>
              <ResearchPost
                dossierId={dossier.id}
                post={selected.accepted}
                onSearch={openDiscovery}
                onFollowup={canEdit ? prepareFollowup : undefined}
                busy={!!busy}
              />
            </section>
          )}
          <ResearchFollowups
            key={selected.id}
            dossierId={dossier.id}
            threadId={selected.id}
            refreshToken={actionsRefresh}
            busy={!!busy}
            onEdit={setEditingAction}
          />
          <div className="thread-contributions">
            <div className="section-header">
              <h3>{selected.reply_count} contributions</h3>
              <span className="muted">Original sources stay attached</span>
            </div>
            {selected.replies.map((post) => (
              <article className="discussion-post" key={post.id}>
                <div className="post-author">
                  <span>{post.author.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <b>{post.author}</b>
                    <p>{date(post.created_at)}</p>
                  </div>
                  {post.id === selected.accepted_entry_id && (
                    <span className="accepted-marker">
                      <Check size={14} />
                      Working answer
                    </span>
                  )}
                </div>
                <ResearchPost
                  dossierId={dossier.id}
                  post={post}
                  onSearch={openDiscovery}
                  onFollowup={canEdit ? prepareFollowup : undefined}
                  busy={!!busy}
                />
                {canEdit && post.id !== selected.accepted_entry_id && (
                  <div className="post-actions">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() =>
                        void run('Accepting working answer', async () => {
                          await api(
                            `${root}/discussion/${selected.id}/accept`,
                            {
                              expected_revision: selected.revision,
                              entry_id: post.id,
                            },
                          );
                          await changed(selected.id);
                          notify(
                            'Working answer accepted by your team. Reopen it when new evidence changes the picture.',
                          );
                        })
                      }
                    >
                      <Check size={15} />
                      Accept working answer
                    </Button>
                  </div>
                )}
              </article>
            ))}
            {selected.reply_count > 50 && (
              <div className="work-pagination">
                <Button
                  variant="outline"
                  disabled={!postOffset || !!busy}
                  onClick={() =>
                    void run('Loading contributions', () =>
                      open(selected.id, Math.max(0, postOffset - 50)),
                    )
                  }
                >
                  Previous
                </Button>
                <span>
                  {postOffset + 1}–
                  {Math.min(postOffset + 50, selected.reply_count)} of{' '}
                  {selected.reply_count}
                </span>
                <Button
                  variant="outline"
                  disabled={postOffset + 50 >= selected.reply_count || !!busy}
                  onClick={() =>
                    void run('Loading contributions', () =>
                      open(selected.id, postOffset + 50),
                    )
                  }
                >
                  Next
                </Button>
              </div>
            )}
          </div>
          {canContribute ? (
            <form
              className="reply-composer surface"
              onSubmit={(e) => {
                e.preventDefault();
                void run('Adding contribution', async () => {
                  await api(`${root}/discussion/${selected.id}/replies`, {
                    request_key: replyKey,
                    body: reply,
                    source_url: source,
                  });
                  setReply('');
                  setSource('');
                  setReplyKey(uid());
                  await changed(selected.id);
                });
              }}
            >
              <h3>Move the question forward</h3>
              <WorkField label="Your contribution">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Add evidence, a different interpretation, a practical implication or a question the team should explore."
                  rows={5}
                  required
                  minLength={3}
                  maxLength={8000}
                  disabled={!!busy}
                />
              </WorkField>
              <WorkField label="Supporting source URL (optional)">
                <Input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  type="url"
                  placeholder="https://…"
                  maxLength={2000}
                  disabled={!!busy}
                />
              </WorkField>
              <div className="work-form-footer">
                <Button type="submit" disabled={!!busy}>
                  <Send size={16} />
                  Add contribution
                </Button>
              </div>
            </form>
          ) : (
            <p className="banner">
              Your viewer role can read this topic and its sources. Workspace
              administrators contribute and accept working answers.
            </p>
          )}
        </>
      )}
      {previewQuestion && (
        <ResearchPreview
          key={previewQuestion}
          dossierId={dossier.id}
          questionId={previewQuestion}
          canEdit={canEdit}
          onClose={() => setPreviewQuestion(null)}
          onSaved={async () => {
            await changed(previewQuestion);
            notify(
              'AI research note saved. Check its evidence and open questions before accepting.',
            );
          }}
        />
      )}
      <Dialog
        open={adding}
        onOpenChange={(v) => {
          if (!busy) setAdding(v);
        }}
      >
        <DialogContent className="work-dialog">
          <DialogHeader>
            <DialogTitle>Open a research question</DialogTitle>
            <DialogDescription>
              A focused question gives the team a place to collect evidence and
              develop an answer.
            </DialogDescription>
          </DialogHeader>
          <form
            className="work-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run('Opening research question', async () => {
                const result = await api<ThreadDetail>(`${root}/discussion`, {
                  creation_key: questionKey,
                  ...question,
                });
                setAdding(false);
                setQuestion({ title: '', body: '' });
                setQuestionKey(uid());
                await open(result.id);
                await load();
                await reload();
              });
            }}
          >
            <WorkField label="Question">
              <Input
                value={question.title}
                onChange={(e) =>
                  setQuestion({ ...question, title: e.target.value })
                }
                required
                minLength={5}
                maxLength={240}
                disabled={!!busy}
              />
            </WorkField>
            <WorkField label="Context and what a useful answer should establish">
              <Textarea
                value={question.body}
                onChange={(e) =>
                  setQuestion({ ...question, body: e.target.value })
                }
                rows={5}
                maxLength={6000}
                disabled={!!busy}
              />
            </WorkField>
            <div className="work-form-footer">
              <Button type="submit" disabled={!!busy}>
                <Plus size={16} />
                Open question
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {(actionSeed || editingAction) && (
        <ActionDialog
          key={
            editingAction?.id ||
            `${actionSeed?.origin.thread_id}:${actionSeed?.origin.entry_id || ''}:${actionSeed?.origin.gap_index ?? ''}`
          }
          dossierId={dossier.id}
          action={editingAction || undefined}
          research={actionSeed || undefined}
          canEdit={canEdit}
          busy={busy}
          run={run}
          onClose={() => {
            setActionSeed(null);
            setEditingAction(null);
          }}
          onSaved={async () => {
            setActionsRefresh((value) => value + 1);
            await reload();
            notify(
              'Follow-up saved. Its question, responsibility and outcome remain connected.',
            );
          }}
        />
      )}
      <Dialog open={savedSearchesOpen} onOpenChange={setSavedSearchesOpen}>
        <DialogContent className="discovery-dialog">
          <DialogHeader>
            <DialogTitle>Saved searches for this topic</DialogTitle>
            <DialogDescription>
              Queries and their purpose, shared with your team. Review and edit
              before running a fresh search. These queries are not scheduled
              monitors.
            </DialogDescription>
          </DialogHeader>
          {savedSearchesOpen && (
            <SavedSearches
              dossierId={dossier.id}
              onReview={(search) =>
                openDiscovery(search.data.query, search.data)
              }
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={discoveryQuery !== null}
        onOpenChange={(v) => {
          if (!v) setDiscoveryQuery(null);
        }}
      >
        <DialogContent className="discovery-dialog">
          <DialogHeader>
            <DialogTitle>Find evidence for this topic</DialogTitle>
            <DialogDescription>
              Choose where to look. A saved source can become a page watch in
              Evidence & sources.
            </DialogDescription>
          </DialogHeader>
          {discoveryQuery !== null && (
            <Discovery
              canPlan={canEdit}
              key={discoveryQuery}
              initialQuery={discoveryQuery}
              initialRecipe={discoveryRecipe}
              onOpen={(id, thread, source) => {
                if (id === dossier.id && thread && !source) {
                  setDiscoveryQuery(null);
                  void run('Opening question', () => open(thread));
                } else
                  window.location.assign(
                    dossierHref({
                      id,
                      questionId: thread,
                      referenceId: source,
                    }),
                  );
              }}
              onSave={canEdit ? saveSource : undefined}
              onSaveSearch={canEdit ? saveSearch : undefined}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
