'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Pause,
  Play,
  Search,
  Square,
  Waypoints,
} from 'lucide-react';
import { api, date, uid } from '@/lib/api';
import { product } from '@/lib/product';
import { isRunning, readable } from '@/lib/investigation';
import type { Investigation, InvestigationSummary } from '@/lib/investigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { InvestigationFindings } from './investigation-findings';

export function DossierInvestigation({
  dossierId,
  canEdit,
}: {
  dossierId: string;
  canEdit: boolean;
}) {
  const base = `/products/${product.id}/dossiers/${dossierId}/investigations`;
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<InvestigationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState('');
  const [stored, setValue] = useState<Investigation | null>(null);
  const value = stored?.id === selected ? stored : null;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connection, setConnection] = useState('');
  const accessEpoch = useRef(0);
  const pending = useRef<{ request_key: string; question: string } | null>(
    null,
  );
  const currentSelection = useRef(selected);
  useEffect(() => {
    currentSelection.current = selected;
  }, [selected]);
  const refresh = useCallback(async () => {
    if (!selected) return;
    const epoch = accessEpoch.current;
    try {
      const next = await api<Investigation>(`${base}/${selected}`);
      if (
        currentSelection.current !== selected ||
        epoch !== accessEpoch.current
      )
        return;
      setValue((old) =>
        old && old.id === next.id && old.revision > next.revision ? old : next,
      );
      setHistory((old) => old.map((row) => (row.id === next.id ? next : row)));
      setError('');
    } catch (e) {
      if (
        currentSelection.current !== selected ||
        epoch !== accessEpoch.current
      )
        return;
      setValue(null);
      setError(
        e instanceof Error ? e.message : 'Could not load this investigation.',
      );
    }
  }, [base, selected]);
  useEffect(() => {
    let active = true;
    api<{ items: InvestigationSummary[]; total: number }>(base)
      .then((page) => {
        if (!active) return;
        setHistory(page.items);
        setTotal(page.total);
        setSelected(page.items[0]?.id || '');
        setLoading(false);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [base]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    const epoch = accessEpoch.current;
    api<Investigation>(`${base}/${selected}`)
      .then((next) => {
        if (!active || epoch !== accessEpoch.current) return;
        setValue((old) =>
          old && old.id === next.id && old.revision > next.revision
            ? old
            : next,
        );
        setHistory((old) =>
          old.map((row) => (row.id === next.id ? next : row)),
        );
        setError('');
      })
      .catch((e) => {
        if (!active || epoch !== accessEpoch.current) return;
        setValue(null);
        setError(
          e instanceof Error ? e.message : 'Could not load this investigation.',
        );
      });
    return () => {
      active = false;
    };
  }, [base, selected]);
  const running = isRunning(value);
  const cursor = useRef(0);
  useEffect(() => {
    cursor.current = 0;
  }, [selected]);
  useEffect(() => {
    if (!selected || !running) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const source = new EventSource(
      `/api${base}/${selected}/events?after=${cursor.current}`,
    );
    const changed = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 250);
    };
    source.addEventListener('activity', (event) => {
      cursor.current =
        Number((event as MessageEvent).lastEventId) || cursor.current;
      setConnection('Live activity connected');
      changed();
    });
    source.addEventListener('checkpoint', changed);
    source.addEventListener('access_changed', () => {
      source.close();
      accessEpoch.current++;
      setHistory([]);
      setValue(null);
      setConnection('');
      setError('Your access changed. Sign in again to reopen this dossier.');
    });
    source.onopen = () => setConnection('Live activity connected');
    source.onerror = () => setConnection('Reconnecting to saved progress…');
    // Polling is a reconnect fallback, never another research request.
    const fallback = setInterval(() => void refresh(), 15000);
    return () => {
      source.close();
      clearInterval(fallback);
      if (timer) clearTimeout(timer);
    };
  }, [base, selected, running, refresh]);
  async function start() {
    if (!question.trim() || busy) return;
    if (!pending.current || pending.current.question !== question.trim())
      pending.current = { request_key: uid(), question: question.trim() };
    setBusy(true);
    setError('');
    try {
      const next = await api<Investigation>(base, {
        ...pending.current,
        public_query_confirmed: true,
      });
      pending.current = null;
      setQuestion('');
      setHistory((old) => [next, ...old.filter((row) => row.id !== next.id)]);
      setTotal((old) => old + 1);
      setSelected(next.id);
      setValue(next);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not start the investigation.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function control(action: 'pause' | 'resume' | 'cancel') {
    if (!value) return;
    setBusy(true);
    setError('');
    try {
      const next = await api<Investigation>(`${base}/${value.id}/control`, {
        action,
        expected_revision: value.revision,
      });
      setValue(next);
      setHistory((old) => old.map((row) => (row.id === next.id ? next : row)));
    } catch (e) {
      await refresh();
      setError(
        e instanceof Error
          ? e.message
          : 'Refresh before trying this action again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function reloadLatest() {
    setBusy(true);
    setError('');
    try {
      const page = await api<{ items: InvestigationSummary[]; total: number }>(
        base,
      );
      setHistory(page.items);
      setTotal(page.total);
      const latest = page.items.find(isRunning) || page.items[0];
      setSelected(latest?.id || '');
      if (latest?.id === selected) await refresh();
    } catch (e) {
      setValue(null);
      setHistory([]);
      setError(
        e instanceof Error
          ? e.message
          : 'Could not reconnect to saved investigations.',
      );
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }
  async function older() {
    setBusy(true);
    try {
      const page = await api<{ items: InvestigationSummary[]; total: number }>(
        `${base}?offset=${history.length}`,
      );
      setHistory((old) => [
        ...old,
        ...page.items.filter((row) => !old.some((item) => item.id === row.id)),
      ]);
      setTotal(page.total);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not load older investigations.',
      );
    } finally {
      setBusy(false);
    }
  }
  const activeElsewhere = history.some(
    (row) => isRunning(row) && row.id !== value?.id,
  );
  return (
    <section
      className="dossier-investigation"
      aria-label="Dossier investigation"
    >
      <form
        className="investigation-ask"
        onSubmit={(event) => {
          event.preventDefault();
          void start();
        }}
      >
        <div className="eyebrow">
          <Waypoints size={15} /> Living research
        </div>
        <label htmlFor={`ask-${dossierId}`}>Ask this dossier</label>
        <p>
          Investigate a question and keep its sources, claims and follow-up
          research together.
        </p>
        <Textarea
          id={`ask-${dossierId}`}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={300}
          minLength={2}
          required
          rows={2}
          placeholder="What do you want to understand, verify or keep an eye on?"
          disabled={!canEdit || busy}
          aria-describedby={`privacy-${dossierId}`}
        />
        <div className="investigation-submit">
          <small id={`privacy-${dossierId}`}>
            Investigate sends this question and newly found public entity names
            to public search. Saved dossier evidence uses your workspace AI.
            Keep confidential details out of this field.
          </small>
          <Button
            type="submit"
            disabled={
              !canEdit ||
              busy ||
              question.trim().length < 2 ||
              running ||
              activeElsewhere
            }
          >
            <Search size={16} />
            {busy ? 'Saving…' : 'Investigate'}
            <ArrowUpRight size={15} />
          </Button>
        </div>
        {!canEdit && (
          <p className="investigation-muted">
            A workspace administrator can start or manage an investigation.
          </p>
        )}
      </form>
      {error && (
        <div role="alert" className="investigation-error">
          {error}
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void reloadLatest()}
          >
            Refresh
          </Button>
        </div>
      )}
      {loading && <output>Loading saved investigations…</output>}
      {!!history.length && (
        <div className="investigation-history">
          <label htmlFor={`history-${dossierId}`}>Investigations</label>
          <select
            id={`history-${dossierId}`}
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            {history.map((row) => (
              <option key={row.id} value={row.id}>
                {readable(row.status)} · {row.question}
              </option>
            ))}
          </select>
          {history.length < total && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void older()}
            >
              Older investigations
            </Button>
          )}
        </div>
      )}
      {value && (
        <>
          <div className="investigation-run-heading">
            <div>
              <span className="investigation-status" data-status={value.status}>
                {readable(value.status)}
              </span>
              <h2>{value.question}</h2>
              <p className="investigation-muted">
                {value.sources.length} sources · {value.claims.length} claims ·
                Plan {value.plan_version || 'pending'}
              </p>
            </div>
            <div className="investigation-controls">
              {canEdit && running && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void control('pause')}
                >
                  <Pause size={14} />
                  Pause
                </Button>
              )}
              {canEdit && value.status === 'paused' && (
                <Button
                  variant="outline"
                  disabled={busy || activeElsewhere}
                  onClick={() => void control('resume')}
                >
                  <Play size={14} />
                  Resume
                </Button>
              )}
              {canEdit && (running || value.status === 'paused') && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void control('cancel')}
                >
                  <Square size={14} />
                  Cancel
                </Button>
              )}
            </div>
          </div>
          <output aria-live="polite" className="investigation-muted">
            {running
              ? connection || 'Waiting for the next saved checkpoint…'
              : value.stop_reason}
          </output>
          <div className="investigation-layout">
            <InvestigationFindings value={value} />
            <aside className="investigation-progress">
              <h3>Research in motion</h3>
              <p className="investigation-muted">
                The plan develops when source evidence reveals something worth
                following.
              </p>
              <ol className="investigation-branches">
                {value.branches.map((branch) => (
                  <li key={branch.id}>
                    <span
                      className="investigation-status"
                      data-status={branch.status}
                    >
                      {readable(branch.status)}
                    </span>
                    <h4>{branch.query}</h4>
                    <p>{branch.reason}</p>
                    <small>
                      {readable(branch.phase)} ·{' '}
                      {
                        branch.steps.filter(
                          (step) => step.status === 'completed',
                        ).length
                      }{' '}
                      completed steps
                    </small>
                    {branch.error && (
                      <p className="investigation-error">{branch.error}</p>
                    )}
                  </li>
                ))}
              </ol>
              <details open>
                <summary>How the plan changed</summary>
                {value.plans.map((plan) => (
                  <div className="investigation-plan" key={plan.id}>
                    <strong>Plan {plan.version}</strong>
                    <p>{plan.reason}</p>
                    {plan.document.trigger && (
                      <a href={`#source-${plan.document.trigger.source_id}`}>
                        Triggering evidence
                      </a>
                    )}
                    <small>{date(plan.created_at)}</small>
                  </div>
                ))}
              </details>
              <details>
                <summary>
                  Activity · {value.activity.length} saved events
                </summary>
                <ol className="investigation-activity">
                  {value.activity.map((event) => (
                    <li key={event.sequence}>
                      <strong>{readable(event.kind)}</strong>
                      <p>
                        {event.detail.reason ||
                          event.detail.name ||
                          (event.detail.phase
                            ? readable(event.detail.phase)
                            : '')}
                      </p>
                      <small>{date(event.created_at)}</small>
                      {event.detail.capabilities && (
                        <ul>
                          {event.detail.capabilities.map((capability) => (
                            <li key={capability.id}>
                              {capability.description} ·{' '}
                              <strong>
                                {capability.available
                                  ? 'Available'
                                  : 'Unavailable'}
                              </strong>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              </details>
              <p className="investigation-muted">{value.coverage}</p>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
