'use client';
import { EntityIdentities } from './entity-identity';
import { ClaimReviews } from './claim-review';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ResearchQuestions } from './research-questions';
import { ResearchBudget } from './research-budget';
import type { ResearchLimits } from '@/lib/research-engine';
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
import { OriginalContribution } from './dossier-contributions';
import { InvestigationFindings } from './investigation-findings';
import { ClaimEvolution } from './claim-evolution';
import { EvidenceSearch, type EvidenceSearchHandle } from './evidence-search';

export function DossierInvestigation({
  dossierId,
  canEdit,
  canContribute = false,
  userId,
  title = 'this dossier',
  focusRequest,
  onOpen,
  onReveal,
  onOpenMonitoring,
}: {
  onReveal?: () => void;
  onOpenMonitoring?: (id: string) => void;
  title?: string;
  focusRequest?: { id: string; tick: number; anchor?: string };
  onOpen: (id: string, anchor?: string) => void;
  dossierId: string;
  canEdit: boolean;
  canContribute?: boolean;
  userId?: string;
}) {
  const base = `/products/${product.id}/dossiers/${dossierId}/investigations`;
  const { register } = useAskSearch();
  const evidenceSearch = useRef<EvidenceSearchHandle>(null);
  const searchEvidence = useCallback(
    (query: string) => {
      onReveal?.();
      return evidenceSearch.current?.start(query);
    },
    [onReveal],
  );
  const [history, setHistory] = useState<InvestigationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(focusRequest?.id || '');
  const [stored, setValue] = useState<Investigation | null>(null);
  const value = stored?.id === selected ? stored : null;
  const canControl =
    canEdit ||
    !!(
      canContribute &&
      userId &&
      value?.trigger_entry_id &&
      value.created_by_user_id === userId
    );
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
        setHistory((old) => [
          ...page.items,
          ...old.filter(
            (row) => !page.items.some((item) => item.id === row.id),
          ),
        ]);
        setTotal(page.total);
        setSelected((old) => old || page.items[0]?.id || '');
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
  useEffect(() => {
    const focus = focusRequest;
    if (!focus) return;
    let active = true;
    const epoch = accessEpoch.current;
    api<Investigation>(`${base}/${focus.id}`)
      .then((next) => {
        if (!active || epoch !== accessEpoch.current) return;
        setHistory((old) => [next, ...old.filter((row) => row.id !== next.id)]);
        setSelected(next.id);
        setValue(next);
        setError('');
      })
      .catch((failure) => {
        if (active && epoch === accessEpoch.current)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Could not open the saved contribution review.',
          );
      });
    return () => {
      active = false;
    };
  }, [base, focusRequest]);
  useEffect(() => {
    if (focusRequest && focusRequest.id === value?.id) {
      const target = document.getElementById(
        focusRequest?.anchor || `investigation-${value?.id}`,
      );
      const details = target?.querySelector('details');
      if (details && focusRequest?.anchor?.startsWith('source-'))
        details.open = true;
      target?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      target?.setAttribute('tabindex', '-1');
      target?.focus({ preventScroll: true });
    }
  }, [focusRequest, value?.id]);
  const running = isRunning(value);
  useEffect(() => {
    if (!selected || running) return;
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [selected, running, refresh]);
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
      onReveal?.();
      setBusy(true);
      setError('');
      try {
        const next = await api<Investigation>(base, {
          ...pending.current,
          public_query_confirmed: true,
          engine: 'iterative-v1',
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
    [base, busy, canEdit, onReveal],
  );
  async function control(
    action: 'pause' | 'resume' | 'cancel' | 'retry' | 'deepen',
    limits?: ResearchLimits,
  ) {
    if (!value) return;
    setBusy(true);
    setError('');
    try {
      const next = await api<Investigation>(`${base}/${value.id}/control`, {
        action,
        ...(limits ? { limits } : {}),
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
    setLoading(true);
    try {
      const page = await api<{ items: InvestigationSummary[]; total: number }>(
        base,
      );
      setHistory(page.items);
      setTotal(page.total);
      setError('');
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
        searchEvidence,
      }),
    [
      register,
      searchEvidence,
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
          <h2>Research notebook</h2>
          <p>
            Ask a question. Keep the sources, findings and open questions
            together.
          </p>
        </div>
        <AskTrigger label="Ask this dossier" disabled={!canEdit} />
        <p className="investigation-muted">{PUBLIC_QUERY_DISCLOSURE}</p>
        {!canEdit && (
          <p className="investigation-muted">
            An owner or editor can start research. Contributors can analyse
            their own submissions.
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
            {busy ? 'Reloading…' : 'Reload saved research'}
          </Button>
        </div>
      )}
      <EvidenceSearch
        key={`saved-evidence:${dossierId}:${userId || ''}`}
        dossierId={dossierId}
        ref={evidenceSearch}
        onOpen={onOpen}
      />
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
          <div
            className="investigation-run-heading"
            id={`investigation-${value.id}`}
          >
            <div>
              <span className="investigation-status" data-status={value.status}>
                {readable(value.status)}
              </span>
              <p className="eyebrow">
                {value.trigger_entry_id
                  ? 'Contribution review'
                  : 'Research question'}
              </p>
              <h2>{value.question}</h2>
            </div>
            <div className="investigation-controls">
              {canControl &&
                ['completed', 'failed'].includes(value.status) &&
                value.branches.some((branch) => branch.status === 'failed') && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void control('retry')}
                  >
                    Retry unavailable steps
                  </Button>
                )}

              {canControl && running && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void control('pause')}
                >
                  <Pause size={14} />
                  Pause
                </Button>
              )}
              {canControl && value.status === 'paused' && (
                <Button
                  variant="outline"
                  disabled={
                    busy || (activeElsewhere && !value.trigger_entry_id)
                  }
                  onClick={() => void control('resume')}
                >
                  <Play size={14} />
                  Resume
                </Button>
              )}
              {canControl && (running || value.status === 'paused') && (
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
          {value.web_research_trigger && (
            <aside className="monitoring-research-status">
              <strong>Started by recurring public search</strong>
              <p>
                This run searches only the saved public question. Findings stay
                within this dossier.
              </p>
              <a
                href={`#web-trigger-${value.web_research_trigger.id}`}
                onClick={(event) => {
                  if (onOpenMonitoring) {
                    event.preventDefault();
                    onOpenMonitoring(event.currentTarget.hash.slice(1));
                  }
                }}
              >
                View schedule and search measurements
              </a>
            </aside>
          )}
          {value.monitoring_trigger && (
            <aside className="monitoring-research-status">
              <strong>
                {value.monitoring_trigger.source_kind === 'watched_page'
                  ? 'Started by a saved page change'
                  : 'Started by a new monitoring signal'}
              </strong>
              <p>{value.monitoring_trigger.source.title}</p>
              <a
                href={`#monitoring-trigger-${value.monitoring_trigger.id}`}
                onClick={(event) => {
                  if (onOpenMonitoring) {
                    event.preventDefault();
                    onOpenMonitoring(event.currentTarget.hash.slice(1));
                  }
                }}
              >
                Why it started and which settings applied
              </a>
            </aside>
          )}
          {value.original && (
            <OriginalContribution
              original={value.original}
              dossierId={dossierId}
            />
          )}
          {value.external_discovery === false && (
            <p className="investigation-muted">
              Private contribution review · no public web discovery. Findings
              retain their original evidence. Comparisons with earlier findings
              appear in Changes over time.
            </p>
          )}
          {value.research && (
            <ResearchBudget
              key={`${value.id}:${value.research.limits.branches}:${value.revision}`}
              value={value.research}
              canContinue={
                canControl &&
                !running &&
                !activeElsewhere &&
                value.status !== 'cancelled' &&
                (value.branches.some((branch) => branch.status === 'blocked') ||
                  value.research.questions.some(
                    (question) => !question.branch_id,
                  ))
              }
              busy={busy}
              onContinue={(limits) => control('deepen', limits)}
            />
          )}
          <LensAnalysisState value={value} />
          {counts && (
            <dl
              className="research-metrics"
              aria-label="Evidence in this investigation"
            >
              <LargeMetric
                value={counts.sources}
                label="Captured sources"
                href="#research-sources"
              />
              <LargeMetric
                value={counts.claims}
                label="Evidence-linked claims"
                href="#key-findings"
              />
              <LargeMetric
                value={counts.contested}
                label="Contested claims"
                href="#key-findings"
              />
            </dl>
          )}
          <nav className="dossier-section-nav" aria-label="Dossier sections">
            <a href="#key-findings">Findings</a>
            <a href="#research-sources">Sources</a>
            <a href="#research-timeline">Timeline</a>
            <a href="#open-questions">Open questions</a>
            <a href="#research-method">Method</a>
            <a href="#evidence-changes">Changes over time</a>
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
              {value.research && <ResearchQuestions value={value} />}
              <details open={value.research ? undefined : true}>
                <summary>Saved research paths & step status</summary>
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
              </details>
            </DossierSection>
            <TransparencyPanel value={value} />
          </div>
        </>
      )}
      <ClaimReviews
        key={`claim-reviews:${dossierId}:${userId || ''}`}
        base={`/products/${product.id}/dossiers/${dossierId}/claim-reviews`}
        refreshToken={value?.event_sequence || 0}
        onOpen={onOpen}
        onChange={() => {
          evidenceSearch.current?.invalidate();
          void refresh();
        }}
      />
      <EntityIdentities
        key={`entity-identities:${dossierId}:${userId || ''}`}
        base={`/products/${product.id}/dossiers/${dossierId}/entity-identities`}
        refreshToken={value?.event_sequence || 0}
        onOpen={onOpen}
        onChange={() => void refresh()}
      />
      <ClaimEvolution
        key={`claim-evolution:${dossierId}:${userId || ''}`}
        base={`/products/${product.id}/dossiers/${dossierId}/evidence-changes`}
        refreshToken={value?.event_sequence || 0}
        onOpen={onOpen}
        onChange={() => {
          evidenceSearch.current?.invalidate();
          void refresh();
        }}
      />
    </section>
  );
}
