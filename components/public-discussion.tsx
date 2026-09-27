'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination';
import {
  usePublicSession,
  publicSessionChanged,
} from '@/lib/use-public-session';
import { AuthDialog } from './auth-dialog';
import { api, date, uid } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { product } from '@/lib/product';
import { contributionDraft, discussionPath } from '@/lib/community';
import type {
  Contribution,
  ContributionContent,
  DiscussionPage,
} from '@/lib/community';

export function PublicDiscussion({
  publicationId,
  publicationRevision,
  living = false,
  initial,
}: {
  publicationId: string;
  publicationRevision: number;
  living?: boolean;
  initial: DiscussionPage | null;
}) {
  const session = usePublicSession();
  const identity =
    !session.error && session.data?.authenticated ? session.data : null;
  const [offset, setOffset] = useState(0);
  const [login, setLogin] = useState(false);
  const [notice, setNotice] = useState('');
  const base = `/products/${product.id}/public-dossiers/${publicationId}/discussion`;
  const resource = useResource<DiscussionPage>(
    session.data
      ? `/products/${product.id}${discussionPath(publicationId, offset, !!identity)}`
      : null,
  );
  const refreshDiscussion = resource.refresh;
  useEffect(() => {
    const update = () => void refreshDiscussion();
    window.addEventListener('helvetic-public-research-changed', update);
    const timer = setInterval(update, 15000);
    return () => {
      window.removeEventListener('helvetic-public-research-changed', update);
      clearInterval(timer);
    };
  }, [refreshDiscussion]);
  // Only the anonymous projection is server-rendered. Private controls arrive
  // from the authenticated endpoint after current-session checks.
  const page = resource.error
    ? null
    : resource.data || (!identity && offset === 0 ? initial : null);
  const current = page?.publication_revision === publicationRevision;
  async function refresh() {
    await session.refresh();
    await resource.refresh();
  }
  async function saved(row: Contribution) {
    window.dispatchEvent(new Event('helvetic-public-research-changed'));
    setNotice(
      row.status === 'visible'
        ? 'The contribution is public.'
        : row.status === 'hidden'
          ? 'Saved. This contribution remains hidden for moderator review.'
          : 'The contribution has been removed.',
    );
    await resource.refresh();
  }
  return (
    <section
      id="discussion"
      className="public-discussion"
      aria-labelledby="discussion-title"
    >
      <div className="discussion-heading">
        <div>
          <h2 id="discussion-title">Public discussion</h2>
          <p>
            Develop the question together. Add evidence, explain a disagreement
            or ask what is still missing.
          </p>
        </div>
        <Button variant="outline" onClick={() => void refresh()}>
          Refresh discussion
        </Button>
      </div>
      <p className="discussion-note">
        Contributions are public. Display names are chosen by contributors;
        publication does not verify professional credentials.
      </p>
      {session.error && (
        <p role="alert">Unable to check your account. {session.error}</p>
      )}
      {!identity && session.data && (
        <div className="discussion-signin">
          <p>
            Everyone can read. Sign in to contribute under a public display
            name.
          </p>
          <Button onClick={() => setLogin(true)}>Sign in to contribute</Button>
        </div>
      )}
      {identity && (
        <p className="discussion-note">
          Signed in as {identity.user.name}. Your public display name is entered
          separately.
        </p>
      )}
      <div aria-live="polite">
        {notice && <p className="discussion-notice">{notice}</p>}
      </div>
      {resource.error ? (
        <div role="alert" className="public-empty">
          <p>{resource.error}</p>
          <Button variant="outline" onClick={() => void refresh()}>
            Retry discussion
          </Button>
        </div>
      ) : page ? (
        <>
          {!current && (
            <div className="public-reading-note">
              This dossier has been updated.{' '}
              <a href={`/public-dossiers/${publicationId}`}>
                Read the latest version
              </a>{' '}
              before contributing.
            </div>
          )}
          {page.can_moderate && (
            <p className="discussion-note">
              You moderate this dossier. Hidden and removed contributions below
              are visible to you and their authors.
            </p>
          )}
          <p className="discussion-count">
            {page.total}{' '}
            {identity ? 'contributions visible to you' : 'public contributions'}
            {page.items.length > 0 && (
              <>
                {' '}
                · {page.offset + 1}–
                {Math.min(page.offset + page.items.length, page.total)}
              </>
            )}
          </p>
          {page.items.length ? (
            <ol className="contribution-list">
              {page.items.map((item) => (
                <li key={item.id}>
                  <ContributionCard
                    key={`${item.id}:${item.revision}`}
                    item={item}
                    living={living}
                    base={base}
                    publicationRevision={publicationRevision}
                    canContribute={current}
                    onSaved={saved}
                  />
                </li>
              ))}
            </ol>
          ) : (
            <p className="discussion-empty">
              {offset
                ? 'No contributions on this page.'
                : 'No public contributions yet. Start with a source or a focused question.'}
            </p>
          )}
          {(offset > 0 || page.total > page.page_size) && (
            <Pagination aria-label="Discussion pages">
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    disabled={offset === 0 || resource.loading}
                    onClick={() =>
                      setOffset(Math.max(0, offset - page.page_size))
                    }
                  >
                    Previous
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <Button
                    variant="outline"
                    disabled={
                      offset + page.page_size >= page.total ||
                      offset + page.page_size > 100000 ||
                      resource.loading
                    }
                    onClick={() => setOffset(offset + page.page_size)}
                  >
                    Next
                  </Button>
                </PaginationItem>
                {offset > 0 && (
                  <PaginationItem>
                    <Button variant="ghost" onClick={() => setOffset(0)}>
                      First page
                    </Button>
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          )}
          {identity && page.can_post && current && (
            <div className="new-contribution" key={identity.user.id}>
              <h3>Add a contribution</h3>
              <ContributionForm
                living={living}
                base={base}
                publicationRevision={publicationRevision}
                onSaved={async (row) => {
                  setOffset(
                    Math.min(
                      100000,
                      Math.floor(page.total / page.page_size) * page.page_size,
                    ),
                  );
                  await saved(row);
                }}
              />
            </div>
          )}
        </>
      ) : (
        <output>Loading discussion…</output>
      )}
      <AuthDialog
        open={login}
        onClose={() => setLogin(false)}
        onSuccess={async () => {
          publicSessionChanged();
          setLogin(false);
          setOffset(0);
        }}
      />
    </section>
  );
}

function ContributionBody({ content }: { content: ContributionContent }) {
  return (
    <div className="contribution-content">
      <div className="public-body">{content.body}</div>
      {content.sources.length > 0 && (
        <ol className="contribution-sources" aria-label="Contribution sources">
          {content.sources.map((source, index) => {
            // Draft previews are not server-validated yet. Never make executable or
            // credential-bearing user input into a link in that preview.
            let safe = false;
            try {
              const url = new URL(source.url);
              safe =
                url.protocol === 'https:' && !url.username && !url.password;
            } catch {
              /* Render invalid draft URLs as text. */
            }
            return (
              <li key={index}>
                {safe ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow ugc"
                  >
                    {source.title || source.url}
                  </a>
                ) : (
                  <span>{source.title}</span>
                )}
                <span>{source.url}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function ContributionCard({
  item,
  base,
  publicationRevision,
  canContribute,
  living,
  onSaved,
}: {
  item: Contribution;
  base: string;
  publicationRevision: number;
  canContribute: boolean;
  living: boolean;
  onSaved: (row: Contribution) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState<'remove' | 'hide' | 'restore' | null>(
    null,
  );
  return (
    <article
      className={`contribution-card ${item.status || 'visible'}`}
      id={`contribution-${item.id}`}
    >
      <header>
        <h3>
          {item.status === 'removed'
            ? 'Removed by its author'
            : item.author_label}
        </h3>
        <p>
          {date(item.created_at)} · Dossier revision {item.publication_revision}
          {item.revision > 1 && (
            <>
              {' '}
              · Contribution revision {item.revision}, updated{' '}
              {date(item.updated_at)}
            </>
          )}
        </p>
      </header>
      {item.status === 'hidden' && (
        <p className="contribution-hidden">
          Hidden from public readers. {item.moderation_reason}
        </p>
      )}
      {item.status !== 'removed' && <ContributionBody content={item} />}
      {item.file_name &&
        item.status !== 'hidden' &&
        item.status !== 'removed' && (
          <p>
            <a
              href={`/api${base.replace(/\/discussion$/, '')}/files/${item.id}`}
            >
              Download original · {item.file_name}
            </a>{' '}
            · {item.byte_size} bytes
          </p>
        )}
      {item.research && (
        <p>
          <a
            href={`?research=${item.research.id}#investigation-${item.research.id}`}
          >
            Read analysis · {item.research.status}
          </a>{' '}
          · Submitted material is candidate evidence.
        </p>
      )}
      <div className="contribution-controls">
        {item.can_edit && canContribute && (
          <Button variant="outline" onClick={() => setEditing(!editing)}>
            {editing ? 'Cancel editing' : 'Edit my contribution'}
          </Button>
        )}
        {item.can_remove && (
          <Button variant="outline" onClick={() => setAction('remove')}>
            Remove my contribution
          </Button>
        )}
        {item.can_moderate && (
          <Button
            variant="outline"
            onClick={() =>
              setAction(item.status === 'hidden' ? 'restore' : 'hide')
            }
          >
            {item.status === 'hidden'
              ? 'Restore to discussion'
              : 'Hide from discussion'}
          </Button>
        )}
      </div>
      {editing && (
        <ContributionForm
          living={living}
          base={base}
          publicationRevision={publicationRevision}
          item={item}
          onSaved={async (row) => {
            await onSaved(row);
            setEditing(false);
          }}
        />
      )}
      {!!item.history?.length && (
        <details className="contribution-history">
          <summary>Change history · latest {item.history.length}</summary>
          <ol>
            {item.history.map((event) => (
              <li key={event.revision}>
                Revision {event.revision} · {event.action} ·{' '}
                {date(event.created_at)}
                {event.reason && <p>{event.reason}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
      {action && (
        <ContributionActionDialog
          item={item}
          base={base}
          action={action}
          onClose={() => setAction(null)}
          onSaved={onSaved}
        />
      )}
    </article>
  );
}

function ContributionForm({
  living,
  base,
  publicationRevision,
  item,
  onSaved,
}: {
  living: boolean;
  base: string;
  publicationRevision: number;
  item?: Contribution;
  onSaved: (row: Contribution) => Promise<void>;
}) {
  const formId = useId();
  const [draft, setDraft] = useState<ContributionContent>(() =>
    contributionDraft(item),
  );
  const [preview, setPreview] = useState<ContributionContent | null>(null);
  const [kind, setKind] = useState<NonNullable<Contribution['kind']>>(
    item?.kind || 'comment',
  );
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestKey = useRef<string | null>(null);
  const previewPanel = useRef<HTMLDivElement>(null);
  function change(value: ContributionContent) {
    setDraft(value);
    setPreview(null);
    setConsent(false);
    setError('');
    requestKey.current = null;
  }
  async function publish() {
    if (!preview || !consent || busy) return;
    setBusy(true);
    setError('');
    try {
      const command = {
        content: preview,
        publication_revision: publicationRevision,
        request_key: requestKey.current,
        confirm_public: true,
        kind,
        analyse_publicly: living,
        public_query_confirmed: kind === 'research_request',
        ...(item ? { expected_revision: item.revision } : {}),
      };
      let body: unknown = command;
      let target = base + (item ? `/${item.id}` : '');
      if (!item && kind === 'file') {
        if (!file)
          throw new Error('Choose the original file before publishing.');
        const data = new FormData();
        data.set('metadata', JSON.stringify(command));
        data.set('file', file);
        body = data;
        target = base.replace(/\/discussion$/, '/files');
      }
      const result = await api<{ contribution: Contribution }>(target, body);
      await onSaved(result.contribution);
      if (!item) {
        change(contributionDraft());
        setFile(null);
        setKind('comment');
      }
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="contribution-form">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPreview(contributionDraft(draft));
          setConsent(false);
          setError('');
          requestKey.current = uid();
          requestAnimationFrame(() => previewPanel.current?.focus());
        }}
      >
        <fieldset disabled={busy}>
          {living && !item && (
            <div>
              <label htmlFor={`${formId}-kind`}>Contribution</label>
              <Select
                value={kind}
                onValueChange={(next) => {
                  if (next) {
                    setKind(next as NonNullable<Contribution['kind']>);
                    change(draft);
                  }
                }}
              >
                <SelectTrigger id={`${formId}-kind`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comment">Comment</SelectItem>
                  <SelectItem value="url">Source URL</SelectItem>
                  <SelectItem value="correction">Correction</SelectItem>
                  <SelectItem value="research_request">
                    Research request
                  </SelectItem>
                  <SelectItem value="file">Original file</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {living && kind === 'file' && !item && (
            <label htmlFor={`${formId}-file`}>
              Public original · up to 2 MB
              <Input
                id={`${formId}-file`}
                type="file"
                accept=".txt,.md,.csv,.html,.htm,.pdf"
                required
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  change(draft);
                }}
              />
              <span>
                TXT, Markdown, CSV, HTML or text PDF. The original and extracted
                findings will be public.
              </span>
            </label>
          )}
          <label htmlFor={`${formId}-name`}>
            Public display name
            <Input
              id={`${formId}-name`}
              required
              minLength={2}
              maxLength={100}
              value={draft.author_label}
              onChange={(event) =>
                change({ ...draft, author_label: event.target.value })
              }
            />
          </label>
          <label htmlFor={`${formId}-body`}>
            Your contribution
            <Textarea
              id={`${formId}-body`}
              required
              minLength={10}
              maxLength={kind === 'research_request' ? 300 : 12000}
              rows={6}
              value={draft.body}
              onChange={(event) =>
                change({ ...draft, body: event.target.value })
              }
            />
          </label>
          <div className="contribution-link-fields">
            <h4>Source links · {draft.sources.length}/10</h4>
            {draft.sources.map((source, index) => (
              <div className="publication-link" key={index}>
                <label htmlFor={`${formId}-title-${index}`}>
                  Source {index + 1} title
                  <Input
                    id={`${formId}-title-${index}`}
                    required
                    maxLength={240}
                    value={source.title}
                    onChange={(event) =>
                      change({
                        ...draft,
                        sources: draft.sources.map((value, i) =>
                          i === index
                            ? { ...value, title: event.target.value }
                            : value,
                        ),
                      })
                    }
                  />
                </label>
                <label htmlFor={`${formId}-url-${index}`}>
                  Public HTTPS address
                  <Input
                    id={`${formId}-url-${index}`}
                    type="url"
                    pattern="https://.*"
                    required
                    maxLength={2000}
                    value={source.url}
                    onChange={(event) =>
                      change({
                        ...draft,
                        sources: draft.sources.map((value, i) =>
                          i === index
                            ? { ...value, url: event.target.value }
                            : value,
                        ),
                      })
                    }
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Remove source ${index + 1}`}
                  onClick={() =>
                    change({
                      ...draft,
                      sources: draft.sources.filter((_, i) => i !== index),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            {draft.sources.length < 10 && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  change({
                    ...draft,
                    sources: [...draft.sources, { title: '', url: '' }],
                  })
                }
              >
                Add source link
              </Button>
            )}
          </div>
          <div>
            <Button type="submit">Preview contribution</Button>
          </div>
        </fieldset>
      </form>
      {preview && (
        <div
          className="contribution-preview"
          ref={previewPanel}
          tabIndex={-1}
          aria-label="Public contribution preview"
        >
          <p>
            <b>Public preview · {preview.author_label}</b>
          </p>
          <ContributionBody content={preview} />
          {file && (
            <p>
              Public original: {file.name} · {file.size} bytes
            </p>
          )}
          <label className="publication-consent" htmlFor={`${formId}-consent`}>
            <Checkbox
              id={`${formId}-consent`}
              checked={consent}
              disabled={busy}
              onCheckedChange={(value) => setConsent(value === true)}
            />
            <span>
              I reviewed this contribution and confirm it can be published
              publicly.{' '}
              {living &&
                'I also authorize public analysis of this contribution and its sources.'}
              {living &&
                kind === 'research_request' &&
                ' This question and entity names found in public sources may be sent to external search.'}
            </span>
          </label>
          {item?.status === 'hidden' && (
            <p className="discussion-note">
              Your edit will stay hidden until a moderator restores it.
            </p>
          )}
          <Button disabled={!consent || busy} onClick={() => void publish()}>
            {busy
              ? 'Saving…'
              : item
                ? 'Save reviewed edit'
                : 'Publish contribution'}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="inline-error">
          {error} Your draft is kept here.
        </p>
      )}
    </div>
  );
}

function ContributionActionDialog({
  item,
  base,
  action,
  onClose,
  onSaved,
}: {
  item: Contribution;
  base: string;
  action: 'remove' | 'hide' | 'restore';
  onClose: () => void;
  onSaved: (row: Contribution) => Promise<void>;
}) {
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const key = useRef<string | null>(null);
  const label =
    action === 'remove'
      ? 'Remove contribution'
      : action === 'hide'
        ? 'Hide contribution'
        : 'Restore contribution';
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    key.current ||= uid();
    try {
      const result = await api<{ contribution: Contribution }>(
        `${base}/${item.id}/action`,
        {
          action,
          reason,
          expected_revision: item.revision,
          request_key: key.current,
        },
      );
      await onSaved(result.contribution);
      onClose();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>
            {action === 'remove'
              ? 'Your text, display name and source links will be removed here. This cannot be undone. Copies saved elsewhere may remain.'
              : action === 'hide'
                ? 'Public readers will no longer see this contribution. Its author can read your reason and revise it.'
                : 'The current contribution, including any author edits, will become public again. Review it before restoring.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {action !== 'remove' && (
          <label htmlFor={reasonId}>
            Reason for your decision
            <Textarea
              id={reasonId}
              required
              minLength={5}
              maxLength={600}
              disabled={busy}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                key.current = null;
              }}
            />
          </label>
        )}
        {error && <p role="alert">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            disabled={busy || (action !== 'remove' && reason.trim().length < 5)}
            onClick={() => void submit()}
          >
            {busy ? 'Saving…' : label}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
