'use client';

import { useEffect, useState } from 'react';
import { useResource } from '@/lib/use-resource';
import { useFeedCommand } from '@/lib/use-feed-command';
import {
  feedPrecisionLines,
  feedSources,
  type FeedLink,
  type FeedWatchProposal as WatchProposal,
  type Feed,
  type FeedContextPreview,
  type FeedUpdate,
} from '@/lib/feeds';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Field } from './field';

function CommandError({ error }: { error: string }) {
  return error ? (
    <p role="alert" className="banner error">
      {error}
    </p>
  ) : null;
}

export function FeedPrecision({
  feed,
  onChanged,
}: {
  feed: Feed;
  onChanged: () => Promise<void>;
}) {
  const profile = feed.intelligence;
  const [include, setInclude] = useState((profile?.include || []).join('\n'));
  const [exclude, setExclude] = useState((profile?.exclude || []).join('\n'));
  const [validation, setValidation] = useState('');
  const [notice, setNotice] = useState('');
  const action = useFeedCommand<Feed>(async () => {
    setNotice('Search refined. New checks will use your changes.');
    await onChanged();
  });
  if (!profile || !feed.can_manage) return null;
  let unchanged = false;
  try {
    unchanged =
      JSON.stringify(feedPrecisionLines(include)) ===
        JSON.stringify(profile.include) &&
      JSON.stringify(feedPrecisionLines(exclude)) ===
        JSON.stringify(profile.exclude);
  } catch {
    /* Show actionable validation on submit. */
  }
  return (
    <details className="dossier-secondary">
      <summary>Refine search</summary>
      <form
        className="space-y-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (action.busy || (unchanged && !action.locked)) return;
          try {
            const body = {
              expected_revision: feed.revision,
              include: feedPrecisionLines(include),
              exclude: feedPrecisionLines(exclude),
              languages: profile.languages,
            };
            setValidation('');
            void action.execute(
              `/feeds/${feed.id}/intelligence`,
              body,
              'PATCH',
            );
          } catch (cause) {
            setValidation(
              cause instanceof Error
                ? cause.message
                : 'Check your search refinements.',
            );
          }
        }}
      >
        <p className="muted">
          Describe what belongs in this feed and what does not. These
          instructions guide future public searches and relevance checks.
        </p>
        <Field label="Focus on" hint="Optional. One idea per line.">
          <Textarea
            rows={3}
            value={include}
            disabled={action.locked}
            onChange={(event) => setInclude(event.target.value)}
          />
        </Field>
        <Field label="Leave out" hint="Optional. One idea per line.">
          <Textarea
            rows={2}
            value={exclude}
            disabled={action.locked}
            onChange={(event) => setExclude(event.target.value)}
          />
        </Field>
        {profile.understanding && (
          <p className="muted">
            Current understanding: {profile.understanding}
          </p>
        )}
        {!!profile.queries.length && (
          <details>
            <summary>Current search directions</summary>
            <ul className="space-y-3 pt-3">
              {profile.queries.map((direction, index) => (
                <li key={index}>
                  <p>{direction.query}</p>
                  <p className="muted">
                    {direction.language}
                    {direction.purpose ? ` · ${direction.purpose}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        )}
        {profile.plan_status === 'pending' && (
          <p className="muted">Search preparation is pending.</p>
        )}
        {profile.plan_status === 'unavailable' && (
          <p className="muted">
            Search preparation could not be completed. Saved sources remain
            available.
          </p>
        )}
        {validation && <p role="alert">{validation}</p>}
        {notice && <output>{notice}</output>}
        <CommandError error={action.error} />
        <Button disabled={action.busy || (unchanged && !action.locked)}>
          {action.busy
            ? 'Saving…'
            : action.saved
              ? 'Refresh saved refinement'
              : action.uncertain
                ? 'Retry the same refinement'
                : 'Refine search'}
        </Button>
      </form>
    </details>
  );
}

export function FeedRelevance({
  item,
  feedId,
  feedRevision,
  canManage,
  onChanged,
}: {
  item: FeedUpdate;
  feedId: string;
  feedRevision: number;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const [savedChoice, setSavedChoice] = useState<
    'relevant' | 'not_relevant' | null
  >(null);
  const action = useFeedCommand<Feed>(async (_feed, command) => {
    setSavedChoice(
      (command.body as { verdict: 'relevant' | 'not_relevant' }).verdict,
    );
    await onChanged();
  });
  const verdict = savedChoice || item.feedback;
  const assessment = item.relevance?.verdict || 'pending';
  const label =
    assessment === 'relevant'
      ? 'Likely relevant'
      : assessment === 'unrelated'
        ? 'Outside this feed’s focus'
        : assessment === 'uncertain'
          ? 'Relevance uncertain'
          : assessment === 'unavailable'
            ? 'Relevance could not be assessed'
            : 'Relevance check pending';
  return (
    <div className="space-y-2">
      <p className="muted">
        {label}. Relevance is not a verification of the source’s claims.
      </p>
      {canManage && (
        <>
          <div
            className="flex flex-wrap gap-2"
            aria-label="Help refine this feed"
          >
            {(['relevant', 'not_relevant'] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={verdict === value ? 'secondary' : 'ghost'}
                aria-pressed={verdict === value}
                disabled={action.locked || verdict === value}
                onClick={() => {
                  void action.execute(
                    `/feeds/${feedId}/updates/${item.id}/feedback`,
                    { expected_revision: feedRevision, verdict: value },
                  );
                }}
              >
                {value === 'relevant' ? 'Relevant' : 'Not relevant'}
              </Button>
            ))}
            {(action.uncertain || action.saved) && (
              <Button
                variant="outline"
                size="sm"
                disabled={action.busy}
                onClick={() => void action.retry()}
              >
                {action.saved
                  ? 'Refresh saved feedback'
                  : 'Retry the same feedback'}
              </Button>
            )}
          </div>
          {savedChoice && (
            <output>Feedback saved. Future searches will use it.</output>
          )}
          <CommandError error={action.error} />
        </>
      )}
    </div>
  );
}

export function FeedDossierContext({
  root,
  linkId,
  onChanged,
}: {
  root: string;
  linkId: string;
  onChanged: () => Promise<void>;
}) {
  const [show, setShow] = useState(false);
  const [applied, setApplied] = useState(false);
  const preview = useResource<FeedContextPreview>(
    show ? `${root}/${linkId}/learn` : null,
  );
  const action = useFeedCommand<Feed>(async () => {
    setApplied(true);
    await onChanged();
  });
  return (
    <section className="space-y-3">
      {!show && (
        <Button variant="outline" onClick={() => setShow(true)}>
          Use dossier context
        </Button>
      )}
      {show && (
        <div className="rounded-xl border border-border p-4 space-y-4">
          <h3>Review what this feed will use</h3>
          {preview.loading && <output>Loading public research context…</output>}
          {preview.error && (
            <div role="alert">
              <p>{preview.error}</p>
              <Button
                variant="outline"
                disabled={preview.refreshing || action.locked}
                onClick={() => void preview.refresh()}
              >
                Refresh context
              </Button>
            </div>
          )}
          {preview.data && (
            <>
              <p>{preview.data.question}</p>
              {!!preview.data.findings.length && (
                <div className="space-y-3">
                  <h4>Findings from public sources</h4>
                  {preview.data.findings.map((finding, index) => (
                    <div
                      key={`${finding.source_id}:${index}`}
                      className="space-y-2"
                    >
                      <p>{finding.statement}</p>
                      {/^https?:\/\//i.test(finding.url) && (
                        <a href={finding.url} target="_blank" rel="noreferrer">
                          Public source
                        </a>
                      )}
                      {finding.quote && (
                        <details>
                          <summary>Source passage</summary>
                          <blockquote>{finding.quote}</blockquote>
                          {finding.locator && (
                            <p className="muted">{finding.locator}</p>
                          )}
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!!preview.data.gaps.length && (
                <div>
                  <h4>Open questions</h4>
                  <ul className="space-y-2">
                    {preview.data.gaps.map((gap, index) => (
                      <li key={index}>{gap}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="muted">{preview.data.scope}</p>
              <p className="muted">
                This context will guide future public searches and relevance
                checks.
              </p>
              {!applied && (
                <Button
                  disabled={action.busy || preview.refreshing}
                  onClick={() =>
                    void action.execute(`${root}/${linkId}/learn`, {
                      expected_feed_revision: preview.data!.feed_revision,
                      expected_link_revision: preview.data!.link_revision,
                      context_fingerprint: preview.data!.context_fingerprint,
                    })
                  }
                >
                  {action.busy
                    ? 'Saving…'
                    : action.uncertain
                      ? 'Retry the same context'
                      : 'Use this context'}
                </Button>
              )}
              {applied && <output>Dossier context saved for this feed.</output>}
              {action.saved && (
                <Button
                  variant="outline"
                  disabled={action.busy}
                  onClick={() => void action.retry()}
                >
                  Refresh saved context
                </Button>
              )}
            </>
          )}
          <CommandError error={action.error} />
          <div className="flex flex-wrap gap-3">
            {preview.data && (
              <Button
                variant="ghost"
                disabled={preview.refreshing || action.locked}
                onClick={() => {
                  setApplied(false);
                  void preview.refresh();
                }}
              >
                Refresh context
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={action.locked}
              onClick={() => setShow(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Read-only proposal first; one explicit action creates, links and pins its public context. */
export function FeedWatchProposal({
  root,
  onSaved,
  onLockChange,
}: {
  root: string;
  onSaved: (link: FeedLink) => Promise<void>;
  onLockChange?: (locked: boolean) => void;
}) {
  const preview = useResource<WatchProposal>(`${root}/proposal`);
  return (
    <section
      className="rounded-xl border border-border p-4 space-y-4"
      aria-label="Suggested monitoring"
    >
      <h3>Watch changes to this research</h3>
      {preview.loading && (
        <output>Preparing your monitoring suggestion…</output>
      )}
      {preview.error && (
        <div role="alert">
          <p>{preview.error}</p>
          <Button
            variant="outline"
            disabled={preview.refreshing}
            onClick={() => void preview.refresh()}
          >
            Refresh suggestion
          </Button>
        </div>
      )}
      {preview.data && (
        <WatchProposalForm
          key={preview.data.proposal_fingerprint}
          root={root}
          proposal={preview.data}
          refreshing={preview.refreshing}
          refresh={preview.refresh}
          onSaved={onSaved}
          onLockChange={onLockChange}
        />
      )}
    </section>
  );
}

function WatchProposalForm({
  root,
  proposal,
  refreshing,
  refresh,
  onSaved,
  onLockChange,
}: {
  root: string;
  proposal: WatchProposal;
  refreshing: boolean;
  refresh: () => Promise<void>;
  onSaved: (link: FeedLink) => Promise<void>;
  onLockChange?: (locked: boolean) => void;
}) {
  const [name, setName] = useState(proposal.name);
  const [query, setQuery] = useState(proposal.query);
  const [urls, setUrls] = useState('');
  const [validation, setValidation] = useState('');
  const action = useFeedCommand<FeedLink>(onSaved);
  useEffect(() => {
    onLockChange?.(action.locked);
    return () => onLockChange?.(false);
  }, [action.locked, onLockChange]);
  const valid =
    name.trim().length <= 160 &&
    query.trim().length >= 5 &&
    query.trim().length <= 300;
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (action.busy || refreshing || !valid) return;
        try {
          const sources = feedSources([], urls);
          setValidation('');
          void action.execute(`${root}/create`, {
            name: name.trim() || query.trim().slice(0, 160),
            query: query.trim(),
            question:
              proposal.question.trim().length >= 5 &&
              proposal.question.trim().length <= 300
                ? proposal.question.trim()
                : query.trim(),
            sources,
            status: 'active',
            proposal_fingerprint: proposal.proposal_fingerprint,
          });
        } catch (cause) {
          setValidation(
            cause instanceof Error ? cause.message : 'Check the source URLs.',
          );
        }
      }}
    >
      <p>{query}</p>
      <p className="muted">
        {proposal.basis === 'public_research'
          ? 'Based on the public findings and open questions in this dossier.'
          : 'Starting from your question. There are no completed public research findings to include yet.'}
      </p>
      {(proposal.findings.length > 0 || proposal.gaps.length > 0) && (
        <details className="dossier-secondary">
          <summary>Research context for this feed</summary>
          <div className="space-y-4 pt-4">
            {proposal.findings.map((finding, index) => (
              <div key={index} className="space-y-2">
                <p>{finding.statement}</p>
                {/^https?:\/\//i.test(finding.url) && (
                  <a href={finding.url} target="_blank" rel="noreferrer">
                    Public source
                  </a>
                )}
                {finding.quote && (
                  <details>
                    <summary>Source passage</summary>
                    <blockquote>{finding.quote}</blockquote>
                    {finding.locator && (
                      <p className="muted">{finding.locator}</p>
                    )}
                  </details>
                )}
              </div>
            ))}
            {!!proposal.gaps.length && (
              <div>
                <h4>Open questions</h4>
                <ul>
                  {proposal.gaps.map((gap, index) => (
                    <li key={index}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}
      <details className="dossier-secondary" open={!valid || undefined}>
        <summary>Adjust what to watch</summary>
        <div className="space-y-4 pt-4">
          <Field
            label="What changes should we watch?"
            hint="This question is used for public searches."
          >
            <Textarea
              rows={3}
              maxLength={300}
              value={query}
              disabled={action.locked}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>
          <Field label="Feed name">
            <Input
              maxLength={160}
              value={name}
              disabled={action.locked}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field
            label="Additional sources"
            hint="Optional public HTTPS URLs, one per line. Broad search remains enabled."
          >
            <Textarea
              rows={2}
              value={urls}
              disabled={action.locked}
              onChange={(event) => setUrls(event.target.value)}
            />
          </Field>
        </div>
      </details>
      <p className="muted">
        Watching uses this question and any public research context shown above
        to search for changes and bring updates into this dossier. Your dossier
        also continues its own research.
      </p>
      <p className="muted">{proposal.scope}</p>
      {validation && <p role="alert">{validation}</p>}
      <CommandError error={action.error} />
      <div className="flex flex-wrap gap-3">
        <Button disabled={action.busy || refreshing || !valid}>
          {action.busy
            ? 'Starting…'
            : action.saved
              ? 'Refresh saved monitoring'
              : action.uncertain
                ? 'Retry the same monitoring'
                : 'Watch changes'}
        </Button>
        {action.error && !action.locked && (
          <Button
            type="button"
            variant="outline"
            disabled={refreshing}
            onClick={() => void refresh()}
          >
            Refresh suggestion
          </Button>
        )}
      </div>
    </form>
  );
}
