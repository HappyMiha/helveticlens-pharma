'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { api, date, uid } from '@/lib/api';
import { sourceHref } from '@/lib/investigation';
import { currentClaimReviews, claimDecisionLabels } from '@/lib/claim-review';
import type {
  ClaimReviewsPage,
  ReviewedClaim,
  ClaimCitation,
  ClaimDecision,
} from '@/lib/claim-review';
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
export function ClaimReviews(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="claim-reviews"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Review findings</summary>
      <p className="investigation-muted">
        Read the sources, consider conflicting evidence, and record your
        decision.
      </p>
      {open && <ReviewReader {...props} />}
    </details>
  );
}
function ReviewReader({
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
  const resource = useResource<ClaimReviewsPage>(
    `${base}?offset=${offset}`,
    tick + refreshToken,
  );
  const controls = useResource<{ can_review: boolean }>(
    publicView && accountKey
      ? `${base}/workspace?account=${encodeURIComponent(accountKey)}`
      : null,
    tick + refreshToken,
  );
  const page = currentClaimReviews(
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
  return (
    <div>
      <Button variant="ghost" onClick={refresh}>
        Reload findings
      </Button>
      {resource.error && (
        <p role="alert">
          {resource.error} Findings are hidden until source access can be
          checked again.
        </p>
      )}
      {!resource.error && !page && (
        <output>Checking findings and current source access…</output>
      )}
      {page && (
        <>
          <p className="claim-method">{page.boundary}</p>
          <p>{page.total} findings from accessible completed research.</p>
          {!page.items.length && (
            <p>
              No findings on this page. Complete research with captured evidence
              to review its conclusions.
            </p>
          )}
          {page.items.map((value) => (
            <ClaimReviewCard key={value.id} value={value} onOpen={onOpen}>
              {canReview && value.reviewable && value.revision < 100 && (
                <ClaimReviewForm
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
            </ClaimReviewCard>
          ))}
          <nav
            className="investigation-controls"
            aria-label="Finding review pages"
          >
            {offset > 0 && (
              <Button
                variant="outline"
                onClick={() => setOffset(Math.max(0, offset - page.page_size))}
              >
                Newer findings
              </Button>
            )}
            {offset + page.page_size < page.total && (
              <Button
                variant="outline"
                onClick={() => setOffset(offset + page.page_size)}
              >
                Older findings
              </Button>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
export function ClaimReviewCard({
  value,
  onOpen,
  children,
}: {
  value: ReviewedClaim;
  onOpen: (id: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <details
      className="evidence-change claim-review-card"
      data-claim-review={value.id}
    >
      <summary>{value.claim.statement}</summary>
      <p className="human-review-status">
        <strong>
          {value.stale
            ? 'Evidence changed · review needed'
            : value.decision
              ? claimDecisionLabels[value.decision]
              : 'Awaiting human review'}
        </strong>
      </p>
      <p className="claim-method">
        Machine evidence assessment: {value.claim.evidence_status.toLowerCase()}
        . Source support does not mean human acceptance.
      </p>
      {value.stale && (
        <p>
          The earlier decision does not confirm the current evidence. Read the
          changes before reviewing again.
        </p>
      )}
      <section aria-label="Evidence for this finding">
        <h4>Captured evidence</h4>
        {value.evidence.map((citation) => (
          <Citation key={citation.id} value={citation} />
        ))}
      </section>
      {!!value.comparisons.length && (
        <details>
          <summary>Related comparisons · {value.comparisons.length}</summary>
          <p>
            Machine-linked comparisons may be wrong. Dismissed relationships
            remain visible for context.
          </p>
          {value.comparisons.map((comparison) => (
            <section key={comparison.id} className="compared-finding">
              <h5>
                {comparison.kind.toLowerCase()} · {comparison.status} ·{' '}
                {comparison.direction} finding
              </h5>
              <p>{comparison.claim.statement}</p>
              {comparison.evidence.map((citation) => (
                <Citation key={citation.id} value={citation} />
              ))}
            </section>
          ))}
        </details>
      )}
      {!value.reviewable && (
        <output>
          {!value.complete
            ? `This finding exceeds the review window of ${value.limits.citations} citations or ${value.limits.comparisons} comparisons. A partial review cannot be saved.`
            : 'A captured citation is missing or has changed. Check the original research before reviewing.'}
        </output>
      )}
      <Button
        variant="outline"
        onClick={() => onOpen(value.claim.investigation_id)}
      >
        Open research & sources
      </Button>
      {value.history_unavailable && (
        <p>
          Some earlier review explanations are hidden because their source
          access changed.
        </p>
      )}
      {!!value.history.length && (
        <details>
          <summary>Human review history · {value.history.length}</summary>
          <ol>
            {value.history.map((entry) => (
              <li key={entry.revision}>
                <strong>{claimDecisionLabels[entry.decision]}</strong> ·{' '}
                {date(entry.at)}
                <p>{entry.reason}</p>
                <small>
                  {entry.reviewer} · review {entry.revision}
                </small>
                <details className="claim-method">
                  <summary>Evidence recorded for this decision</summary>
                  <p>
                    Bound to {entry.basis.sources.length} captured source
                    records. Missing model or skill versions remain unknown.
                  </p>
                  <p className="evidence-hash">
                    Evidence fingerprint: {entry.evidence_fingerprint}
                  </p>
                  <ul>
                    {entry.basis.sources.map((source) => (
                      <li key={source.id} className="evidence-hash">
                        Source {source.id} · SHA-256 {source.sha256}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ol>
        </details>
      )}
      {children}
    </details>
  );
}
function Citation({ value }: { value: ClaimCitation }) {
  const href = sourceHref(value.source.url);
  return (
    <figure className="claim-review-citation">
      <figcaption>
        {value.relation === 'CONTRADICTS'
          ? 'Contradicting evidence'
          : value.relation === 'SUPPORTS'
            ? 'Supporting evidence'
            : 'Context'}
        {!value.valid && ' · citation needs checking'}
      </figcaption>
      <blockquote>{value.quote}</blockquote>
      <p>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
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
          Captured {date(value.source.captured_at)}. This is not a publication
          or effective date.
        </p>
        <p className="evidence-hash">SHA-256: {value.source.sha256}</p>
      </details>
    </figure>
  );
}
function ClaimReviewForm({
  base,
  value,
  publicView,
  onSaved,
}: {
  base: string;
  value: ReviewedClaim;
  publicView: boolean;
  onSaved: () => void;
}) {
  const id = useId();
  const [decision, setDecision] = useState<ClaimDecision | null>(null);
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
      claim_id: value.id,
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
        {value.revision ? 'Review this decision again' : 'Review this finding'}
      </summary>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <legend>Your decision about this finding</legend>
          <div className="investigation-controls">
            {(
              [
                ['accepted', 'Accept finding'],
                ['dismissed', 'Dismiss finding'],
                ['needs_more_evidence', 'Request more evidence'],
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
            Your decision applies to these captured sources. Original
            statements, contradictions and earlier reviews stay in the dossier.
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
            {busy ? 'Saving review…' : 'Save finding review'}
          </Button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </form>
    </details>
  );
}
