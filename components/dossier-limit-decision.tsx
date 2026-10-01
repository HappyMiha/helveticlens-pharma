'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { product } from '@/lib/product';
import type { DossierAllowance, LimitRequest } from '@/lib/dossier-allowance';
import { AuthDialog } from './auth-dialog';
import { Button } from './ui/button';

type RequestDetails = LimitRequest & {
  user: { name: string; email: string };
  allowance: DossierAllowance;
};
export function DossierLimitDecision({ id }: { id: string }) {
  const [value, setValue] = useState<RequestDetails | null>(null);
  const [limit, setLimit] = useState(4);
  const [action, setAction] = useState<'approve' | 'reject' | 'adjust'>(
    'approve',
  );
  const [login, setLogin] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const root = `/products/${product.id}/dossier-limit-requests/${encodeURIComponent(id)}`;
  const load = useCallback(() => api<RequestDetails>(root).then((result) => {
      setError('');
      setValue(result);
      setLimit(result.requested_limit);
      setNeedsLogin(false);
      const choice = new URLSearchParams(window.location.search).get('action');
      if (choice === 'approve' || choice === 'reject' || choice === 'adjust')
        setAction(choice);
    }, (failure) => {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not load this request.',
      );
      setNeedsLogin(failure instanceof ApiError && failure.status === 401);
    }), [root]);
  useEffect(() => {
    void load();
  }, [load]);
  async function decide(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      setValue(
        await api<RequestDetails>(root + '/decision', {
          expected_revision: value.revision,
          action: action === 'reject' ? 'reject' : 'approve',
          ...(action === 'reject'
            ? {}
            : { limit: action === 'approve' ? value.requested_limit : limit }),
        }),
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not save this decision.',
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="limit-decision-page">
      <Link href="/">Helvetic Lens</Link>
      <h1>Dossier limit request</h1>
      {error && <p role="alert">{error}</p>}
      {needsLogin && (
        <Button onClick={() => setLogin(true)}>Sign in to review</Button>
      )}
      {!value && !error && <p>Loading request…</p>}
      {value && (
        <>
          <p>
            <strong>{value.user.name}</strong> · {value.user.email}
          </p>
          <p>
            {value.allowance.used} dossiers · current limit{' '}
            {value.allowance.limit} · requested total {value.requested_limit}
          </p>
          <blockquote>{value.reason}</blockquote>
          {value.status !== 'pending' ? (
            <output>
              {value.status === 'approved'
                ? `Approved. The account limit is ${value.approved_limit} dossiers.`
                : 'This request was declined.'}
            </output>
          ) : (
            <form onSubmit={decide}>
              <label htmlFor="limit-decision">Decision</label>
              <select
                id="limit-decision"
                value={action}
                disabled={busy}
                onChange={(event) =>
                  setAction(event.target.value as typeof action)
                }
              >
                <option value="approve">Approve requested total</option>
                <option value="adjust">Approve a different total</option>
                <option value="reject">Reject request</option>
              </select>
              {action === 'adjust' && (
                <>
                  <label htmlFor="approved-limit">
                    New total dossier limit
                  </label>
                  <input
                    id="approved-limit"
                    type="number"
                    min={value.allowance.limit + 1}
                    max={100000}
                    required
                    step={1}
                    value={limit}
                    disabled={busy}
                    onChange={(event) => setLimit(Number(event.target.value))}
                  />
                </>
              )}
              <p className="muted">
                This changes the user’s shared allowance in Legal and Pharma.
                Existing research is retained.
              </p>
              <Button type="submit" disabled={busy}>
                {busy
                  ? 'Saving decision…'
                  : action === 'reject'
                    ? 'Confirm rejection'
                    : 'Confirm approval'}
              </Button>
            </form>
          )}
        </>
      )}
      <AuthDialog
        open={login}
        onClose={() => setLogin(false)}
        onSuccess={async () => {
          setLogin(false);
          await load();
        }}
      />
    </main>
  );
}
