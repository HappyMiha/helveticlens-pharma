'use client';
import { useRef, useState } from 'react';
import { api, uid } from '@/lib/api';
import { product } from '@/lib/product';
import type { DossierRecord } from '@/lib/contracts';
import type { Investigation } from '@/lib/investigation';
import { defaultResearchLimits } from '@/lib/research-engine';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { PUBLIC_QUERY_DISCLOSURE } from './universal-ask-search';

export function ResearchStart({
  onMonitoring,
  onCancel,
}: {
  onMonitoring: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [order, setOrder] = useState<'jev_first' | 'laya_first'>('jev_first');
  const [busy, setBusy] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<DossierRecord | null>(null);
  const pending = useRef<{
    key: string;
    title: string;
    question: string;
    order: typeof order;
  } | null>(null);
  async function start() {
    if (
      busy ||
      !confirmed ||
      title.trim().length < 2 ||
      question.trim().length < 5
    )
      return;
    pending.current ||= {
      key: uid(),
      title: title.trim(),
      question: question.trim(),
      order,
    };
    const value = pending.current;
    setFrozen(true);
    setBusy(true);
    setError('');
    try {
      const root = `/products/${product.id}/dossiers`;
      const dossier =
        saved ||
        (await api<DossierRecord>(root, {
          creation_key: value.key,
          step: 0,
          config: {
            name: value.title,
            goal: value.question,
            topics: [],
            source_pack_ids: [],
            source_requests: [],
            delivery: 'off',
            delivery_consent: false,
          },
        }));
      setSaved(dossier);
      const research = await api<Investigation>(
        `${root}/${dossier.id}/investigations`,
        {
          request_key: value.key,
          question: value.question,
          public_query_confirmed: true,
          engine: 'iterative-v1',
          decision_order: value.order,
          limits: defaultResearchLimits,
        },
      );
      window.location.assign(
        `/?dossier=${encodeURIComponent(dossier.id)}&research=${encodeURIComponent(research.id)}`,
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not start research. Your saved dossier is retained.',
      );
      setBusy(false);
    }
  }
  return (
    <section
      className="research-start"
      aria-labelledby="research-start-heading"
    >
      <p className="chapter-kicker">New dossier / Research</p>
      <h2 id="research-start-heading">What would you like to understand?</h2>
      <p>
        Start with a question. Helvetic Lens plans the research, follows the
        evidence and keeps unanswered questions visible.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void start();
        }}
      >
        <label htmlFor="research-title">Dossier title</label>
        <Input
          id="research-title"
          required
          minLength={2}
          maxLength={160}
          value={title}
          disabled={busy || frozen}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="A name for this dossier"
        />
        <label htmlFor="research-question">Research question</label>
        <Textarea
          id="research-question"
          required
          minLength={5}
          maxLength={300}
          value={question}
          disabled={busy || frozen}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="What do you want to find out, and which evidence would help?"
          rows={5}
        />
        <p className="investigation-muted">{PUBLIC_QUERY_DISCLOSURE}</p>
        <label className="research-consent">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={busy || frozen}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          Use this question for public-source research.
        </label>
        <details>
          <summary>Research scope & decision routing</summary>
          <p>
            Up to 8 directions, 4 follow-up levels, 24 search requests and 12
            source reads. You can continue from saved progress with an
            additional budget.
          </p>
          <label htmlFor="research-routing">First relevance decision</label>
          <select
            id="research-routing"
            value={order}
            disabled={busy || frozen}
            onChange={(event) => setOrder(event.target.value as typeof order)}
          >
            <option value="jev_first">Jev hosted · Laya fallback</option>
            <option value="laya_first">Laya local · Jev fallback</option>
          </select>
          <p>
            Uncertain candidates can be assessed by the workspace analysis
            model. Provider failures and research limits remain visible.
          </p>
        </details>
        {error && (
          <p role="alert" className="investigation-error">
            {error}
          </p>
        )}
        <div className="research-start-actions">
          <Button
            type="submit"
            disabled={
              busy ||
              !confirmed ||
              title.trim().length < 2 ||
              question.trim().length < 5
            }
          >
            {busy
              ? 'Starting research…'
              : frozen
                ? 'Retry starting research'
                : 'Start research'}
          </Button>
          {saved && (
            <a href={`/?dossier=${encodeURIComponent(saved.id)}`}>
              Open saved dossier
            </a>
          )}
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </form>
      <div className="research-mode-choice">
        <p>Want to follow changes in known topics and sources?</p>
        <Button variant="outline" disabled={busy} onClick={onMonitoring}>
          Set up monitoring
        </Button>
      </div>
    </section>
  );
}
