'use client';
import { DossierTeamPanel } from './dossier-team';
import { PublicCopyOrigin } from './public-origin';
import { DossierContributions } from './dossier-contributions';
import { DossierInvestigation } from './investigation';
import { MonitoringResearchPanel } from './monitoring-research';
import { ReferenceLibrary } from '@/components/reference-library';
import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  ClipboardList,
  Printer,
  Check,
  FileText,
  FolderOpen,
  Globe,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Upload,
  Users,
} from 'lucide-react';
import type {
  DossierProps,
  Entry,
  Match,
  NavigationItem,
} from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, date, uid } from '@/lib/api';
import { Empty, Field, ROOT, Status } from './workspace';
import { Discussion } from './discussion';
import { DossierWork } from './dossier-work';
import { ActionDialog } from './action-dialog';
import { PageWatches } from './page-watches';
import { PublicationEditor } from './publication-editor';

export function Dossier({
  dossier: d,
  initialQuestionId,
  initialReferenceId,
  onReferenceChange,
  canEdit,
  userId,
  onSetup,
  busy,
  run,
  onBack,
  reload,
  notify,
}: DossierProps) {
  const p = d.profile,
    c = p.config;
  const canContribute = d.access?.can_contribute ?? canEdit;
  const canMonitor = d.access?.can_monitor ?? canEdit;
  const canConfigure = d.access?.can_configure ?? canEdit;
  const [focusInvestigation, setFocusInvestigation] = useState<
    { id: string; tick: number } | undefined
  >();
  const openInvestigation = (id: string) =>
    setFocusInvestigation((old) => ({ id, tick: (old?.tick || 0) + 1 }));
  const [tab, setTab] = useState(
      initialReferenceId ? 'evidence' : 'discussion',
    ),
    [actionEvidence, setActionEvidence] = useState<Match | null>(null),
    [note, setNote] = useState(''),
    [reference, setReference] = useState({ title: '', url: '', body: '' }),
    [matches, setMatches] = useState<Match[]>([]),
    [matchError, setMatchError] = useState(''),
    [feedback, setFeedback] = useState(''),
    [relevance, setRelevance] = useState('relevant'),
    [refinement, setRefinement] = useState(''),
    [chosen, setChosen] = useState<Record<string, string>>({}),
    [older, setOlder] = useState<Entry[]>([]),
    [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    let active = true;
    api<Match[]>(`${ROOT}/${d.id}/matches`)
      .then((results) => {
        if (active) {
          setMatches(results);
          setMatchError('');
        }
      })
      .catch((e) => {
        if (active) setMatchError(e.message);
      });
    return () => {
      active = false;
    };
  }, [d.id, p.topic_ids, refreshTick]);
  const entries = [
      ...d.entries,
      ...older.filter((x) => !d.entries.some((y) => y.id === x.id)),
    ],
    files = entries.filter((x) => x.kind === 'file'),
    notes = entries.filter((x) => x.kind === 'note'),
    feedbacks = entries.filter((x) => x.kind === 'feedback'),
    proposals = entries.filter((x) => x.kind === 'proposal');
  const sourceUrl = (m: Match) => m.evidence?.source_url || '';
  async function add(
    kind: string,
    body: string,
    values: Record<string, unknown> = {},
  ) {
    await api(`${ROOT}/${d.id}/entries`, {
      request_key: uid(),
      kind,
      body,
      ...values,
    });
    await reload();
  }
  async function refreshed() {
    await reload();
    setRefreshTick((n) => n + 1);
  }
  return (
    <article className="dossier-document">
      <div className="detail-top">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={16} />
          All topics
        </Button>
        <a
          className="download-link"
          href={`/api${ROOT}/${d.id}/brief`}
          target="_blank"
          rel="noreferrer"
        >
          <Printer size={16} />
          Topic brief
        </a>
        <a className="download-link" href={`/api${ROOT}/${d.id}/export`}>
          <ArrowDownToLine size={16} />
          Export dossier
        </a>
      </div>
      <div className="dossier-heading">
        <div>
          <div className="eyebrow">{c.sector}</div>
          <h1>{c.name}</h1>
          <p>{c.goal}</p>
        </div>
        <div className="dossier-actions">
          <Status status={p.status} />
          {p.status === 'draft' ? (
            <Button
              variant="outline"
              disabled={!canConfigure || !!busy}
              onClick={onSetup}
            >
              Monitoring setup
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={!canMonitor || !!busy}
              onClick={() =>
                run('Updating topic monitoring', async () => {
                  await api(`/monitoring-profiles/${p.id}/status`, {
                    expected_revision: p.revision,
                    status: p.status === 'active' ? 'paused' : 'active',
                  });
                  await refreshed();
                  notify(
                    'Topic monitoring updated. Shared source collection and document page watches keep their separate settings.',
                  );
                })
              }
            >
              {p.status === 'active' ? <Pause size={16} /> : <Play size={16} />}{' '}
              {p.status === 'active' ? 'Pause topics' : 'Resume topics'}
            </Button>
          )}
        </div>
      </div>
      <div className="dossier-byline">
        <span>
          <Users size={14} />
          {p.status === 'draft'
            ? d.access?.audience === 'invited_team'
              ? 'Private draft · invited dossier team'
              : 'Private draft · creator only'
            : d.access?.audience === 'team'
              ? 'Private monitoring · invited dossier team'
              : 'Shared with your organization'}
        </span>
        <span>
          <Globe size={14} />
          {c.requested_jurisdictions || 'Switzerland'}
        </span>
        <span>Created {date(p.created_at)}</span>
      </div>
      <DossierTeamPanel
        dossierId={d.id}
        access={d.access}
        onChanged={reload}
        onLeave={onBack}
      />
      <PublicCopyOrigin origin={d.public_origin} />
      <DossierContributions
        dossierId={d.id}
        entries={entries}
        canEdit={canContribute}
        onOpen={openInvestigation}
        onSaved={async () => {
          await reload();
        }}
      />
      <DossierInvestigation
        key={`${d.id}:${userId || ''}`}
        dossierId={d.id}
        title={c.name}
        focusRequest={focusInvestigation}
        onOpen={openInvestigation}
        canEdit={canEdit}
        canContribute={canContribute}
        userId={userId}
      />
      <MonitoringResearchPanel
        key={`${d.id}:${userId || ''}`}
        dossierId={d.id}
        onOpen={openInvestigation}
      />
      <details
        className="dossier-tools"
        open={initialQuestionId || initialReferenceId ? true : undefined}
      >
        <summary>Discussion, monitoring & dossier tools</summary>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(String(v))}
          className="dossier-tabs"
        >
          <TabsList variant="line">
            {(
              [
                ['discussion', 'Questions & discussion', MessageSquare],
                ['overview', 'Monitoring', FolderOpen],
                ['work', 'Actions & reviews', ClipboardList],
                ['evidence', 'Evidence & sources', Globe],
                ['notes', `Notes · ${notes.length}`, MessageSquare],
                ['files', `Files · ${files.length}`, FileText],
                ['learning', 'Improve monitoring', Sparkles],
                ['publication', 'Public version', Globe],
              ] as NavigationItem[]
            ).map(([value, label, Icon]) => (
              <TabsTrigger value={value} key={value}>
                <Icon size={16} />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="discussion">
            <Discussion
              dossier={d}
              initialQuestionId={initialQuestionId}
              canEdit={canEdit}
              busy={busy}
              run={run}
              reload={refreshed}
              notify={notify}
              onRefine={(question) => {
                setRefinement(question);
                setTab('learning');
              }}
            />
          </TabsContent>
          <TabsContent value="work">
            <DossierWork
              key={`${d.id}:${d.work.revision}`}
              dossier={d}
              entries={entries}
              canEdit={canEdit}
              busy={busy}
              run={run}
              reload={refreshed}
              notify={notify}
            />
          </TabsContent>
          <TabsContent value="publication">
            <PublicationEditor
              key={d.id}
              dossierId={d.id}
              canEdit={d.access?.can_publish ?? canEdit}
            />
          </TabsContent>
          <TabsContent value="overview">
            <div className="detail-columns">
              <section>
                <div className="section-header">
                  <h2>Monitoring scope</h2>
                  <span className="tag">{p.topics?.length || 0} topics</span>
                </div>
                {p.topics?.map((t) => (
                  <article key={t.id} className="scope-topic">
                    <div>
                      <h3>{t.plan.name}</h3>
                      <span className="tag">Revision {t.current_revision}</span>
                    </div>
                    <p>{t.plan.goal}</p>
                    <div className="chips">
                      {t.plan.concepts.map((k: string) => (
                        <span key={k}>{k}</span>
                      ))}
                    </div>
                    <details>
                      <summary>Revision history</summary>
                      {t.revisions?.map((r) => (
                        <p key={r.revision}>
                          <b>Revision {r.revision}</b> · {date(r.created_at)} ·{' '}
                          {r.concepts.join(', ')}
                        </p>
                      ))}
                    </details>
                  </article>
                ))}
                <div className="section-header spaced">
                  <h2>Recent evidence</h2>
                  <Button variant="ghost" onClick={() => setTab('evidence')}>
                    View all <ArrowRight size={15} />
                  </Button>
                </div>
                {matchError ? (
                  <div className="banner error">
                    {matchError}
                    <Button
                      variant="outline"
                      onClick={() => setRefreshTick((n) => n + 1)}
                    >
                      Retry
                    </Button>
                  </div>
                ) : matches.length ? (
                  <div className="evidence-list">
                    {matches.slice(0, 5).map((m) => (
                      <Evidence
                        key={m.id}
                        item={m}
                        onAction={
                          canEdit && m.is_current
                            ? () => setActionEvidence(m)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <Empty title="Waiting for matching evidence" icon={Globe}>
                    Source collection and topic matching run in the background.
                    No saved match means no match has been reported yet; it does
                    not establish that no change occurred.
                  </Empty>
                )}
              </section>
              <aside>
                <section className="surface delivery-card">
                  <Bell size={21} />
                  <h3>Delivery</h3>
                  <p>In-app dossier and your personal organization digest.</p>
                  <span className="tag">
                    {c.delivery === 'keep'
                      ? 'Existing email settings'
                      : c.delivery === 'off'
                        ? 'Email turned off at setup'
                        : c.delivery + ' at setup'}
                  </span>
                  <p className="muted">
                    Delivery choices shown here record the setup. Manage current
                    email settings in the platform.
                  </p>
                  <a
                    className="source-link"
                    href="https://helveticlens.ch/digests"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open digest settings
                    <ArrowUpRight size={15} />
                  </a>
                </section>
                <section className="surface activity-card">
                  <h3>Activity</h3>
                  {entries.slice(0, 8).map((e) => (
                    <div key={e.id} className="activity-entry">
                      <span className="timeline-dot" />
                      <div>
                        <b>
                          {e.title ||
                            (
                              {
                                note: 'Comment added',
                                reference: 'Source added',
                                file: 'File attached',
                                feedback: 'Relevance reviewed',
                                source_review: 'Source decision recorded',
                                proposal: 'AI refinement proposed',
                                improvement: 'Monitoring refined',
                                monitor: 'Page watch connected',
                              } as Record<string, string>
                            )[e.kind]}
                        </b>
                        <small>
                          {e.author} · {date(e.created_at)}
                        </small>
                      </div>
                    </div>
                  ))}
                  {!entries.length && (
                    <p className="muted">
                      Notes, source connections and improvements will appear
                      here.
                    </p>
                  )}
                </section>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="evidence">
            <ReferenceLibrary
              key={d.id}
              dossier={d}
              initialReferenceId={initialReferenceId}
              onReferenceChange={onReferenceChange}
              canEdit={canEdit}
              busy={busy}
              run={run}
              reload={reload}
              notify={notify}
            />

            <div className="section-header">
              <div>
                <h2>Primary-source evidence</h2>
                <p className="muted">
                  Up to 100 saved matches per topic. Each match retains its
                  original source and matching reasons.
                </p>
              </div>
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() => run('Refreshing evidence', refreshed)}
              >
                <RefreshCw size={16} />
                Refresh
              </Button>
            </div>
            {matchError && <div className="banner error">{matchError}</div>}
            {matches.length > 0 && (
              <div className="evidence-list">
                {matches.map((m) => (
                  <div key={m.id}>
                    <Evidence
                      item={m}
                      onAction={
                        canEdit && m.is_current
                          ? () => setActionEvidence(m)
                          : undefined
                      }
                    />
                    {canEdit && (
                      <div className="evidence-feedback">
                        <Button
                          variant="ghost"
                          disabled={!!busy}
                          onClick={() =>
                            run('Saving relevance feedback', async () => {
                              await add(
                                'feedback',
                                `Useful match: ${m.evidence?.title || m.event_id}`,
                                { url: sourceUrl(m), relevance: 'relevant' },
                              );
                              notify(
                                'Relevance feedback saved for the next refinement.',
                              );
                            })
                          }
                        >
                          <ThumbsUp size={14} />
                          Relevant
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={!!busy}
                          onClick={() =>
                            run('Saving relevance feedback', async () => {
                              await add(
                                'feedback',
                                `Not relevant: ${m.evidence?.title || m.event_id}`,
                                {
                                  url: sourceUrl(m),
                                  relevance: 'not_relevant',
                                },
                              );
                              notify(
                                'Feedback saved. Explain what to exclude in Improve monitoring.',
                              );
                            })
                          }
                        >
                          <ThumbsDown size={14} />
                          Not relevant
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {d.access?.audience === 'team' && (
              <p className="source-meta">
                Monitoring topics and research remain private to your team. Page
                watches use the shared workspace library and cannot be added
                from this private dossier. Source references stay available for
                research.
              </p>
            )}
            <PageWatches
              dossierId={d.id}
              documents={d.documents}
              canEdit={
                d.access?.can_watch_pages ??
                (d.access?.audience !== 'team' && canMonitor)
              }
              busy={busy}
              run={run}
              reload={refreshed}
              notify={notify}
            />
            {canEdit && (
              <form
                className="surface spaced"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run('Saving source reference', async () => {
                    await add('reference', reference.body, {
                      title: reference.title,
                      url: reference.url,
                    });
                    setReference({ title: '', url: '', body: '' });
                  });
                }}
              >
                <h3>Add a primary source</h3>
                <div className="field-pair">
                  <Field label="Source name">
                    <Input
                      required
                      maxLength={240}
                      value={reference.title}
                      onChange={(e) =>
                        setReference({ ...reference, title: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Original HTTPS URL">
                    <Input
                      type="url"
                      required
                      value={reference.url}
                      onChange={(e) =>
                        setReference({ ...reference, url: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <Field label="Why this source matters">
                  <Textarea
                    rows={2}
                    value={reference.body}
                    onChange={(e) =>
                      setReference({ ...reference, body: e.target.value })
                    }
                  />
                </Field>
                <Button type="submit" disabled={!!busy}>
                  <Plus size={16} />
                  Save reference
                </Button>
                <p className="muted">
                  {d.access?.audience === 'team'
                    ? 'Saving a reference adds private context for dossier research.'
                    : 'Saving a reference adds context. Connect its page watch separately to start automatic checks.'}
                </p>
              </form>
            )}
          </TabsContent>
          <TabsContent value="notes">
            <div className="narrow-content">
              <h2>Team notes</h2>
              <p className="muted">
                Keep questions, decisions and follow-up work with the evidence
                they refer to.
              </p>
              {canEdit && (
                <form
                  className="note-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run('Saving comment', async () => {
                      await add('note', note);
                      setNote('');
                    });
                  }}
                >
                  <Field label="Your comment">
                    <Textarea
                      rows={4}
                      required
                      maxLength={10000}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="What should the team know or review next?"
                    />
                  </Field>
                  <Button type="submit" disabled={!note.trim() || !!busy}>
                    <MessageSquare size={16} />
                    Add comment
                  </Button>
                </form>
              )}
              {notes.map((e) => (
                <article className="note" key={e.id}>
                  <div className="note-header">
                    <span className="avatar">
                      {e.author.slice(0, 2).toUpperCase()}
                    </span>
                    <b>{e.author}</b>
                    <time>{date(e.created_at)}</time>
                  </div>
                  {e.title && <h3>{e.title}</h3>}
                  <p>{e.body}</p>
                  {e.url && (
                    <a
                      className="source-link"
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Primary source <ArrowUpRight size={15} />
                    </a>
                  )}
                </article>
              ))}
              {!notes.length && (
                <Empty
                  title="Keep the conversation with the evidence"
                  icon={MessageSquare}
                >
                  Add a first observation, decision or question for your
                  colleagues.
                </Empty>
              )}
            </div>
          </TabsContent>
          <TabsContent value="files">
            <div className="section-header">
              <div>
                <h2>Dossier files</h2>
                <p className="muted">
                  Private attachments, up to 10 MB each. Files retain their
                  upload time, author and SHA-256 fingerprint.
                </p>
              </div>
            </div>
            {canEdit && (
              <div className="upload-zone">
                <Upload size={30} />
                <h3>Attach evidence or working documents</h3>
                <p>
                  Save-only attachment. For automatic analysis, use Add &
                  analyse above. Maximum 50 files per dossier.
                </p>
                <input
                  aria-label="Upload a dossier file"
                  type="file"
                  disabled={!!busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void run('Uploading attachment', async () => {
                      if (file.size > 10 * 1024 * 1024)
                        throw new Error('Choose a file of at most 10 MB.');
                      const form = new FormData();
                      form.append('file', file);
                      await api(`${ROOT}/${d.id}/files`, form);
                      await reload();
                      notify('File saved to the dossier.');
                    });
                    e.target.value = '';
                  }}
                />
              </div>
            )}
            <div className="files-list">
              {files.map((f) => (
                <article key={f.id}>
                  <span className="file-icon">
                    <FileText size={25} />
                  </span>
                  <div>
                    <h3>{f.title}</h3>
                    <p>
                      {(f.byte_size / 1024).toFixed(1)} KB · {f.author} ·{' '}
                      {date(f.created_at)}
                    </p>
                    <details>
                      <summary>Integrity fingerprint</summary>
                      <code>{f.sha256}</code>
                    </details>
                  </div>
                  <a
                    className="download-link"
                    href={`/api${ROOT}/${d.id}/files/${f.id}`}
                  >
                    <ArrowDownToLine size={18} />
                    Download
                  </a>
                </article>
              ))}
            </div>
            {!files.length && (
              <Empty title="No files attached yet" icon={FileText}>
                Attach supporting documents to keep the dossier complete.
              </Empty>
            )}
          </TabsContent>
          <TabsContent value="learning">
            <div className="detail-columns">
              <section>
                <div className="section-header">
                  <h2>Teach the monitoring what matters.</h2>
                </div>
                <p className="muted">
                  Saved relevance decisions and your notes inform the next AI
                  proposal. Changes take effect only after an administrator
                  reviews and applies them.
                </p>
                {canEdit && (
                  <form
                    className="surface"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run('Saving relevance feedback', async () => {
                        await add('feedback', feedback, { relevance });
                        setFeedback('');
                        notify('Feedback saved to this dossier.');
                      });
                    }}
                  >
                    <Field label="Your relevance decision">
                      <NativeSelect
                        value={relevance}
                        onChange={(e) => setRelevance(e.target.value)}
                      >
                        <NativeSelectOption value="relevant">
                          Relevant — find more like this
                        </NativeSelectOption>
                        <NativeSelectOption value="not_relevant">
                          Not relevant — narrow the scope
                        </NativeSelectOption>
                        <NativeSelectOption value="uncertain">
                          Needs review
                        </NativeSelectOption>
                      </NativeSelect>
                    </Field>
                    <Field label="Explain what to include or exclude">
                      <Textarea
                        required
                        rows={3}
                        value={feedback}
                        maxLength={10000}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="e.g. Prioritise changes that affect our Swiss authorisation; exclude commercial announcements."
                      />
                    </Field>
                    <Button type="submit" disabled={!!busy || !feedback.trim()}>
                      Save feedback
                    </Button>
                  </form>
                )}
                {feedbacks.map((f) => (
                  <article className="feedback-entry" key={f.id}>
                    <span className="tag">
                      {(f.data.relevance || 'uncertain').replaceAll('_', ' ')}
                    </span>
                    <p>{f.body}</p>
                    <small>
                      {f.author} · {date(f.created_at)}
                    </small>
                  </article>
                ))}
              </section>
              <aside>
                <section className="surface refinement-card">
                  <Sparkles size={25} />
                  <h3>Refine the next search.</h3>
                  <p>
                    AI considers the current topics and the latest 20 relevance
                    notes. The complete review history remains in your dossier.
                  </p>
                  <Field label="Additional direction">
                    <Textarea
                      rows={3}
                      value={refinement}
                      maxLength={2000}
                      onChange={(e) => setRefinement(e.target.value)}
                      placeholder="Make the scope more specific…"
                    />
                  </Field>
                  <Button
                    disabled={!canConfigure || !!busy}
                    onClick={() =>
                      run('Preparing an AI refinement', async () => {
                        await api(`${ROOT}/${d.id}/improve`, {
                          expected_revision: p.revision,
                          feedback: refinement,
                        });
                        await reload();
                        notify(
                          'AI proposal saved. Review it below before applying.',
                        );
                      })
                    }
                  >
                    <Sparkles size={16} />
                    Suggest improvement
                  </Button>
                  <a
                    href="https://helveticlens.ch/settings"
                    target="_blank"
                    rel="noreferrer"
                    className="source-link"
                  >
                    Configure AI provider <ArrowUpRight size={14} />
                  </a>
                </section>
              </aside>
            </div>
            {proposals.map((proposal) => (
              <section className="proposal surface spaced" key={proposal.id}>
                <div className="section-header">
                  <h3>Proposed refinement</h3>
                  <span className="tag">
                    {proposal.data.provider} · {proposal.data.model}
                  </span>
                </div>
                <p className="muted">
                  {date(proposal.created_at)} · Based on{' '}
                  {(proposal.data.feedback_ids || []).length} relevance notes
                </p>
                {(proposal.data.topics || []).map((s, i) => {
                  const key = `${proposal.id}:${i}`,
                    topicId = chosen[key] || p.topic_ids[0],
                    topic = p.topics.find((t) => t.id === topicId),
                    applied = entries.find(
                      (e) =>
                        e.kind === 'improvement' &&
                        e.data.proposal_id === proposal.id &&
                        e.data.topic_id === topicId,
                    ),
                    stale =
                      topic?.current_revision !==
                      proposal.data.topic_revisions?.[topicId];
                  return (
                    <div className="proposal-option" key={i}>
                      <h3>{s.name}</h3>
                      <p>{s.description}</p>
                      <div className="chips">
                        {s.keywords.map((k: string) => (
                          <span key={k}>{k}</span>
                        ))}
                      </div>
                      <div className="proposal-apply">
                        <Field label="Topic to refine">
                          <NativeSelect
                            value={topicId}
                            onChange={(e) =>
                              setChosen({ ...chosen, [key]: e.target.value })
                            }
                          >
                            {p.topics.map((t) => (
                              <NativeSelectOption key={t.id} value={t.id}>
                                {t.plan.name}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </Field>
                        <Button
                          variant="outline"
                          disabled={!canMonitor || !!busy || !!applied || stale}
                          onClick={() =>
                            run(
                              'Applying reviewed monitoring refinement',
                              async () => {
                                if (!topic)
                                  throw new Error('Choose a monitoring topic.');
                                await api(
                                  `${ROOT}/${d.id}/improvements/apply`,
                                  {
                                    proposal_id: proposal.id,
                                    topic_id: topicId,
                                    suggestion: i,
                                    expected_revision: topic.current_revision,
                                  },
                                );
                                await refreshed();
                                notify(
                                  'Monitoring refined. A native topic revision and review record have been saved.',
                                );
                              },
                            )
                          }
                        >
                          {applied ? (
                            <Check size={16} />
                          ) : (
                            <Sparkles size={16} />
                          )}{' '}
                          {applied
                            ? 'Applied'
                            : stale
                              ? 'Request a fresh proposal'
                              : 'Apply reviewed change'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
          </TabsContent>
        </Tabs>
      </details>
      {actionEvidence && (
        <ActionDialog
          dossierId={d.id}
          evidence={actionEvidence}
          canEdit={canEdit}
          busy={busy}
          run={run}
          onClose={() => setActionEvidence(null)}
          onSaved={async () => {
            await refreshed();
            notify('Action saved with its evidence snapshot and source.');
          }}
        />
      )}
      {tab !== 'evidence' && d.entry_count > entries.length && (
        <div className="load-history">
          <p>
            Showing {entries.length} of {d.entry_count} dossier entries.
          </p>
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() =>
              run('Loading older dossier history', async () => {
                const result = await api<Entry[]>(
                  `${ROOT}/${d.id}/entries?offset=${entries.length}`,
                );
                setOlder([...older, ...result]);
              })
            }
          >
            Load older history
          </Button>
        </div>
      )}
    </article>
  );
}
function Evidence({
  item: m,
  onAction,
}: {
  item: Match;
  onAction?: () => void;
}) {
  const e = m.evidence || {},
    url = e.source_url;
  return (
    <article className="evidence-item">
      <span className="evidence-symbol">
        <FileText size={20} />
      </span>
      <div>
        <div className="evidence-type">
          {e.authority || e.event_kind || 'Primary-source event'}
          <span className="tag">
            {m.is_current
              ? 'Current match'
              : (m.validity || 'Review needed').replaceAll('_', ' ')}
          </span>
        </div>
        <h3>
          {e.title || e.work_title || e.event_title || 'Saved regulatory event'}
        </h3>
        {e.summary && <p>{e.summary}</p>}
        <p className="muted">Matched {date(m.matched_at)}</p>
        {url && (
          <a
            className="source-link"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            Read primary source <ArrowUpRight size={15} />
          </a>
        )}
        <details>
          <summary>Why this appeared</summary>
          <ul>
            {m.reasons?.map((reason, i) => (
              <li key={i}>
                {reason.type.replaceAll('_', ' ')}
                {reason.value ? `: ${reason.value}` : ''}
                {reason.values?.length ? `: ${reason.values.join(', ')}` : ''}
                {reason.tokens?.length ? `: ${reason.tokens.join(', ')}` : ''}
              </li>
            ))}
          </ul>
        </details>
        {onAction && (
          <Button variant="outline" size="sm" onClick={onAction}>
            <ClipboardList size={15} />
            Create follow-up action
          </Button>
        )}
      </div>
    </article>
  );
}
