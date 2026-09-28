'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Bell, BellOff, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, date } from '@/lib/api';
import { product } from '@/lib/product';
import { usePersonalUpdates } from '@/lib/use-personal-updates';
import { researchHref } from '@/lib/research-following';
import type {
  PersonalFollow,
  PrivateFollow,
  PrivateFollowPage,
  ResearchAudience,
  ResearchUpdate,
  ResearchUpdatesPage,
} from '@/lib/research-following';

const ROOT = `/products/${product.id}`;
const baseFor = (audience: ResearchAudience, id: string) =>
  `${ROOT}/${audience === 'public' ? 'public-dossiers' : 'dossiers'}/${id}/follow`;

export function FollowControls({
  state,
  audience,
  id,
  onChanged,
}: {
  state: PersonalFollow;
  audience: ResearchAudience;
  id: string;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function change(read = false) {
    setBusy(true);
    setError('');
    try {
      await api(
        `${baseFor(audience, id)}${read ? '/read' : ''}`,
        read
          ? { expected_revision: state.revision, marker: state.marker }
          : { expected_revision: state.revision, following: !state.following },
      );
      window.dispatchEvent(new Event('helvetic-following-changed'));
      await onChanged();
    } catch (failure) {
      setError((failure as Error).message);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="follow-controls">
      <div className="public-action-row">
        <Button
          variant={state.following ? 'outline' : 'default'}
          disabled={busy || (!state.available && !state.following)}
          onClick={() => void change()}
        >
          {state.following ? <BellOff size={16} /> : <Bell size={16} />}
          {state.following ? 'Stop following' : 'Follow dossier'}
        </Button>
        {state.following && state.available && (
          <output className="follow-state" aria-live="polite">
            {state.research.unseen > 0
              ? `${state.research.unseen} unseen research ${state.research.unseen === 1 ? 'update' : 'updates'}`
              : state.unread
                ? 'Public activity changed'
                : 'No unseen changes'}
          </output>
        )}
        {state.following && state.unread && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void change(true)}
          >
            <Check size={16} />
            Mark current updates seen
          </Button>
        )}
      </div>
      {state.following && state.unread && (
        <p className="public-meta">
          Marks the current dossier updates seen. This does not verify or
          approve findings.
        </p>
      )}
      {error && (
        <p role="alert" className="banner error">
          {error}{' '}
          <Button
            variant="link"
            disabled={busy}
            onClick={() => void onChanged()}
          >
            Refresh state
          </Button>
        </p>
      )}
    </div>
  );
}

