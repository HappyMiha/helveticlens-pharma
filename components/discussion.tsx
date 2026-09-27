'use client';

import { dossierHref } from '@/lib/dossier-navigation';
import { sourceImport } from '@/lib/discovery-reference';
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

function safeSource(url: string) {
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function ResearchPost({
  post,
  onSearch,
  onFollowup,
  busy = false,
}: {
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
  const [selected, setSelected] = useState<ThreadDetail | null>(null),
    [failure, setFailure] = useState(''),
    [status, setStatus] = useState('all'),
    [offset, setOffset] = useState(0),
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
  const root = `/products/${product.id}/dossiers/${dossier.id}`;
  const {
    data,
    error: listFailure,
    refresh: load,
  } = useResource<ThreadPage>(
    `${root}/discussion?status=${status}&offset=${offset}`,
  );
  const open = useCallback(
    async (id: string, page = 0) => {
      const thread = await api<ThreadDetail>(
        `${root}/discussion/${id}?offset=${page}`,
      );
      setSelected(thread);
      setPostOffset(page);
      setFailure('');
      window.history.replaceState(
        {},
        '',
        `/?dossier=${dossier.id}&question=${id}`,
      );
    },
    [root, dossier.id],
  );
  useEffect(() => {
    const questionToOpen = new URLSearchParams(window.location.search).get(
      'question',
    );
    if (!questionToOpen) return;
    let live = true;
    void api<ThreadDetail>(`${root}/discussion/${questionToOpen}`)
      .then((thread) => {
        if (live) {
          setSelected(thread);
          setPostOffset(0);
        }
      })
      .catch((e) => {
        if (live) setFailure((e as Error).message);
      });
    return () => {
      live = false;
    };
  }, [initialQuestionId, root]);
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
      {(failure || listFailure) && (
        <div role="alert" className="banner error">
          <span>{failure || listFailure}</span>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw size={16} />
            Retry
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
                disabled={!canEdit || !!busy}
                onClick={() => setAdding(true)}
              >
                <Plus size={16} />
                Ask a question
              </Button>
            </div>
          </div>
          <div className="discussion-filters filters">
            {[
              ['all', 'All questions'],
              ['open', 'Still open'],
              ['answered', 'Working answers'],
            ].map(([value, label]) => (
              <Button
                key={value}
                variant={status === value ? 'secondary' : 'ghost'}
                onClick={() => {
                  setStatus(value);
                  setOffset(0);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
          {!data && !failure && (
            <p className="muted">Loading research questions…</p>
          )}
          {data && (
            <>
              <div className="question-list">
                {data.items.map((thread) => (
                  <button
                    key={thread.id}
                    className="question-row"
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
                    {status === 'all'
                      ? 'What does the team still need to know?'
                      : 'No questions in this view'}
                  </h3>
                  <p>
                    Use questions to develop the topic: what changed, which
                    source supports it, what remains uncertain and what to
                    monitor next.
                  </p>
                  {canEdit && (
                    <Button
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
              {data.total > 30 && (
                <div className="work-pagination">
                  <Button
                    variant="outline"
                    disabled={!offset}
                    onClick={() => setOffset(Math.max(0, offset - 30))}
                  >
                    Previous
                  </Button>
                  <span>
                    {offset + 1}–{Math.min(offset + 30, data.total)} of{' '}
                    {data.total}
                  </span>
                  <Button
                    variant="outline"
                    disabled={offset + 30 >= data.total}
                    onClick={() => setOffset(offset + 30)}
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
            <Button
              variant="ghost"
              onClick={() => {
                setSelected(null);
                setReply('');
                setSource('');
                setReplyKey(uid());
                window.history.replaceState({}, '', `/?dossier=${dossier.id}`);
              }}
            >
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
                    <b>New material or source decisions need review</b>
                    <p>
                      Review the topic’s new contributions, source decisions,
                      snapshots and matching events before relying on the
                      working answer.
                    </p>
                  </div>
                  {canEdit && (
                    <Button
                      variant="outline"
                      disabled={!!busy}
                      onClick={() =>
                        void run('Recording answer review', async () => {
                          await api(
                            `${root}/discussion/${selected.id}/accept`,
                            {
                              expected_revision: selected.revision,
                              entry_id: selected.accepted_entry_id,
                            },
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
          {canEdit ? (
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
