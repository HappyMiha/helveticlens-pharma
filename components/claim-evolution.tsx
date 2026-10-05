'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { api, date, uid } from '@/lib/api';
import { readable, sourceHref } from '@/lib/investigation';
import { useResource } from '@/lib/use-resource';
import { currentChanges } from '@/lib/claim-evolution';
import type {
  ComparedFinding,
  EvidenceChange,
  EvidenceChangesPage,
} from '@/lib/claim-evolution';
import { DossierSection } from './research-blocks';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Textarea } from './ui/textarea';

export function ClaimEvolution({
  base,
  publicationRevision,
  accountKey,
  initial = null,
  refreshToken = 0,
  onOpen,
  onChange,
}: {
  base: string;
  publicationRevision?: number;
  accountKey?: string;
  initial?: EvidenceChangesPage | null;
  refreshToken?: number;
  onOpen: (id: string) => void;
  onChange: () => void;
}) {
  const id = useId();
  const [offset, setOffset] = useState(0);
  const [includeDismissed, setIncludeDismissed] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);
  const publicView = publicationRevision !== undefined;
  const resource = useResource<EvidenceChangesPage>(
    `${base}?offset=${offset}&status=${includeDismissed ? 'all' : 'active'}`,
    tick + refreshToken,
  );
  const controls = useResource<{ can_review: boolean }>(
    publicView && accountKey
      ? `${base}/workspace?account=${encodeURIComponent(accountKey)}`
      : null,
    tick + refreshToken,
  );
  const page = currentChanges(
    resource.data,
    resource.error,
    initial,
    offset,
    includeDismissed,
    publicationRevision,
  );
  const canReview =
    !!page &&
    (publicView
      ? !!accountKey && !controls.error && !!controls.data?.can_review
      : !!resource.data?.can_review);
  const { poll: pollResource } = resource;
  const { poll: pollControls } = controls;
  useEffect(() => {
    const timer = setInterval(() => {
      void pollResource();
      void pollControls();
    }, 15000);
    return () => clearInterval(timer);
  }, [pollResource, pollControls]);
  return (
    <DossierSection id="evidence-changes" number="07" title="Changes over time">
      <p className="investigation-muted">
        New findings can corroborate, contradict or update earlier evidence.
        Both originals stay intact. These are machine-suggested relationships;
        agreement does not establish independent sources.
      </p>
      <div className="evolution-tools">
        <label htmlFor={`${id}-dismissed`} className="evolution-checkbox">
          <Checkbox
            id={`${id}-dismissed`}
            checked={includeDismissed}
            onCheckedChange={(v) => {
              setIncludeDismissed(v === true);
              setOffset(0);
            }}
          />
          Include dismissed comparisons
        </label>
        <Button variant="ghost" onClick={refresh}>
          Refresh comparisons
        </Button>
      </div>
      {resource.error && (
        <p role="alert">
          {resource.error} Saved comparisons are hidden until access can be
          checked again.
        </p>
      )}
      {!resource.error && !page && (
        <output>Checking current evidence and publication access…</output>
      )}
      {page && (
        <>
          <p className="investigation-muted">
            {page.total} {includeDismissed ? 'retained' : 'active'} comparisons
            · {page.coverage}
          </p>
          {!page.items.length && (
            <p className="investigation-empty">
              No {includeDismissed ? 'retained' : 'active'} comparisons on this
              page. Add another source or question to develop the dossier. A
              missing comparison does not establish that findings agree.
            </p>
          )}
          {page.items.map((value) => (
            <EvidenceChangeCard key={value.id} value={value} onOpen={onOpen}>
              {canReview && (
                <ComparisonReview
                  key={`${value.id}:${value.revision}`}
                  base={base}
                  value={value}
                  publicView={publicView}
                  onSaved={() => {
                    refresh();
                    onChange();
                  }}
                />
              )}
            </EvidenceChangeCard>
          ))}
          <nav
            className="investigation-controls"
            aria-label="Evidence comparison pages"
          >
            {offset > 0 && (
              <Button
                variant="outline"
                onClick={() => setOffset(Math.max(0, offset - page.page_size))}
              >
                Newer comparisons
              </Button>
            )}
            {offset + page.page_size < page.total && (
              <Button
                variant="outline"
                onClick={() => setOffset(offset + page.page_size)}
              >
                Older comparisons
              </Button>
            )}
          </nav>
        </>
      )}
    </DossierSection>
  );
}