export function ResearchUpdateItem({
  item,
  audience,
  dossierId,
}: {
  item: ResearchUpdate;
  audience: ResearchAudience;
  dossierId: string;
}) {
  const href = (run: string, anchor?: string) =>
    researchHref(audience, dossierId, run, anchor);
  return (
    <article className="research-update">
      <p className="public-meta">
        {item.unseen ? 'Unseen · ' : ''}Completed {date(item.completed_at)}
      </p>
      <h3>
        <a href={href(item.investigation_id)}>{item.question}</a>
      </h3>
      <p>
        {item.source_count} captured sources · {item.finding_count} findings
        {item.comparison_counts.CONTRADICTS
          ? ` · ${item.comparison_counts.CONTRADICTS} possible contradictions`
          : ''}
        {item.comparison_counts.UPDATES
          ? ` · ${item.comparison_counts.UPDATES} proposed updates to earlier findings`
          : ''}
        {item.comparison_counts.CORROBORATES
          ? ` · ${item.comparison_counts.CORROBORATES} supporting comparisons`
          : ''}
      </p>
      {item.findings.length > 0 && (
        <ul
          className="research-update-findings"
          aria-label="Source-linked machine findings"
        >
          {item.findings.map((finding) => (
            <li key={finding.id}>
              <a href={href(item.investigation_id, `claim-${finding.id}`)}>
                {finding.statement}
              </a>
              <span className="public-meta">
                {' '}
                · {finding.status.toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      )}
      {item.sources.map((source) => (
        <figure key={source.id}>
          <blockquote>
            {source.quote}
            {source.truncated ? '…' : ''}
          </blockquote>
          <figcaption>
            <a href={href(item.investigation_id, `source-${source.id}`)}>
              {source.title} · {source.locator} · Open captured evidence
            </a>
          </figcaption>
        </figure>
      ))}
      {item.comparisons.map((change) => (
        <details key={change.id} className="research-update-comparison">
          <summary>
            {change.kind === 'CONTRADICTS'
              ? 'Possible contradiction'
              : change.kind === 'UPDATES'
                ? 'Proposed update'
                : 'Supporting comparison'}{' '}
            · inspect both sources
          </summary>
          {[change.previous, change.current].map((finding, index) => (
            <figure key={finding.id}>
              <figcaption>
                {index ? 'Later evidence' : 'Earlier evidence'} ·{' '}
                <a href={href(finding.investigation_id, `claim-${finding.id}`)}>
                  {finding.statement}
                </a>
              </figcaption>
              {finding.evidence && (
                <>
                  <blockquote>{finding.evidence.quote}</blockquote>
                  <a
                    href={href(
                      finding.investigation_id,
                      `source-${finding.evidence.source.id}`,
                    )}
                  >
                    {finding.evidence.source.title} · {finding.evidence.locator}
                  </a>
                </>
              )}
            </figure>
          ))}
          <p className="public-meta">{change.basis}</p>
        </details>
      ))}
      <p className="public-meta">
        Preview of up to three sources, findings and comparisons.{' '}
        <a href={href(item.investigation_id)}>Open the full research record</a>
      </p>
      {item.completion_note && (
        <p className="public-meta">{item.completion_note}</p>
      )}
    </article>
  );
}

export function ResearchUpdates({
  audience,
  id,
  accountKey,
}: {
  audience: ResearchAudience;
  id: string;
  accountKey: string;
}) {
  const [open, setOpen] = useState(false),
    [offset, setOffset] = useState(0);
  const result = usePersonalUpdates<ResearchUpdatesPage>(
    open
      ? `${baseFor(audience, id)}/updates?offset=${offset}&account=${encodeURIComponent(accountKey)}`
      : null,
  );
  return (
    <details
      className="research-update-history"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Research updates & evidence</summary>
      {open && (
        <>
          <Button variant="ghost" onClick={() => void result.refresh()}>
            <RefreshCw size={16} />
            Refresh research
          </Button>
          {result.error ? (
            <p role="alert">{result.error}</p>
          ) : !result.data ? (
            <output>Loading research updates…</output>
          ) : (
            <>
              <p className="public-meta">
                {result.data.total} accessible completed{' '}
                {result.data.total === 1 ? 'investigation' : 'investigations'}
              </p>
              {result.data.items.length ? (
                result.data.items.map((item) => (
                  <ResearchUpdateItem
                    key={item.investigation_id}
                    item={item}
                    audience={audience}
                    dossierId={id}
                  />
                ))
              ) : (
                <p>
                  No completed research with new evidence on this page. Pending
                  work and source gaps may still need attention.
                </p>
              )}
              <p className="public-meta">{result.data.coverage}</p>
              {(offset > 0 ||
                offset + result.data.page_size < result.data.total) && (
                <nav
                  className="public-action-row"
                  aria-label="Research update pages"
                >
                  <Button
                    variant="outline"
                    disabled={!offset}
                    onClick={() => setOffset(Math.max(0, offset - 10))}
                  >
                    Newer research
                  </Button>
                  <span>Page {Math.floor(offset / 10) + 1}</span>
                  <Button
                    variant="outline"
                    disabled={offset + 10 >= result.data.total}
                    onClick={() => setOffset(offset + 10)}
                  >
                    Older research
                  </Button>
                </nav>
              )}
            </>
          )}
        </>
      )}
    </details>
  );
}

export function PrivateDossierFollowing({
  dossierId,
  userId,
}: {
  dossierId: string;
  userId: string;
}) {
  const result = usePersonalUpdates<PrivateFollow>(
    `${baseFor('private', dossierId)}?account=${encodeURIComponent(userId)}`,
  );
  return (
    <section
      className="private-research-following"
      aria-label="Personal research following"
    >
      <div className="public-action-row">
        <h2>Stay with the evidence</h2>
        <Link href="/following">Your research updates</Link>
      </div>
      <p>
        Follow this dossier for completed research and possible changes to
        earlier findings. Personal to you; no email.
      </p>
      {result.error ? (
        <p role="alert">
          {result.error}{' '}
          <Button variant="link" onClick={() => void result.refresh()}>
            Refresh settings
          </Button>
        </p>
      ) : result.data ? (
        <FollowControls
          audience="private"
          id={dossierId}
          state={result.data}
          onChanged={result.refresh}
        />
      ) : (
        <output>Loading your following settings…</output>
      )}
      <ResearchUpdates audience="private" id={dossierId} accountKey={userId} />
    </section>
  );
}

export function PrivateFollowedDossiers({
  accountKey,
}: {
  accountKey: string;
}) {
  const [offset, setOffset] = useState(0);
  const result = usePersonalUpdates<PrivateFollowPage>(
    `${ROOT}/followed-private-dossiers?offset=${offset}&account=${encodeURIComponent(accountKey)}`,
  );
  return (
    <section aria-label="Private followed dossiers">
      <div className="public-action-row">
        <h2>Private dossiers</h2>
        <Button variant="outline" onClick={() => void result.refresh()}>
          <RefreshCw size={16} />
          Refresh private updates
        </Button>
      </div>
      <p className="public-meta">
        Your current workspace and dossiers shared with you. Current access is
        checked again for every update.
      </p>
      {result.error ? (
        <p role="alert">{result.error}</p>
      ) : !result.data ? (
        <output>Loading private updates…</output>
      ) : (
        <>
          <p>
            {result.data.total} followed private{' '}
            {result.data.total === 1 ? 'dossier' : 'dossiers'}
          </p>
          {result.data.items.length ? (
            <div className="public-list">
              {result.data.items.map((state) => (
                <article key={state.dossier_id}>
                  <h3>
                    <a
                      href={`/?dossier=${encodeURIComponent(state.dossier_id)}`}
                    >
                      {state.title}
                    </a>
                  </h3>
                  <FollowControls
                    audience="private"
                    id={state.dossier_id}
                    state={state}
                    onChanged={result.refresh}
                  />
                  <ResearchUpdates
                    audience="private"
                    id={state.dossier_id}
                    accountKey={accountKey}
                  />
                </article>
              ))}
            </div>
          ) : (
            <p>
              Open a private dossier and choose Follow dossier to collect its
              research updates here.
            </p>
          )}
          {(offset > 0 || offset + 20 < result.data.total) && (
            <nav
              className="public-action-row"
              aria-label="Private followed dossier pages"
            >
              <Button
                variant="outline"
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 20))}
              >
                Previous page
              </Button>
              <span>Page {Math.floor(offset / 20) + 1}</span>
              <Button
                variant="outline"
                disabled={offset + 20 >= result.data.total}
                onClick={() => setOffset(offset + 20)}
              >
                Next page
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
