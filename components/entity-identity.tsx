'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { api, date, uid } from '@/lib/api';
import { sourceHref } from '@/lib/investigation';
import { currentIdentities, identityLabels } from '@/lib/entity-identity';
import type {
  EntityIdentitiesPage,
  EntityIdentity,
  EntityMention,
  IdentityDecision,
} from '@/lib/entity-identity';
import { useResource } from '@/lib/use-resource';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Textarea } from './ui/textarea';

type Props = {
  base: string;
  publicationRevision?: number;
  accountKey?: string;
  refreshToken?: number;
  onOpen: (id: string) => void;
  onChange: () => void;
};

export function EntityIdentities(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="entity-identities"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Entity matches across research</summary>
      <p className="investigation-muted">
        Check whether two source mentions refer to the same person, organization
        or other entity. Read both quotations before deciding.
      </p>
      {open && <IdentityReader {...props} />}
    </details>
  );
}

function IdentityReader({
  base,
  publicationRevision,
  accountKey,
  refreshToken = 0,
  onOpen,
  onChange,
}: Props) {
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);
  const publicView = publicationRevision !== undefined;
  const resource = useResource<EntityIdentitiesPage>(
    `${base}?offset=${offset}`,
    tick + refreshToken,
  );
  const controls = useResource<{ can_review: boolean }>(
    publicView && accountKey
      ? `${base}/workspace?account=${encodeURIComponent(accountKey)}`
      : null,
    tick + refreshToken,
  );
  const page = currentIdentities(
    resource.data,
    resource.error,
    offset,
    publicationRevision,
  );
  const canReview =
    !!page &&
    (publicView
      ? !!accountKey && !controls.error && !!controls.data?.can_review
      : !!page.can_review);
  useEffect(() => {
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  const render = (value: EntityIdentity) => (
    <EntityIdentityCard key={value.id} value={value} onOpen={onOpen}>
      {canReview && value.evidence_fingerprint && value.revision < 100 && (
        <IdentityReview
          key={`${value.id}:${value.revision}:${value.evidence_fingerprint}`}
          base={base}
          value={value}
          publicView={publicView}
          onSaved={() => {
            refresh();
            onChange();
          }}
        />
      )}
    </EntityIdentityCard>
  );
  return (
    <div>
      <Button variant="ghost" onClick={refresh}>
        Reload entity matches
      </Button>
      {resource.error && (
        <p role="alert">
          {resource.error} Entity matches are hidden until source access can be
          checked again.
        </p>
      )}
      {!resource.error && !page && (
        <output>Checking retained mentions and current access…</output>
      )}
      {page && (
        <>
          <p className="claim-method">{page.boundary}</p>
          {page.suggestions && (
            <section aria-label="Suggested entity matches">
              <h4>Matches to review</h4>
              <p className="investigation-muted">
                Suggestions check up to {page.suggestions.entity_limit} recent
                eligible mentions from completed research. This check examined{' '}
                {page.suggestions.entities_examined}.
                {page.suggestions.entity_window_limited &&
                  ' Older mentions are outside this suggestion window.'}
                {page.suggestions.more_suggestions &&
                  ` Showing the first ${page.suggestions.suggestion_limit} pairs; review them to reveal more.`}
              </p>
              {!page.suggestions.items.length && (
                <p>
                  No exact identifier matches awaiting review in this window.
                  Similar names and incomplete identifiers remain unresolved.
                </p>
              )}
              {page.suggestions.items.map(render)}
            </section>
          )}
          <section aria-label="Saved entity decisions">
            <h4>Saved editor decisions · {page.total}</h4>
            {!page.items.length && <p>No saved decisions on this page.</p>}
            {page.items.map(render)}
          </section>
          <nav
            className="investigation-controls"
            aria-label="Entity decision pages"
          >
            {offset > 0 && (
              <Button
                variant="outline"
                onClick={() => setOffset(Math.max(0, offset - page.page_size))}
              >
                Newer decisions
              </Button>
            )}
            {offset + page.page_size < page.total && (
              <Button
                variant="outline"
                onClick={() => setOffset(offset + page.page_size)}
              >
                Older decisions
              </Button>
            )}
          </nav>
        </>
      )}
    </div>
  );
}

export function EntityIdentityCard({
  value,
  onOpen,
  children,
}: {
  value: EntityIdentity;
  onOpen: (id: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <article className="evidence-change" data-entity-identity={value.id}>
      <header>
        <h4>
          {value.stale
            ? 'Evidence changed · review needed'
            : identityLabels[value.decision]}
        </h4>
      </header>
      {value.stale && (
        <p>
          The saved decision applies to an earlier capture. It is not a current
          identity confirmation.
        </p>
      )}
      <div className="evidence-change-pair">
        <Mention value={value.first} label="First mention" onOpen={onOpen} />
        <Mention value={value.second} label="Second mention" onOpen={onOpen} />
      </div>
      <p className="claim-method">
        {value.exact_identifier_match
          ? value.basis
          : 'The current cited identifiers do not form an exact match. Review both sources and the retained history.'}
      </p>
      {!!value.history.length && (
        <details>
          <summary>
            Editor review history · {value.history.length} decisions
          </summary>
          <ol>
            {value.history.map((entry) => (
              <li key={entry.revision}>
                <strong>{identityLabels[entry.decision]}</strong> ·{' '}
                {date(entry.at)}
                <p>{entry.reason}</p>
                <small>
                  {entry.reviewer} · revision {entry.revision}
                </small>
              </li>
            ))}
          </ol>
        </details>
      )}
      {children}
    </article>
  );
}

function Mention({
  value,
  label,
  onOpen,
}: {
  value: EntityMention | null;
  label: string;
  onOpen: (id: string) => void;
}) {
  const href = value ? sourceHref(value.source.url) : null;
  return (
    <section className="compared-finding" aria-label={label}>
      <p className="eyebrow">{label}</p>
      {value ? (
        <>
          <h5>{value.name}</h5>
          <p>
            {value.identifier.value} · {value.identifier.issuer} ·{' '}
            {value.identifier.jurisdiction}
          </p>
          <blockquote>{value.quote}</blockquote>
          <p>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
              >
                {value.source.title || 'Open source'}
              </a>
            ) : (
              value.source.title
            )}{' '}
            · {value.locator}
          </p>
          <details className="claim-method">
            <summary>Captured source record</summary>
            <p>
              Captured {date(value.source.captured_at)}. This is not a
              publication or effective date.
            </p>
            <p className="evidence-hash">SHA-256: {value.source.sha256}</p>
          </details>
          <Button
            variant="outline"
            onClick={() => onOpen(value.investigation_id)}
          >
            Open research & sources
          </Button>
        </>
      ) : (
        <p>
          The original citation cannot currently be validated. Reload after
          checking its source; no new review can be saved.
        </p>
      )}
    </section>
  );
}

