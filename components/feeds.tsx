'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, RefreshCw, Rss } from 'lucide-react';
import { api, date } from '@/lib/api';
import { useFeedCommand } from '@/lib/use-feed-command';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import {
  feedDossierHref,
  feedHref,
  feedSourceHref,
  feedSources,
  feedUpdateDate,
  type DossierFeedList,
  type Feed,
  type FeedDossier,
  type FeedCheckHistory,
  type FeedFollow,
  type FeedHistory,
  type FeedLink,
  type FeedList,
  type FeedProduct,
  type FeedSource,
} from '@/lib/feeds';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { NativeSelect, NativeSelectOption } from './ui/native-select';
import { Field } from './field';
import {
  FeedPrecision,
  FeedRelevance,
  FeedDossierContext,
  FeedWatchProposal,
} from './feed-intelligence';

function ReadFailure({
  error,
  retry,
  busy = false,
}: {
  error: string;
  retry: () => void;
  busy?: boolean;
}) {
  return (
    <div role="alert" className="banner error">
      <p>{error}</p>
      <Button variant="outline" disabled={busy} onClick={retry}>
        Retry loading
      </Button>
    </div>
  );
}
function CommandStatus({
  action,
}: {
  action: { error: string; saved: boolean };
}) {
  return action.error ? (
    <p role="alert" className="banner error">
      {action.error}
    </p>
  ) : null;
}
function FeedHealth({ feed }: { feed: Feed }) {
  return (
    <div className="space-y-2">
      <p>
        <span className="tag">
          {feed.status === 'active' ? 'Monitoring active' : 'Monitoring paused'}
        </span>{' '}
        <span className="muted">
          {feed.product === 'pharma' ? 'Pharma' : 'Legal'}
        </span>
      </p>
      {feed.follow?.following && feed.unread_count > 0 && (
        <p className="tag">{feed.unread_count} unread source updates</p>
      )}
      <p className="muted">
        Last check: {date(feed.checked_at)}
        {feed.next_check_at && feed.status === 'active'
          ? ` · Next check: ${date(feed.next_check_at)}`
          : ''}
      </p>
      {feed.job && ['queued', 'running'].includes(feed.job.status) && (
        <output>
          Source check {feed.job.status === 'queued' ? 'queued' : 'in progress'}
          . Saved updates remain available.
        </output>
      )}
      {feed.error && (
        <output className="banner error">Latest check: {feed.error}</output>
      )}
    </div>
  );
}

