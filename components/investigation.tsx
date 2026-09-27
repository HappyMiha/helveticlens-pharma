'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { api, uid } from '@/lib/api';
import { product } from '@/lib/product';
import { isRunning, readable } from '@/lib/investigation';
import type { Investigation, InvestigationSummary } from '@/lib/investigation';
import { Button } from '@/components/ui/button';
import {
  AskTrigger,
  PUBLIC_QUERY_DISCLOSURE,
  useAskSearch,
} from './universal-ask-search';
import { LensAnalysisState } from './lens';
import { LargeMetric, DossierSection } from './research-blocks';
import { TransparencyPanel, DossierTimeline } from './transparency-panel';
import { evidenceCounts } from '@/lib/lens';
import { InvestigationFindings } from './investigation-findings';

export function DossierInvestigation({
  dossierId,
  canEdit,
  title = 'this dossier',
}: {
  title?: string;
  dossierId: string;
  canEdit: boolean;
}) {
  const base = `/products/${product.id}/dossiers/${dossierId}/investigations`;
  const { register } = useAskSearch();
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
  const start = useCallback(
    async (question: string): Promise<boolean> => {
      if (question.trim().length < 2 || busy || !canEdit) return false;
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
        setHistory((old) => [next, ...old.filter((row) => row.id !== next.id)]);
        setTotal((old) => old + 1);
        setSelected(next.id);
        setValue(next);
        return true;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Could not start the investigation.',
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [base, busy, canEdit],
  );
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
  useEffect(
    () =>
      register({
        id: dossierId,
        title,
        canInvestigate: canEdit,
        unavailable: busy || running || activeElsewhere,
        investigate: start,
      }),
    [
      register,
      dossierId,
      title,
      canEdit,
      busy,
      running,
      activeElsewhere,
      start,
    ],
  );
  const counts = value ? evidenceCounts(value) : null;
  return (
    <section
      className="dossier-investigation"
      aria-label="Dossier investigation"
    >
      <div className="investigation-introduction">
        <div>
          <h2>Follow the evidence.</h2>
          <p>
            Ask a question. Keep the sources, findings and open questions
            together.
          </p>
        </div>
        <AskTrigger label="Ask this dossier" disabled={!canEdit} />
        <p className="investigation-muted">{PUBLIC_QUERY_DISCLOSURE}</p>
        {!canEdit && (
          <p className="investigation-muted">
            A workspace administrator can start or manage an investigation.
          </p>
        )}
      </div>
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
              <p className="eyebrow">Research question</p>
              <h2>{value.question}</h2>
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
          <LensAnalysisState value={value} />
          {counts && (
            <dl
              className="research-metrics"
              aria-label="Evidence in this investigation"
            >
              <LargeMetric value={counts.sources} label="Captured sources" />
              <LargeMetric
                value={counts.claims}
                label="Evidence-linked claims"
              />
              <LargeMetric value={counts.contested} label="Contested claims" />
            </dl>
          )}
          <nav className="dossier-section-nav" aria-label="Dossier sections">
            <a href="#key-findings">Findings</a>
            <a href="#research-sources">Sources</a>
            <a href="#research-timeline">Timeline</a>
            <a href="#open-questions">Open questions</a>
            <a href="#research-method">Method</a>
          </nav>
          <div className="investigation-layout">
            <InvestigationFindings value={value} />
            <DossierSection
              id="research-timeline"
              number="04"
              title="Research timeline"
            >
              <details>
                <summary>
                  {value.activity.length} saved events · open timeline
                </summary>
                <DossierTimeline value={value} />
              </details>
            </DossierSection>
            <DossierSection
              id="open-questions"
              number="05"
              title="Open questions & research paths"
            >
              <p className="investigation-muted">
                Each path retains its scope and unfinished work. A completed
                path does not establish exhaustive coverage.
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
            </DossierSection>
            <TransparencyPanel value={value} />
          </div>
        </>
      )}
    </section>
  );
}