function IdentityReview({
  base,
  value,
  publicView,
  onSaved,
}: {
  base: string;
  value: EntityIdentity;
  publicView: boolean;
  onSaved: () => void;
}) {
  const id = useId();
  const [decision, setDecision] = useState<IdentityDecision | null>(null);
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
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busy ||
      !decision ||
      reason.trim().length < 5 ||
      (publicView && !confirm)
    )
      return;
    const data = {
      entity_id: value.entity_id,
      previous_entity_id: value.previous_entity_id,
      expected_revision: value.revision,
      evidence_fingerprint: value.evidence_fingerprint,
      decision,
      reason: reason.trim(),
      confirm_public: publicView && confirm,
    };
    const fingerprint = JSON.stringify(data);
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = { fingerprint, key: uid() };
    setBusy(true);
    setError('');
    try {
      await api(`${base}/review`, {
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
        {value.revision
          ? 'Review this decision again'
          : 'Review these two mentions'}
      </summary>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <legend>Your decision about these two mentions</legend>
          <div className="investigation-controls">
            {(
              [
                ['same', 'Same entity'],
                ['different', 'Different entities'],
                ['unresolved', 'Not enough evidence'],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                variant={decision === key ? 'default' : 'outline'}
                aria-pressed={decision === key}
                onClick={() => {
                  setDecision(key);
                  setConfirm(false);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
          <label htmlFor={`${id}-reason`}>
            Explain what the cited evidence establishes
          </label>
          <Textarea
            id={`${id}-reason`}
            required
            minLength={5}
            maxLength={500}
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
                onCheckedChange={(checked) => setConfirm(checked === true)}
              />
              Publish this explanation in the public dossier. It contains no
              confidential information.
            </label>
          )}
          <p className="investigation-muted">
            This saves your review of the pair. It keeps original records and
            earlier decisions intact.
          </p>
          <Button
            type="submit"
            disabled={
              busy ||
              !decision ||
              reason.trim().length < 5 ||
              (publicView && !confirm)
            }
          >
            {busy ? 'Saving review…' : 'Save identity review'}
          </Button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </form>
    </details>
  );
}
