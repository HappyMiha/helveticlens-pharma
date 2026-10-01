'use client';
import { useEffect, useRef, useState } from 'react';
import { api, uid } from '@/lib/api';
import { product } from '@/lib/product';
import type { DossierAllowance } from '@/lib/dossier-allowance';
import { DossierLimitRequest } from './dossier-limit-request';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

export function ResearchStart({
  onMonitoring,
  onCancel,
  signedIn = true,
  canCreate = true,
  onSignIn,
}: {
  onMonitoring?: () => void;
  onCancel?: () => void;
  signedIn?: boolean;
  canCreate?: boolean;
  onSignIn?: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [error, setError] = useState('');
  const [allowance, setAllowance] = useState<DossierAllowance | null>(null);
  const [allowanceError, setAllowanceError] = useState('');
  useEffect(() => {
    if (!signedIn || !canCreate) return;
    const controller = new AbortController();
    void api<DossierAllowance>(
      `/products/${product.id}/research-allowance`,
      undefined,
      undefined,
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) setAllowance(value);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setAllowanceError(
            failure instanceof Error
              ? failure.message
              : 'Could not load research availability.',
          );
      });
    return () => controller.abort();
  }, [signedIn, canCreate]);
  const sending = useRef(false);
  const pending = useRef<{
    request_key: string;
    question: string;
    public_query_confirmed: true;
  } | null>(null);
  async function start() {
    if (sending.current || question.trim().length < 5) return;
    if (!signedIn) {
      onSignIn?.();
      return;
    }
    if (!canCreate || (!frozen && allowance?.remaining === 0)) return;
    pending.current ||= {
      request_key: uid(),
      question: question.trim(),
      public_query_confirmed: true,
    };
    sending.current = true;
    setFrozen(true);
    setBusy(true);
    setError('');
    try {
      const result = await api<{
        dossier_id: string;
        investigation: { id: string } | null;
      }>(`/products/${product.id}/explore`, pending.current);
      window.location.assign(
        `/?dossier=${encodeURIComponent(result.dossier_id)}`,
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not start. Retry safely with the same question.',
      );
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="research-start"
      aria-labelledby="research-start-heading"
    >
      <p className="chapter-kicker">{product.eyebrow} / Start exploring</p>
      <h2 id="research-start-heading">What are you trying to understand?</h2>
      <p>
        A rough question is enough. We explore its possible meaning, read
        sources and help you choose where to look next.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void start();
        }}
      >
        <label htmlFor="research-question">Your question</label>
        <Textarea
          id="research-question"
          required
          minLength={5}
          maxLength={300}
          value={question}
          disabled={busy || frozen}
          onChange={(event) => setQuestion(event.target.value)}
          rows={4}
          placeholder={
            product.id === 'pharma'
              ? 'What is changing in Swiss GLP-1 approvals and safety evidence?'
              : 'What is changing in Swiss rules on using AI at work?'
          }
        />
        <p className="investigation-muted" id="question-start-disclosure">
          Starting sends this question to public research providers. Your
          research stays private. Recurring monitoring is off until you choose
          to enable it.
        </p>
        <p className="investigation-muted" aria-live="polite">
          {allowance
            ? `${allowance.remaining} dossier places available.`
            : '3 dossiers per account, shared across Legal and Pharma.'}{' '}
          Continuing existing research is included.
        </p>
        {allowanceError && (
          <p className="investigation-muted">{allowanceError}</p>
        )}
        {error && (
          <p role="alert" className="investigation-error">
            {error}
          </p>
        )}
        {signedIn && !canCreate && (
          <p>
            Your workspace role can read dossiers. An administrator can start a
            new one.
          </p>
        )}
        <div className="research-start-actions">
          <Button
            type="submit"
            aria-describedby="question-start-disclosure"
            disabled={
              busy ||
              question.trim().length < 5 ||
              (signedIn && !canCreate) ||
              (!frozen && allowance?.remaining === 0)
            }
          >
            {busy
              ? 'Starting exploration…'
              : !signedIn
                ? 'Sign in to start'
                : frozen
                  ? 'Retry safely'
                  : allowance?.remaining === 0
                    ? 'Request a higher dossier limit below'
                    : 'Start exploring'}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
        {!signedIn && (
          <p className="investigation-muted">
            Your question stays here while you sign in.
          </p>
        )}
      </form>
      {signedIn && canCreate && allowance && (
        <DossierLimitRequest value={allowance} onUpdated={setAllowance} />
      )}
      <details className="question-start-details">
        <summary>How it works</summary>
        <p>
          We plan the investigation, search public sources, read the evidence
          and show findings with citations. Gaps and unavailable sources remain
          visible.
        </p>
        <p>
          We read the relevant documents in full, analyse their sections and
          check contradictions before bringing the answer together. Progress is
          saved, so you can leave and return. Unreadable material and unresolved
          questions stay visible; internal request budgets do not stop a started
          research mission.
        </p>
        <p>
          Follow-up search questions come from public evidence. Selected
          evidence is analysed by the workspace model. Private notes and files
          are not sent as public search queries. No emails or public publication
          are enabled.
        </p>
        {onMonitoring && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onMonitoring}
          >
            Set up topics and sources manually
          </Button>
        )}
      </details>
    </section>
  );
}
