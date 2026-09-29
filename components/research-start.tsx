'use client';
import { useRef, useState } from 'react';
import { api, uid } from '@/lib/api';
import { product } from '@/lib/product';
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
  const sending = useRef(false);
  const pending = useRef<{
    request_key: string;
    question: string;
    public_monitoring_confirmed: true;
  } | null>(null);
  async function start() {
    if (sending.current || question.trim().length < 5) return;
    if (!signedIn) {
      onSignIn?.();
      return;
    }
    if (!canCreate) return;
    pending.current ||= {
      request_key: uid(),
      question: question.trim(),
      public_monitoring_confirmed: true,
    };
    sending.current = true;
    setFrozen(true);
    setBusy(true);
    setError('');
    try {
      const result = await api<{
        dossier_id: string;
        investigation: { id: string } | null;
      }>(`/products/${product.id}/start`, pending.current);
      const focus = result.investigation
        ? `&research=${encodeURIComponent(result.investigation.id)}`
        : '';
      window.location.assign(
        `/?dossier=${encodeURIComponent(result.dossier_id)}${focus}`,
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
      <p className="chapter-kicker">{product.eyebrow} / Your next dossier</p>
      <h2 id="research-start-heading">
        What would you like to understand and follow?
      </h2>
      <p>
        Ask once. We look for sources, build an evidence-backed dossier and
        check for changes.
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
          Starting sends your question to public research providers and enables
          daily checks. Your dossier stays private. Updates appear here; you can
          pause monitoring at any time.
        </p>
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
              busy || question.trim().length < 5 || (signedIn && !canCreate)
            }
          >
            {busy
              ? 'Starting your dossier…'
              : !signedIn
                ? 'Sign in to start'
                : frozen
                  ? 'Retry safely'
                  : 'Start research & monitoring'}
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
      <details className="question-start-details">
        <summary>How it works</summary>
        <p>
          We plan the investigation, search public sources, read the evidence
          and show findings with citations. Gaps and unavailable sources remain
          visible.
        </p>
        <p>
          The first investigation can use up to 24 searches and 12 source reads.
          Daily checks begin tomorrow, using one question and up to 3 source
          reads per check. Capacity and source access can delay a check.
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