export function FeedForm({
  catalog,
  initial,
  initialQuery = '',
  initialName = '',
  dossierId,
  dossierQuestion = '',
  disabled = false,
  onSaved,
  onCancel,
}: {
  catalog: FeedSource[];
  initial?: Feed;
  initialQuery?: string;
  initialName?: string;
  dossierId?: string;
  dossierQuestion?: string;
  disabled?: boolean;
  onSaved: (value: Feed | FeedLink) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [query, setQuery] = useState(initial?.query || initialQuery);
  const [researchQuestion, setResearchQuestion] = useState(dossierQuestion);
  const invalidQuestion =
    !!dossierId &&
    (researchQuestion.trim().length < 5 ||
      researchQuestion.trim().length > 300);
  const [name, setName] = useState(initial?.name || initialName);
  const [selected, setSelected] = useState<string[]>(
    initial?.sources.filter((source) => !source.startsWith('https://')) || [],
  );
  const [urls, setUrls] = useState(
    initial?.sources
      .filter((source) => source.startsWith('https://'))
      .join('\n') || '',
  );
  const [validation, setValidation] = useState('');
  const action = useFeedCommand<Feed | FeedLink>(onSaved);
  const domain = initial?.product || product.id;
  const locked = disabled || action.locked;
  let unchanged = false;
  if (initial) {
    try {
      unchanged =
        (name.trim() || query.trim().slice(0, 120)) === initial.name.trim() &&
        query.trim() === initial.query.trim() &&
        JSON.stringify([...feedSources(selected, urls)].sort()) ===
          JSON.stringify([...initial.sources].sort());
    } catch {
      /* Invalid sources stay editable and surface on submit. */
    }
  }
  function submit() {
    if (
      disabled ||
      action.busy ||
      (!action.locked && unchanged) ||
      query.trim().length < 5 ||
      query.trim().length > 300 ||
      invalidQuestion
    )
      return;
    try {
      const sources = feedSources(selected, urls);
      setValidation('');
      const body = {
        name: name.trim() || query.trim().slice(0, 120),
        query: query.trim(),
        sources,
        status: initial?.status || 'active',
        ...(initial
          ? { expected_revision: initial.revision }
          : dossierId
            ? { question: researchQuestion.trim() }
            : { product: domain }),
      };
      void action.execute(
        initial
          ? `/feeds/${initial.id}`
          : dossierId
            ? `/products/${product.id}/dossiers/${dossierId}/feeds/create`
            : '/feeds',
        body,
        initial ? 'PATCH' : 'POST',
      );
    } catch (cause) {
      setValidation(
        cause instanceof Error ? cause.message : 'Check the sources.',
      );
    }
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Field label="What should this feed watch?">
        <Textarea
          required
          minLength={5}
          maxLength={300}
          rows={3}
          value={query}
          disabled={locked}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Describe the changes you want to follow."
        />
      </Field>
      <details>
        <summary>Name and sources · optional</summary>
        <div className="space-y-4 pt-4">
          <Field label="Feed name">
            <Input
              maxLength={160}
              value={name}
              disabled={locked}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <fieldset disabled={locked} className="space-y-2">
            <legend>Source collections</legend>
            {catalog
              .filter(
                (item) =>
                  !item.products.length ||
                  item.products.includes(domain) ||
                  selected.includes(item.id),
              )
              .map((source) => (
                <label className="flex items-start gap-3" key={source.id}>
                  <Checkbox
                    checked={selected.includes(source.id)}
                    disabled={locked}
                    onCheckedChange={(checked) =>
                      setSelected((old) =>
                        checked
                          ? [...old, source.id]
                          : old.filter((id) => id !== source.id),
                      )
                    }
                  />{' '}
                  <span>{source.label}</span>
                </label>
              ))}
          </fieldset>
          <Field
            label="Other public source URLs"
            hint="One HTTPS URL per line. Access depends on the publisher."
          >
            <Textarea
              rows={2}
              value={urls}
              disabled={locked}
              onChange={(event) => setUrls(event.target.value)}
            />
          </Field>
        </div>
      </details>
      {dossierId && (
        <LinkedQuestion
          value={researchQuestion}
          disabled={locked}
          onChange={setResearchQuestion}
        />
      )}
      <p className="muted">
        This question is used to find public information. The feed saves source
        updates; a dossier researches what they mean.{' '}
        {dossierId
          ? 'Creating it also links all retained updates to this dossier.'
          : 'You can link this feed to a dossier later.'}
      </p>
      {validation && <p role="alert">{validation}</p>}
      <CommandStatus action={action} />
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={
            disabled ||
            action.busy ||
            (!action.locked && unchanged) ||
            query.trim().length < 5 ||
            query.trim().length > 300 ||
            invalidQuestion
          }
        >
          {action.busy
            ? 'Saving…'
            : action.saved
              ? 'Refresh saved feed'
              : action.uncertain
                ? 'Retry the same save'
                : initial
                  ? 'Save feed settings'
                  : dossierId
                    ? 'Watch changes'
                    : 'Watch'}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            disabled={action.locked}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function LinkedQuestion({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const valid = value.trim().length >= 5 && value.trim().length <= 300;
  const [editing, setEditing] = useState(!valid);
  return (
    <section className="space-y-2">
      {valid && <p className="muted">For this dossier: {value}</p>}
      <details
        open={editing || !valid}
        onToggle={(event) => setEditing(event.currentTarget.open)}
      >
        <summary>
          {valid ? 'Change dossier question' : 'Add a public research question'}
        </summary>
        <div className="pt-3">
          <Field
            label="What should this dossier research?"
            hint="Use 5–300 characters."
          >
            <Textarea
              value={value}
              required
              minLength={5}
              maxLength={300}
              rows={2}
              disabled={disabled}
              onChange={(event) => onChange(event.target.value)}
            />
          </Field>
        </div>
      </details>
      <p className="muted">
        New updates continue research for this question. The question may be
        sent to public research providers.
      </p>
    </section>
  );
}

function FeedHistoryReader({
  feedId,
  revision,
  follow,
  onSeen,
  feedRevision,
  canManage,
}: {
  feedRevision: number;
  canManage: boolean;
  feedId: string;
  revision: number;
  follow?: FeedFollow;
  onSeen: () => Promise<void>;
}) {
  const markSeen = useFeedCommand<FeedFollow>(onSeen);
  const [view, setView] = useState<'main' | 'unrelated' | 'all'>('main');
  const history = useResource<FeedHistory>(
    `/feeds/${feedId}/updates?order=newest&view=${view}&limit=50`,
    revision,
  );
  const [extra, setExtra] = useState<FeedHistory | null>(null);
  const [failure, setFailure] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef({ value: 0 });
  const activeRequest = useRef(false);
  useEffect(() => {
    const life = generation.current;
    const clear = () => {
      life.value++;
      activeRequest.current = false;
      setExtra(null);
      setFailure('');
      setLoadingMore(false);
    };
    clear();
    window.addEventListener('helvetic-session-changed', clear);
    return () => {
      life.value++;
      window.removeEventListener('helvetic-session-changed', clear);
    };
  }, [feedId, revision, view]);
  const rows = history.data
    ? [
        ...history.data.items,
        ...(extra?.items || []).filter(
          (item) => !history.data?.items.some((first) => first.id === item.id),
        ),
      ]
    : [];
  const next = extra ? extra.next_sequence : history.data?.next_sequence;
  const shownSequence = rows.reduce(
    (highest, item) => Math.max(highest, item.sequence),
    0,
  );
  async function more() {
    if (activeRequest.current || !history.data || next == null) return;
    activeRequest.current = true;
    setLoadingMore(true);
    setFailure('');
    const attempt = generation.current.value;
    try {
      const page = await api<FeedHistory>(
        `/feeds/${feedId}/updates?order=newest&view=${view}&before_sequence=${next}&limit=50`,
      );
      if (attempt !== generation.current.value) return;
      setExtra((old) => ({
        ...page,
        items: [
          ...(old?.items || []),
          ...page.items.filter(
            (item) => !old?.items.some((known) => known.id === item.id),
          ),
        ],
      }));
    } catch (cause) {
      if (attempt === generation.current.value) {
        setFailure(
          cause instanceof Error
            ? cause.message
            : 'Could not load more history.',
        );
        await history.refresh();
      }
    } finally {
      if (attempt === generation.current.value) {
        activeRequest.current = false;
        setLoadingMore(false);
      }
    }
  }
  return (
    <section className="space-y-4" aria-label="Saved feed history">
      <div className="section-header">
        <h2>Saved source history</h2>
        <Button
          variant="outline"
          disabled={history.refreshing || loadingMore}
          onClick={() => {
            setExtra(null);
            setFailure('');
            void history.refresh();
          }}
        >
          <RefreshCw size={16} /> Refresh history
        </Button>
      </div>
      <div
        className="flex gap-2 overflow-x-auto whitespace-nowrap"
        aria-label="Source history view"
      >
        {(
          [
            ['main', 'Updates'],
            ['unrelated', 'Other saved sources'],
            ['all', 'All history'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            variant={view === value ? 'secondary' : 'ghost'}
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="muted">
        Updates include uncertain or pending relevance checks. Other sources
        stay in the archive; a dossier can still research the full retained
        history.
      </p>
      {history.loading && <output>Loading saved updates…</output>}
      {history.error && (
        <ReadFailure
          error={history.error}
          retry={() => void history.refresh()}
          busy={history.refreshing}
        />
      )}
      {history.data && (
        <>
          <p className="muted">
            {rows.length} of {history.data.total} saved updates in this view ·
            newest first. Source previews are not research conclusions.
          </p>
          {!rows.length && (
            <p>
              No saved source updates in this view yet. Check the full history
              or wait for the next source check.
            </p>
          )}
          {rows.map((item) => (
            <article
              className="border-t border-border py-5 space-y-3"
              key={item.id}
            >
              <h3>{item.title}</h3>
              <p className="muted">{feedUpdateDate(item)}</p>
              <p>{item.summary}</p>
              <FeedRelevance
                key={`${item.id}:${item.feedback || 'unlabelled'}`}
                item={item}
                feedId={feedId}
                feedRevision={feedRevision}
                canManage={canManage}
                onChanged={onSeen}
              />
              <p className="muted">
                {item.reading_complete
                  ? 'Source reading recorded as complete.'
                  : 'Source reading is incomplete; this preview may not represent the whole document.'}
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="source-link break-url"
                >
                  Publisher source
                </a>
                <a
                  href={feedSourceHref(item, feedId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read saved source
                </a>
              </div>
            </article>
          ))}
          {follow?.following && shownSequence > follow.seen_sequence && (
            <div className="space-y-2">
              <Button
                variant="outline"
                disabled={markSeen.busy}
                onClick={() =>
                  void markSeen.execute(
                    `/feeds/${feedId}/follow/read`,
                    {
                      expected_revision: follow.revision,
                      through_sequence: shownSequence,
                    },
                    'POST',
                    false,
                  )
                }
              >
                {markSeen.busy
                  ? 'Marking updates read…'
                  : markSeen.uncertain
                    ? 'Retry marking updates read'
                    : 'Mark updates as read'}
              </Button>
              <p className="muted">
                Marks the newest displayed update and earlier history as read;
                later arrivals stay unread.
              </p>
            </div>
          )}
          <CommandStatus action={markSeen} />
          {failure && <p role="alert">{failure}</p>}
          {next != null && (
            <Button
              variant="outline"
              disabled={loadingMore || history.refreshing}
              onClick={() => void more()}
            >
              {loadingMore
                ? 'Loading history…'
                : failure
                  ? 'Retry loading more history'
                  : 'Load older updates'}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function FeedChecks({ feed }: { feed: Feed }) {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const checks = useResource<FeedCheckHistory>(
    open ? `/feeds/${feed.id}/checks?offset=${offset}` : null,
    Date.parse(feed.checked_at || '') || 0,
  );
  return (
    <details
      className="dossier-secondary"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Source check history</summary>
      <div className="space-y-4 pt-4">
        <p className="muted">
          Saved collection results show which sources were checked and where
          gaps remain. Use “Check sources now” to retry collection.
        </p>
        {checks.loading && <output>Loading saved checks…</output>}
        {checks.error && (
          <ReadFailure
            error={checks.error}
            retry={() => void checks.refresh()}
            busy={checks.refreshing}
          />
        )}
        {checks.data && (
          <>
            {!checks.data.items.length && <p>No source checks recorded yet.</p>}
            {checks.data.items.map((check) => (
              <article
                className="border-t border-border py-3 space-y-2"
                key={check.id}
              >
                <h3>Source check · {check.status}</h3>
                <p className="muted">{date(check.created_at)}</p>
                <p>
                  {check.progress.captured} new or changed sources saved ·{' '}
                  {check.progress.unchanged} unchanged
                </p>
                {check.progress.plan_status && (
                  <p className="muted">
                    Search preparation: {check.progress.plan_status}
                    {check.progress.query_count
                      ? ` · ${check.progress.query_index || 0} of ${check.progress.query_count} search directions checked`
                      : ''}
                  </p>
                )}
                {check.progress.semantic_counts && (
                  <p className="muted">
                    Relevance checks: {check.progress.semantic_counts.relevant}{' '}
                    likely relevant · {check.progress.semantic_counts.uncertain}{' '}
                    uncertain · {check.progress.semantic_counts.unrelated}{' '}
                    outside focus · {check.progress.semantic_counts.unavailable}{' '}
                    could not be assessed
                  </p>
                )}
                {check.progress.worker_error && (
                  <p role="alert">
                    Collection interrupted:{' '}
                    {check.progress.worker_error.replaceAll('_', ' ')}. Saved
                    source history remains available.
                  </p>
                )}
                {!!check.progress.coverage.length && (
                  <ul className="space-y-2">
                    {check.progress.coverage.map((source, index) => (
                      <li className="break-words" key={index}>
                        {source.name ||
                          source.url ||
                          source.kind ||
                          'Source collection'}{' '}
                        · {source.status || 'Recorded'}
                        {source.omitted_records
                          ? ` · ${source.omitted_records} records not collected`
                          : ''}
                        {source.query && <p>{source.query}</p>}
                        {(source.language || source.purpose) && (
                          <p className="muted">
                            {[source.language, source.purpose]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {!!check.progress.failures.length && (
                  <div>
                    <h4>Collection gaps</h4>
                    <ul className="space-y-2">
                      {check.progress.failures.map((failure, index) => (
                        <li className="break-words" key={index}>
                          {failure.phase === 'read'
                            ? 'Source reading'
                            : failure.phase === 'plan'
                              ? 'Search preparation'
                              : failure.phase === 'gate'
                                ? 'Relevance check'
                                : 'Source discovery'}
                          :{' '}
                          {(failure.code || 'unavailable').replaceAll('_', ' ')}
                          {failure.url ? ` · ${failure.url}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}
            <div className="flex flex-wrap gap-3">
              {offset > 0 && (
                <Button
                  variant="outline"
                  onClick={() =>
                    setOffset(Math.max(0, offset - checks.data!.page_size))
                  }
                >
                  Newer checks
                </Button>
              )}
              {offset + checks.data.items.length < checks.data.total && (
                <Button
                  variant="outline"
                  onClick={() => setOffset(offset + checks.data!.page_size)}
                >
                  Older checks
                </Button>
              )}
              <Button
                variant="ghost"
                disabled={checks.refreshing}
                onClick={() => void checks.refresh()}
              >
                Refresh checks
              </Button>
            </div>
          </>
        )}
      </div>
    </details>
  );
}

function FeedResearch({
  feed,
  onCreated,
}: {
  feed: Feed;
  onCreated: (result: FeedDossier) => Promise<void> | void;
}) {
  const [question, setQuestion] = useState(feed.query);
  const [domain, setDomain] = useState<FeedProduct>(product.id);
  const action = useFeedCommand<FeedDossier>(onCreated);
  return (
    <details className="dossier-secondary">
      <summary>Research deeper</summary>
      <form
        className="space-y-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (feed.can_manage && !action.busy && question.trim().length >= 5)
            void action.execute(`/feeds/${feed.id}/dossiers`, {
              expected_revision: feed.revision,
              product: domain,
              question: question.trim(),
            });
        }}
      >
        <Field label="What do you want to understand?">
          <Textarea
            value={question}
            minLength={5}
            maxLength={300}
            required
            disabled={action.locked}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </Field>
        <details>
          <summary>
            Dossier destination · {domain === 'legal' ? 'Legal' : 'Pharma'}
          </summary>
          <div className="pt-3">
            <Field label="Dossier">
              <NativeSelect
                value={domain}
                disabled={action.locked}
                onChange={(event) =>
                  setDomain(event.target.value as FeedProduct)
                }
              >
                <NativeSelectOption value="legal">Legal</NativeSelectOption>
                <NativeSelectOption value="pharma">Pharma</NativeSelectOption>
              </NativeSelect>
            </Field>
          </div>
        </details>
        <p className="muted">
          All retained feed history is linked, including updates beyond this
          page. The dossier reads eligible sources and researches your question;
          new feed updates remain linked. Your question may be sent to public
          research providers. This uses one dossier from your account allowance.
        </p>
        <CommandStatus action={action} />
        <Button
          disabled={
            !feed.can_manage || action.busy || question.trim().length < 5
          }
        >
          {action.busy
            ? 'Creating dossier…'
            : action.saved
              ? 'Open saved dossier'
              : action.uncertain
                ? 'Retry the same research request'
                : 'Research deeper'}
        </Button>
      </form>
    </details>
  );
}

function FeedFollowing({
  feed,
  onChanged,
}: {
  feed: Feed;
  onChanged: () => Promise<void>;
}) {
  const action = useFeedCommand<FeedFollow>(onChanged);
  if (!feed.follow) return null;
  return (
    <section aria-label="In-app feed updates" className="space-y-2">
      <Button
        variant="outline"
        aria-pressed={feed.follow.following}
        disabled={action.busy}
        onClick={() =>
          void action.execute(
            `/feeds/${feed.id}/follow`,
            {
              expected_revision: feed.follow.revision,
              following: !feed.follow.following,
            },
            'POST',
            false,
          )
        }
      >
        {action.uncertain
          ? 'Retry notification change'
          : feed.follow.following
            ? 'In-app updates on'
            : 'In-app updates off'}
      </Button>
      <p className="muted">
        New saved source updates appear in this workspace when in-app updates
        are on.
      </p>
      <CommandStatus action={action} />
    </section>
  );
}

function FeedReader({
  id,
  catalog,
  onBack,
  onCreated,
}: {
  id: string;
  catalog: FeedSource[];
  onBack: () => void;
  onCreated: (value: FeedDossier) => Promise<void> | void;
}) {
  const resource = useResource<Feed>(`/feeds/${encodeURIComponent(id)}`);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const action = useFeedCommand<Feed>(async () => {
    setNotice('Feed change saved.');
    await resource.refresh();
  });
  const feed = resource.data;
  const jobStatus = feed?.job?.status;
  const poll = resource.poll;
  useEffect(() => {
    if (!jobStatus || !['queued', 'running'].includes(jobStatus)) return;
    const timer = setInterval(() => void poll(), 10000);
    return () => clearInterval(timer);
  }, [jobStatus, poll]);
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={16} /> All feeds
        </Button>
        <Button
          variant="outline"
          disabled={resource.refreshing || action.busy}
          onClick={() => void resource.refresh()}
        >
          <RefreshCw size={16} /> Refresh feed
        </Button>
      </div>
      {resource.loading && <output>Loading feed…</output>}
      {resource.error && (
        <ReadFailure
          error={resource.error}
          retry={() => void resource.refresh()}
          busy={resource.refreshing}
        />
      )}
      {feed && (
        <>
          <div>
            <p className="eyebrow">Shared platform · your feed</p>
            <h1>{feed.name}</h1>
            <p>{feed.query}</p>
          </div>
          <FeedHealth feed={feed} />
          <FeedFollowing feed={feed} onChanged={resource.refresh} />
          {notice && <output>{notice}</output>}
          <CommandStatus action={action} />
          {feed.can_manage && (
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={
                  action.busy ||
                  resource.refreshing ||
                  (action.locked && !action.error)
                }
                onClick={() =>
                  void action.execute(`/feeds/${feed.id}/check`, {
                    expected_revision: feed.revision,
                  })
                }
              >
                {action.uncertain
                  ? 'Retry the same request'
                  : action.saved
                    ? 'Refresh saved change'
                    : 'Check sources now'}
              </Button>
              <Button
                variant="outline"
                disabled={action.locked || resource.refreshing}
                onClick={() =>
                  void action.execute(
                    `/feeds/${feed.id}`,
                    {
                      expected_revision: feed.revision,
                      name: feed.name,
                      query: feed.query,
                      sources: feed.sources,
                      status: feed.status === 'active' ? 'paused' : 'active',
                    },
                    'PATCH',
                  )
                }
              >
                {feed.status === 'active' ? 'Pause feed' : 'Resume feed'}
              </Button>
              <Button
                variant="ghost"
                disabled={action.locked || resource.refreshing}
                onClick={() => setEditing((old) => !old)}
              >
                Edit feed
              </Button>
            </div>
          )}
          <FeedPrecision
            key={`precision:${feed.id}:${feed.revision}`}
            feed={feed}
            onChanged={resource.refresh}
          />
          <FeedChecks feed={feed} />
          {editing && feed.can_manage && (
            <FeedForm
              key={`${feed.id}:${feed.revision}`}
              catalog={catalog}
              initial={feed}
              onCancel={() => setEditing(false)}
              onSaved={async () => {
                setEditing(false);
                setNotice('Feed settings saved.');
                await resource.refresh();
              }}
            />
          )}
          {feed.can_manage && (
            <FeedResearch
              key={`research:${feed.id}`}
              feed={feed}
              onCreated={onCreated}
            />
          )}
          <FeedHistoryReader
            key={`history:${feed.id}`}
            feedId={feed.id}
            revision={feed.update_count + feed.revision}
            feedRevision={feed.revision}
            canManage={feed.can_manage}
            follow={feed.follow}
            onSeen={resource.refresh}
          />
        </>
      )}
    </section>
  );
}

export function FeedsWorkspace({
  selectedId,
  onSelect,
  onCreated,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreated: (value: FeedDossier) => Promise<void> | void;
}) {
  const library = useResource<FeedList>('/feeds');
  const [creating, setCreating] = useState(false);
  const [offset, setOffset] = useState(0);
  const page = useResource<FeedList>(offset ? `/feeds?offset=${offset}` : null);
  const data = offset ? page.data : library.data;
  const error = offset ? page.error : library.error;
  if (selectedId)
    return (
      <FeedReader
        key={selectedId}
        id={selectedId}
        catalog={library.data?.sources || []}
        onBack={() => {
          onSelect(null);
          void library.refresh();
        }}
        onCreated={onCreated}
      />
    );
  return (
    <section className="space-y-6" aria-label="Feeds">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Helvetic Lens · Legal & Pharma</p>
          <h1>Follow what changes.</h1>
          <p className="lead">
            Feeds collect relevant source updates. Link them to dossiers when
            you want to investigate what those changes mean.
          </p>
        </div>
      </div>
      {(library.loading || (offset > 0 && page.loading)) && (
        <output>Loading your feeds…</output>
      )}
      {error && (
        <ReadFailure
          error={error}
          retry={() => void (offset ? page.refresh() : library.refresh())}
        />
      )}
      {data && (
        <>
          {data.can_create && !creating && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} /> New feed
            </Button>
          )}
          {creating && data.can_create && (
            <section className="rounded-xl border border-border p-5">
              <h2>Create a feed</h2>
              <FeedForm
                catalog={data.sources}
                onCancel={() => setCreating(false)}
                onSaved={(value) => {
                  onSelect(value.id);
                  setCreating(false);
                  void library.refresh();
                }}
              />
            </section>
          )}
          {!data.total && (
            <p>
              No feeds yet. Start with a question about the changes you want to
              follow.
            </p>
          )}
          <div className="space-y-4">
            {data.items.map((feed) => (
              <article
                key={feed.id}
                className="rounded-xl border border-border p-5 space-y-3"
              >
                <h2>
                  <Button
                    className="h-auto whitespace-normal text-left text-lg"
                    variant="link"
                    onClick={() => onSelect(feed.id)}
                  >
                    <Rss size={16} /> {feed.name}
                  </Button>
                </h2>
                <p>{feed.query}</p>
                <FeedHealth feed={feed} />
                <p className="muted">
                  {feed.update_count} saved source updates
                </p>
              </article>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {offset > 0 && (
              <Button
                variant="outline"
                onClick={() => setOffset(Math.max(0, offset - data.page_size))}
              >
                Previous feeds
              </Button>
            )}
            {offset + data.items.length < data.total && (
              <Button
                variant="outline"
                onClick={() => setOffset(offset + data.page_size)}
              >
                More feeds
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => void (offset ? page.refresh() : library.refresh())}
            >
              <RefreshCw size={16} /> Refresh feeds
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

export function DossierFeeds({
  dossierId,
  question,
  canEdit,
  onChanged,
  onResearch,
}: {
  dossierId: string;
  name: string;
  question: string;
  canEdit: boolean;
  onChanged: () => Promise<void>;
  onResearch: (id: string) => void;
}) {
  const root = `/products/${product.id}/dossiers/${dossierId}/feeds`;
  const links = useResource<DossierFeedList>(root);
  const [proposalLocked, setProposalLocked] = useState(false);
  const [choice, setMode] = useState<'attach' | 'create' | null>(null);
  const mode =
    choice ||
    (links.data && !links.data.items.some((link) => link.status === 'active')
      ? 'create'
      : null);
  const [researchQuestion, setResearchQuestion] = useState(question);
  const validQuestion =
    researchQuestion.trim().length >= 5 &&
    researchQuestion.trim().length <= 300;
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const libraryPath = `/feeds${mode === 'attach' && search ? `?q=${encodeURIComponent(search)}` : ''}`;
  const library = useResource<FeedList>(
    canEdit && links.data?.can_manage && mode ? libraryPath : null,
  );
  const [selected, setSelected] = useState('');
  const [offset, setOffset] = useState(0);
  const extra = useResource<FeedList>(
    mode === 'attach' && offset
      ? `/feeds?offset=${offset}${search ? `&q=${encodeURIComponent(search)}` : ''}`
      : null,
  );
  const list = offset ? extra : library;
  const [notice, setNotice] = useState('');
  const action = useFeedCommand<FeedLink>(async () => {
    await Promise.all([links.refresh(), onChanged()]);
    setMode(null);
    setNotice(
      'Feed link saved. Saved updates are queued for dossier processing.',
    );
  });
  const selectedFeed = list.data?.items.find((feed) => feed.id === selected);
  const available = (list.data?.items || []).filter(
    (feed) =>
      !links.data?.items.some(
        (link) => link.feed_id === feed.id && link.status === 'active',
      ),
  );
  const canManage = canEdit && !!links.data?.can_manage;
  return (
    <section
      id="dossier-linked-feeds"
      className="dossier-secondary space-y-4 scroll-mt-28"
      aria-label="Linked feeds"
    >
      <div className="section-header">
        <div>
          <h2>Linked feeds</h2>
          <p className="muted">
            Feeds bring source updates into this dossier. Dossier monitoring and
            impact research keep their own status.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => void links.refresh()}
          disabled={links.refreshing}
        >
          <RefreshCw size={16} /> Refresh links
        </Button>
      </div>
      {links.loading && <output>Loading linked feeds…</output>}
      {links.error && (
        <ReadFailure
          error={links.error}
          retry={() => void links.refresh()}
          busy={links.refreshing}
        />
      )}
      {links.data && (
        <>
          {!links.data.items.length && (
            <p>No feeds linked. Your dossier’s own monitoring is unchanged.</p>
          )}
          {links.data.items.map((link) => (
            <LinkedFeed
              key={link.id}
              link={link}
              root={root}
              canManage={canManage}
              onChanged={async () => {
                await Promise.all([links.refresh(), onChanged()]);
              }}
              onResearch={onResearch}
            />
          ))}
          {notice && <output>{notice}</output>}
          <CommandStatus action={action} />
          {canManage && (
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={action.locked || proposalLocked}
                onClick={() => {
                  setMode('attach');
                  setOffset(0);
                  setSelected('');
                }}
              >
                Link existing feed
              </Button>
              {mode !== 'create' && (
                <Button
                  variant="outline"
                  disabled={action.locked || proposalLocked}
                  onClick={() => {
                    setMode('create');
                    setOffset(0);
                  }}
                >
                  Watch another question
                </Button>
              )}
            </div>
          )}
          {mode && canManage && (
            <>
              {(library.loading || (mode === 'attach' && list.loading)) && (
                <output>Loading available feeds and sources…</output>
              )}
              {(library.error || list.error) && (
                <ReadFailure
                  error={library.error || list.error}
                  retry={() => {
                    void library.refresh();
                    if (offset) void extra.refresh();
                  }}
                />
              )}
              {library.data &&
                !library.data.can_create &&
                mode === 'create' && (
                  <p>
                    Creating feeds requires a workspace administrator. You can
                    still link a feed you already own.
                  </p>
                )}
              {library.data &&
                !library.error &&
                mode === 'create' &&
                library.data.can_create && (
                  <FeedWatchProposal
                    key={dossierId}
                    root={root}
                    onLockChange={setProposalLocked}
                    onSaved={async () => {
                      await Promise.all([links.refresh(), onChanged()]);
                      setMode(null);
                      setNotice('Monitoring enabled for this dossier.');
                    }}
                  />
                )}
              {mode === 'attach' && (
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (action.locked) return;
                    setOffset(0);
                    setSelected('');
                    setSearch(searchDraft.trim());
                  }}
                >
                  <Field
                    label="Search your feeds"
                    hint="Search names and monitoring questions across your feed library."
                  >
                    <Input
                      maxLength={300}
                      value={searchDraft}
                      disabled={action.locked || proposalLocked}
                      onChange={(event) => setSearchDraft(event.target.value)}
                    />
                  </Field>
                  <Button
                    variant="outline"
                    disabled={action.locked || proposalLocked}
                  >
                    Search feeds
                  </Button>
                </form>
              )}
              {mode === 'attach' && list.data && !list.error && (
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (
                      canManage &&
                      selectedFeed &&
                      !action.busy &&
                      validQuestion
                    )
                      void action.execute(root, {
                        feed_id: selectedFeed.id,
                        expected_feed_revision: selectedFeed.revision,
                        question: researchQuestion.trim(),
                      });
                  }}
                >
                  <Field label="Choose a feed">
                    <NativeSelect
                      value={selected}
                      disabled={action.locked || proposalLocked}
                      onChange={(event) => setSelected(event.target.value)}
                    >
                      <NativeSelectOption value="">
                        Choose a saved feed
                      </NativeSelectOption>
                      {available.map((feed) => (
                        <NativeSelectOption key={feed.id} value={feed.id}>
                          {feed.name} · {feed.product}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  {selectedFeed && <p>{selectedFeed.query}</p>}
                  {!available.length && (
                    <p>
                      No unlinked feeds match this page. Search again or create
                      a feed from this dossier.
                    </p>
                  )}
                  <p className="muted">
                    All saved feed history and future updates are linked.
                    Dossier members may read imported source material. Feed
                    settings remain with its owner.
                  </p>
                  <LinkedQuestion
                    value={researchQuestion}
                    disabled={action.locked || proposalLocked}
                    onChange={setResearchQuestion}
                  />
                  <Button
                    disabled={action.busy || !selectedFeed || !validQuestion}
                  >
                    {action.busy
                      ? 'Linking…'
                      : action.saved
                        ? 'Refresh saved link'
                        : action.uncertain
                          ? 'Retry the same link'
                          : 'Watch changes'}
                  </Button>
                  {!action.locked && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setMode(null)}
                    >
                      Cancel
                    </Button>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {offset > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={action.locked || proposalLocked}
                        onClick={() => {
                          setSelected('');
                          setOffset(Math.max(0, offset - list.data!.page_size));
                        }}
                      >
                        Previous feeds
                      </Button>
                    )}
                    {offset + list.data.items.length < list.data.total && (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={action.locked || proposalLocked}
                        onClick={() => {
                          setSelected('');
                          setOffset(offset + list.data!.page_size);
                        }}
                      >
                        More feeds
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
function LinkedFeed({
  link,
  root,
  canManage,
  onChanged,
  onResearch,
}: {
  link: FeedLink;
  root: string;
  canManage: boolean;
  onChanged: () => Promise<void>;
  onResearch: (id: string) => void;
}) {
  const action = useFeedCommand<FeedLink>(onChanged);
  return (
    <article className="border-t border-border py-4 space-y-2">
      <h3>{link.feed.name}</h3>
      <p className="muted">
        Feed {link.feed.status} · Link {link.status}
      </p>
      <p>
        {link.pending_count
          ? `${link.pending_count} saved updates awaiting dossier processing.`
          : 'No saved updates are waiting for dossier processing.'}
      </p>
      {link.investigation && (
        <p>
          Dossier impact research: {link.investigation.status}.{' '}
          <Button
            variant="link"
            onClick={() => onResearch(link.investigation!.id)}
          >
            Open impact research
          </Button>
        </p>
      )}
      {canManage && (
        <div className="flex flex-wrap gap-3">
          {link.can_open_feed && (
            <a href={feedHref(link.feed_id)}>Open standalone feed</a>
          )}
          {link.can_retry &&
            link.investigation &&
            ['paused', 'failed', 'cancelled'].includes(
              link.investigation.status,
            ) &&
            link.status === 'active' && (
              <Button
                variant="outline"
                disabled={action.locked}
                onClick={() =>
                  void action.execute(`${root}/${link.id}/retry`, {
                    expected_revision: link.revision,
                    investigation_id: link.investigation!.id,
                    expected_investigation_revision:
                      link.investigation!.revision,
                  })
                }
              >
                {link.investigation.status === 'paused'
                  ? 'Resume research'
                  : 'Retry research'}
              </Button>
            )}
          {(action.uncertain || action.saved) && (
            <Button
              variant="outline"
              disabled={action.busy}
              onClick={() => void action.retry()}
            >
              {action.saved
                ? 'Refresh saved link'
                : 'Retry the same feed action'}
            </Button>
          )}
          {link.status === 'active' && (
            <Button
              variant="ghost"
              disabled={action.locked}
              onClick={() =>
                void action.execute(
                  `${root}/${link.id}?expected_revision=${link.revision}`,
                  undefined,
                  'DELETE',
                )
              }
            >
              Unlink feed
            </Button>
          )}
        </div>
      )}
      {link.can_learn && (
        <FeedDossierContext
          root={root}
          linkId={link.id}
          onChanged={onChanged}
        />
      )}
      <CommandStatus action={action} />
    </article>
  );
}
export { feedDossierHref };