export function EvidenceChangeCard({
  value,
  onOpen,
  children,
}: {
  value: EvidenceChange;
  onOpen: (id: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <article
      className="evidence-change"
      id={`evidence-change-${value.id}`}
      data-change-kind={value.kind}
    >
      <header>
        <h4>{readable(value.kind)}</h4>
        <span className="investigation-status">
          {readable(value.status)} · revision {value.revision}
        </span>
      </header>
      <p>{value.explanation}</p>
      <div className="evidence-change-pair">
        <ComparedEvidence
          value={value.previous}
          label="Earlier finding"
          onOpen={onOpen}
        />
        <ComparedEvidence
          value={value.current}
          label="Newer finding"
          onOpen={onOpen}
        />
      </div>
      <p className="claim-method">
        Compared {date(value.created_at)} · earlier claim revision{' '}
        {value.previous_revision}, {readable(value.previous_status)}.{' '}
        {value.basis}
      </p>
      {!!value.history.length && (
        <details>
          <summary>
            Editor review history · {value.history.length} decisions
          </summary>
          <ol>
            {value.history.map((entry) => (
              <li key={entry.revision}>
                {readable(entry.from)} → {readable(entry.to)} · {date(entry.at)}
                <p>{entry.reason}</p>
              </li>
            ))}
          </ol>
        </details>
      )}
      {children}
    </article>
  );
}

function ComparedEvidence({
  value,
  label,
  onOpen,
}: {
  value: ComparedFinding;
  label: string;
  onOpen: (id: string) => void;
}) {
  const evidence = value.evidence;
  const href = evidence ? sourceHref(evidence.source.url) : null;
  return (
    <section className="compared-finding" aria-label={label}>
      <p className="eyebrow">{label}</p>
      <h5>{value.statement}</h5>
      <p className="investigation-muted">
        Recorded status: {readable(value.status)} · claim revision{' '}
        {value.revision}
      </p>
      {evidence ? (
        <>
          <blockquote>{evidence.quote}</blockquote>
          <p>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
              >
                {evidence.source.title || 'Open source'}
              </a>
            ) : (
              <span>
                {evidence.source.title || readable(evidence.source.kind)}
              </span>
            )}{' '}
            · {evidence.locator}
          </p>
          <details className="claim-method">
            <summary>Captured source record</summary>
            <p>
              {readable(evidence.source.kind)} ·{' '}
              {date(evidence.source.captured_at)}
            </p>
            <p className="evidence-hash">SHA-256: {evidence.source.sha256}</p>
          </details>
        </>
      ) : (
        <p>The supporting quotation is currently unavailable.</p>
      )}
      <Button variant="outline" onClick={() => onOpen(value.investigation_id)}>
        Open {label.toLowerCase()} & sources
      </Button>
    </section>
  );
}

function ComparisonReview({
  base,
  value,
  publicView,
  onSaved,
}: {
  base: string;
  value: EvidenceChange;
  publicView: boolean;
  onSaved: () => void;
}) {
  const id = useId();
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const status = value.status === 'active' ? 'dismissed' : 'active';
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || (publicView && !confirm)) return;
    const data = {
      expected_revision: value.revision,
      status,
      reason: reason.trim(),
      confirm_public: publicView && confirm,
    };
    const fingerprint = JSON.stringify(data);
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = { fingerprint, key: uid() };
    setBusy(true);
    setError('');
    try {
      await api(`${base}/${value.id}/review`, {
        ...data,
        request_key: pending.current.key,
      });
      if (mounted.current) onSaved();
    } catch (failure) {
      if (mounted.current) setError((failure as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <details className="comparison-review">
      <summary>
        {status === 'dismissed'
          ? 'Dismiss an incorrect comparison'
          : 'Restore this comparison'}
      </summary>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <label htmlFor={`${id}-reason`}>
            Explain your evidence-based decision
          </label>
          <Textarea
            id={`${id}-reason`}
            minLength={5}
            maxLength={500}
            required
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setConfirm(false);
            }}
          />
          {publicView && (
            <label className="evolution-checkbox" htmlFor={`${id}-confirm`}>
              <Checkbox
                id={`${id}-confirm`}
                checked={confirm}
                onCheckedChange={(v) => setConfirm(v === true)}
              />
              Publish this explanation in the public evidence history. It
              contains no confidential information.
            </label>
          )}
          <p className="investigation-muted">
            This changes the relationship, while preserving both original
            findings and the review history.
          </p>
          <Button
            type="submit"
            disabled={
              busy || reason.trim().length < 5 || (publicView && !confirm)
            }
          >
            {busy
              ? 'Saving review…'
              : status === 'dismissed'
                ? 'Dismiss comparison'
                : 'Restore comparison'}
          </Button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </form>
    </details>
  );
}
