'use client';
import { useRef, useState } from 'react';
import { api, uid } from '@/lib/api';
import { product } from '@/lib/product';
import type { DossierAllowance, LimitRequest } from '@/lib/dossier-allowance';
import { Button } from './ui/button';

export function DossierLimitRequest({
  value,
  onUpdated,
}: {
  value: DossierAllowance;
  onUpdated: (value: DossierAllowance) => void;
}) {
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(value.limit + 1);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [frozen, setFrozen] = useState(false);
  const pending = useRef<{
    request_key: string;
    requested_limit: number;
    reason: string;
  } | null>(null);
  const sending = useRef(false);
  const latest = value.latest_request;
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      sending.current ||
      !Number.isInteger(requested) ||
      requested <= value.limit ||
      reason.trim().length < 5
    )
      return;
    pending.current ||= {
      request_key: uid(),
      requested_limit: requested,
      reason: reason.trim(),
    };
    sending.current = true;
    setFrozen(true);
    setBusy(true);
    setError('');
    try {
      const result = await api<LimitRequest>(
        `/products/${product.id}/dossier-limit-requests`,
        pending.current,
      );
      onUpdated({ ...value, latest_request: result });
      setOpen(false);
      pending.current = null;
      setFrozen(false);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not save the request.',
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="dossier-limit-request" aria-label="Dossier allowance">
      <p>
        {value.used} of {value.limit} dossiers · shared across Legal and Pharma.
      </p>
      <p className="muted">
        Research and continuation inside these dossiers are included.
      </p>
      {latest?.status === 'pending' ? (
        <output>
          Your request for {latest.requested_limit} dossiers is awaiting a
          decision.
          {latest.mail_state === 'sent'
            ? ' Sent to info@helveticlens.ch.'
            : latest.mail_state === 'unavailable'
              ? ' The request is saved; email delivery is unavailable.'
              : ' Email delivery is queued.'}
        </output>
      ) : (
        <>
          {latest && (
            <p>
              {latest.status === 'approved'
                ? `Your new limit is ${latest.approved_limit} dossiers.`
                : 'Your previous request was declined.'}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (!frozen) setRequested(value.limit + 1);
              setOpen(!open);
            }}
          >
            {open ? 'Close request' : 'Request a higher limit'}
          </Button>
        </>
      )}
      {open && latest?.status !== 'pending' && (
        <form onSubmit={submit}>
          <label htmlFor="requested-dossier-limit">
            Desired total number of dossiers
          </label>
          <input
            id="requested-dossier-limit"
            type="number"
            min={value.limit + 1}
            max={100000}
            step={1}
            required
            disabled={busy || frozen}
            value={requested}
            onChange={(event) => setRequested(Number(event.target.value))}
          />
          <label htmlFor="dossier-limit-reason">Why do you need more?</label>
          <textarea
            id="dossier-limit-reason"
            rows={3}
            required
            minLength={5}
            maxLength={1000}
            disabled={busy || frozen}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="muted">
            Your account details and explanation will be sent to
            info@helveticlens.ch for review.
          </p>
          {error && <p role="alert">{error}</p>}
          <Button
            type="submit"
            disabled={
              busy || requested <= value.limit || reason.trim().length < 5
            }
          >
            {busy
              ? 'Sending request…'
              : frozen
                ? 'Retry request safely'
                : 'Send request'}
          </Button>
        </form>
      )}
    </section>
  );
}
