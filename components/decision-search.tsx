'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, LoaderCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { api, date, uid } from '@/lib/api';
import type { Preset, SearchHit } from '@/lib/contracts';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import {
  type DecisionMode,
  type DecisionReadiness,
  type DecisionRun,
  engineIssue,
  percent,
} from '@/lib/decision-search';

export function SearchComparison({ result }: { result: DecisionRun }) {
  return (
    <section
      className="decision-comparison"
      aria-label="Decision engine comparison"
    >
      <div className="section-header">
        <h3>How the search was judged</h3>
        <span className="muted">
          {result.latency_ms == null
            ? ''
            : `${(result.latency_ms / 1000).toFixed(2)} s total`}
        </span>
      </div>
      <p className="muted">
        In comparison mode, both engines use the same query and source snippets.
        Your labels measure agreement on this search; model confidence is a
        separate estimate.
      </p>
      <div className="decision-engine-grid">
        {result.engines?.map((engine) => (
          <article className="decision-engine" key={engine.engine}>
            <h4>
              {engine.engine === 'jev' ? 'Jev · hosted' : 'Laya · local'}{' '}
              {result.selected_engine === engine.engine && (
                <span className="tag">Used for ordering</span>
              )}
            </h4>
            <p>{engineIssue(engine.error)}</p>
            <dl>
              <div>
                <dt>Decision latency</dt>
                <dd>{(engine.latency_ms / 1000).toFixed(2)} s</dd>
              </div>
              <div>
                <dt>Accuracy on your labels</dt>
                <dd>
                  {percent(engine.evaluation.accuracy)} ·{' '}
                  {engine.evaluation.labelled_count}/
                  {engine.evaluation.candidate_count} reviewed
                </dd>
              </div>
              <div>
                <dt>Mean answer probability</dt>
                <dd>{percent(engine.mean_selected_probability)}</dd>
              </div>
              <div>
                <dt>Provider confidence</dt>
                <dd>{percent(engine.mean_confidence)}</dd>
              </div>
              <div>
                <dt>Estimated inference cost</dt>
                <dd>
                  {engine.estimated_cost_usd == null
                    ? 'Unknown'
                    : `US$${engine.estimated_cost_usd.toFixed(8)}`}
                </dd>
              </div>
            </dl>
            <details>
              <summary>Measurement details</summary>
              <p>{engine.models.join(', ') || 'No verified model response'}</p>
              <p>
                Reported tokens: {engine.input_tokens ?? 'unknown'} input,{' '}
                {engine.output_tokens ?? 'unknown'} output. Failed attempts may
                have unreported usage.
              </p>
              {engine.cost_basis && (
                <p>
                  Estimate at US${engine.cost_basis.input_usd_per_million} per
                  million input and US$
                  {engine.cost_basis.output_usd_per_million} per million output
                  tokens.
                </p>
              )}
              <p>
                Search-index and hosting costs are excluded. Local compute cost
                is unknown. These are estimates, not invoices.
              </p>
              <p>
                Jev and Laya define provider confidence differently. Mean answer
                probability uses the probability of each selected answer;
                neither measure proves correctness.
              </p>
              <p>
                {engine.evaluation.basis} Brier score:{' '}
                {engine.evaluation.brier_score == null
                  ? 'not measured'
                  : engine.evaluation.brier_score.toFixed(4)}
                .
              </p>
            </details>
          </article>
        ))}
      </div>
      <p className="muted">
        Label only results you have reviewed. Labels stay private and are not
        sent to providers or used to train models.
      </p>
    </section>
  );
}

export function DecisionDiscovery({
  initialQuery = '',
  canSearch,
  onSave,
  onCreate,
}: {
  initialQuery?: string;
  canSearch: boolean;
  onSave?: (hit: SearchHit) => Promise<void>;
  onCreate?: (seed: Preset) => void;
}) {
  const base = `/products/${product.id}/discover`;
  const queryId = useId();
  const [query, setQuery] = useState(initialQuery),
    [mode, setMode] = useState<DecisionMode>('auto'),
    [depth, setDepth] = useState('balanced');
  const [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(''),
    [failure, setFailure] = useState('');
  const [result, setResult] = useState<DecisionRun | null>(null),
    [saved, setSaved] = useState<string[]>([]),
    [offset, setOffset] = useState(0);
  const readiness = useResource<DecisionReadiness>(`${base}/engines`);
  const history = useResource<{
    items: Pick<
      DecisionRun,
      'id' | 'query' | 'mode' | 'status' | 'created_at'
    >[];
  }>(`${base}/runs?offset=${offset}`);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function perform(label: string, work: () => Promise<void>) {
    if (busy) return;
    setBusy(label);
    setFailure('');
    try {
      await work();
    } catch (error) {
      if (active.current) setFailure((error as Error).message);
    } finally {
      if (active.current) setBusy('');
    }
  }
  async function search() {
    if (!confirmed || !canSearch) return;
    const fingerprint = JSON.stringify({ query: query.trim(), mode, depth });
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: uid() };
    const found = await api<DecisionRun>(`${base}/decision`, {
      request_key: attempt.current.key,
      query: query.trim(),
      mode,
      depth,
      public_query_confirmed: true,
    });
    if (!active.current) return;
    setResult(found);
    setSaved([]);
    if (found.status !== 'running') attempt.current = null;
    await history.refresh();
  }
  async function open(id: string) {
    const found = await api<DecisionRun>(`${base}/runs/${id}`);
    if (active.current) {
      setResult(found);
      setSaved([]);
    }
  }
  async function inspect(sourceId: string) {
    if (!result) return;
    const updated = await api<DecisionRun>(
      `${base}/runs/${result.id}/inspect`,
      { source_id: sourceId, public_fetch_confirmed: true },
    );
    if (active.current) setResult(updated);
  }
  async function label(sourceId: string, relevant: boolean | null) {
    if (!result) return;
    const updated = await api<DecisionRun>(`${base}/runs/${result.id}/labels`, {
      expected_revision: result.revision,
      source_id: sourceId,
      relevant,
    });
    if (active.current) setResult(updated);
  }
  return (
    <div className="decision-discovery">
      <form
        className="decision-form"
        onSubmit={(e) => {
          e.preventDefault();
          void perform('search', search);
        }}
      >
        <label htmlFor={queryId}>
          <span>What do you want to find?</span>
          <Input
            id={queryId}
            aria-label="Public web query"
            value={query}
            required
            minLength={2}
            maxLength={300}
            disabled={!!busy}
            onChange={(e) => {
              setQuery(e.target.value);
              setConfirmed(false);
            }}
            placeholder={
              product.id === 'pharma'
                ? 'Evidence, medicines, safety or regulatory change…'
                : 'A legal question, judgment or regulatory change…'
            }
          />
        </label>
        <div className="decision-controls">
          <NativeSelect
            aria-label="Decision engine"
            value={mode}
            disabled={!!busy}
            onChange={(e) => {
              setMode(e.target.value as DecisionMode);
              setConfirmed(false);
            }}
          >
            <NativeSelectOption value="auto">
              Jev → Laya fallback
            </NativeSelectOption>
            <NativeSelectOption value="compare">
              Compare Jev + Laya
            </NativeSelectOption>
            <NativeSelectOption value="laya">
              Laya · local decisions
            </NativeSelectOption>
            <NativeSelectOption value="jev">Jev only</NativeSelectOption>
          </NativeSelect>
          <NativeSelect
            aria-label="Search depth"
            value={depth}
            disabled={!!busy}
            onChange={(e) => {
              setDepth(e.target.value);
              setConfirmed(false);
            }}
          >
            <NativeSelectOption value="quick">
              Quick · up to 8 sources
            </NativeSelectOption>
            <NativeSelectOption value="balanced">
              Broad · up to 24 sources
            </NativeSelectOption>
            <NativeSelectOption value="deep">
              Deep · up to 36 sources
            </NativeSelectOption>
          </NativeSelect>
          <Button
            type="submit"
            disabled={
              !!busy ||
              !canSearch ||
              !confirmed ||
              query.trim().length < 2 ||
              readiness.data?.search_configured === false
            }
          >
            {busy === 'search' ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Search size={17} />
            )}
            {busy === 'search' ? 'Searching and judging…' : 'Search the web'}
          </Button>
        </div>
        <label className="decision-consent">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={!!busy || !canSearch}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>
            This query is suitable for public web search. Send it to the
            selected web indexes and public catalogues
            {mode !== 'laya'
              ? ' and to Jev together with returned source snippets'
              : '; evaluate the returned snippets locally with Laya'}
            . No private dossier text is added.
          </span>
        </label>
      </form>
      {!canSearch && (
        <p className="banner">
          A workspace administrator can run web searches. Team knowledge and
          source catalogues remain available.
        </p>
      )}
      <details className="decision-setup">
        <summary>Connections and search scope</summary>
        {readiness.data ? (
          <>
            <p>
              Jev:{' '}
              {readiness.data.jev_configured
                ? 'configured'
                : 'connection needed'}{' '}
              · Laya:{' '}
              {readiness.data.laya_configured
                ? 'configured'
                : 'connection needed'}{' '}
              · Web index:{' '}
              {readiness.data.search_configured
                ? 'configured'
                : 'connection needed'}
              . Configuration does not guarantee availability.
            </p>
            <p>{readiness.data.privacy}</p>
            <p>
              {readiness.data.retention} Platform daily limit:{' '}
              {readiness.data.daily_limit} searches.
            </p>
          </>
        ) : (
          <p>{readiness.error || 'Checking provider configuration…'}</p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void readiness.refresh()}
        >
          Refresh connections
        </Button>
      </details>
      {failure && (
        <p role="alert" className="banner error">
          {failure}
        </p>
      )}
      {result && (
        <section aria-live="polite">
          <div className="search-result-heading">
            <h3>Results for “{result.query}”</h3>
            <span>{date(result.checked_at)}</span>
          </div>
          {result.error && <output className="banner">{result.error}</output>}
          {result.status === 'running' && (
            <p className="banner">
              This request is still running. Refresh its saved result to recover
              without starting another paid search.
            </p>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={!!busy}
            onClick={() => void perform('refresh', () => open(result.id))}
          >
            Refresh saved result
          </Button>
          {result.coverage && <p className="search-scope">{result.coverage}</p>}
          {result.retrieval && (
            <p className="muted">
              {result.items.length} sources · {result.retrieval.index} index ·{' '}
              {(result.retrieval.latency_ms / 1000).toFixed(2)} s retrieval
              {result.retrieval.omitted_records
                ? ` · ${result.retrieval.omitted_records} unsafe, duplicate or unusable records omitted`
                : ''}
              .{' '}
              {result.selected_engine
                ? `${result.selected_engine === 'jev' ? 'Jev' : 'Laya'} semantic judgments are combined with exact terms and index rank.`
                : 'Search-index order.'}
            </p>
          )}
          {result.retrieval?.lanes && (
            <ul className="decision-lanes">
              {result.retrieval.lanes.map((lane) => (
                <li key={lane.name}>
                  {lane.name}:{' '}
                  {lane.status === 'complete'
                    ? `${lane.count} candidates`
                    : 'unavailable'}
                </li>
              ))}
            </ul>
          )}
          {result.retrieval?.ordering && (
            <details>
              <summary>Why this order?</summary>
              <p>{result.retrieval.ordering}</p>
            </details>
          )}
          {!!result.engines?.length && <SearchComparison result={result} />}
          {result.status === 'complete' && !result.items.length && (
            <p>
              No usable links were returned for this query. Try broader terms;
              this does not establish that relevant evidence is absent.
            </p>
          )}
          <div className="discovery-results">
            {result.items.map((hit) => (
              <article key={hit.id} className="decision-hit">
                <div className="search-hit-kind">
                  {new URL(hit.url).hostname} · search snippet
                </div>
                <h3>
                  <a href={hit.url} target="_blank" rel="noreferrer">
                    {hit.title} <ArrowUpRight size={15} />
                  </a>
                </h3>
                <p>
                  {hit.summary ||
                    'No snippet supplied. Open the source to assess it.'}
                </p>
                <div className="decision-scores">
                  {result.engines
                    ?.filter((e) => e.scores[hit.id])
                    .map((e) => (
                      <span key={e.engine}>
                        {e.engine === 'jev' ? 'Jev' : 'Laya'} relevance{' '}
                        {percent(e.scores[hit.id].relevance)}
                      </span>
                    ))}
                </div>
                <div className="search-hit-actions">
                  <span>Your assessment:</span>
                  {([true, false, null] as const).map((value) => (
                    <Button
                      key={String(value)}
                      size="sm"
                      variant={
                        result.labels[hit.id] === value ||
                        (value === null && result.labels[hit.id] === undefined)
                          ? 'secondary'
                          : 'outline'
                      }
                      disabled={!!busy || !canSearch}
                      onClick={() =>
                        void perform('label', () => label(hit.id, value))
                      }
                    >
                      {value === true
                        ? 'Relevant'
                        : value === false
                          ? 'Not relevant'
                          : 'Unreviewed'}
                    </Button>
                  ))}
                  {onSave && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy || saved.includes(hit.id)}
                      onClick={() =>
                        void perform('save', async () => {
                          await onSave(hit);
                          if (active.current) setSaved((v) => [...v, hit.id]);
                        })
                      }
                    >
                      {saved.includes(hit.id) ? 'Source saved' : 'Save source'}
                    </Button>
                  )}
                  {onCreate && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() =>
                        onCreate({
                          name: result.query.slice(0, 120),
                          goal: `Monitor developments related to: ${result.query}`,
                          sector:
                            product.id === 'pharma'
                              ? 'Pharmaceuticals'
                              : 'Legal services',
                          source_requests: [
                            {
                              id: uid(),
                              label: hit.title.slice(0, 200),
                              url: hit.url,
                              kind: 'signals',
                              status: 'requested',
                            },
                          ],
                        })
                      }
                    >
                      Monitor from this source
                    </Button>
                  )}
                </div>
                <details className="decision-inspection">
                  <summary>Read this source and follow its links</summary>
                  <p>
                    Fetch this public page anonymously and select relevant
                    passages
                    {result.mode === 'laya'
                      ? ' locally with Laya'
                      : result.mode === 'jev'
                        ? ' using Jev only'
                        : ' using Jev, with Laya as fallback'}
                    . Excerpts are sent to the selected engine. Access
                    restrictions and robots rules are respected.
                  </p>
                  {!result.inspections?.[hit.id] && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy || !canSearch}
                      onClick={() =>
                        void perform('inspect', () => inspect(hit.id))
                      }
                    >
                      {busy === 'inspect' ? 'Reading…' : 'Read public source'}
                    </Button>
                  )}
                  {result.inspections?.[hit.id] && (
                    <div>
                      {result.inspections[hit.id].status === 'running' && (
                        <p>
                          Inspection is running. Refresh the saved result to
                          recover it.
                        </p>
                      )}
                      {result.inspections[hit.id].error && (
                        <output>{result.inspections[hit.id].error}</output>
                      )}
                      {result.inspections[hit.id].excerpts?.map((excerpt) => (
                        <blockquote key={excerpt.passage}>
                          <p>{excerpt.text}</p>
                          <cite>
                            Extracted passage {excerpt.passage} · relevance{' '}
                            {percent(excerpt.relevance)}
                          </cite>
                        </blockquote>
                      ))}
                      {result.inspections[hit.id].fetched_at && (
                        <p>
                          Read{' '}
                          {date(result.inspections[hit.id].fetched_at || null)}{' '}
                          ·{' '}
                          {result.inspections[hit.id].engine ||
                            'Lexical selection'}{' '}
                          · {result.inspections[hit.id].extracted_characters}{' '}
                          extracted characters. Inspection usage is separate
                          from the search comparison above.
                        </p>
                      )}
                      <p>{result.inspections[hit.id].scope}</p>
                      {!!result.inspections[hit.id].links?.length && (
                        <>
                          <h4>Links found in the document</h4>
                          <ul>
                            {result.inspections[hit.id].links?.map((link) => (
                              <li key={link.url}>
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {link.title} ↗
                                </a>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={!!busy}
                                  onClick={() => {
                                    setQuery(link.title.slice(0, 300));
                                    setConfirmed(false);
                                  }}
                                >
                                  Explore this topic
                                </Button>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </details>
              </article>
            ))}
          </div>
          {onSave && !!result.items.length && (
            <p className="muted">
              Save within 30 minutes of retrieval. Saving preserves the exact
              query, snippet and original link; approval and monitoring are
              separate steps.
            </p>
          )}
        </section>
      )}
      <details className="decision-history">
        <summary>Your saved searches</summary>
        <p className="muted">Private to your account in this workspace.</p>
        {history.error && <p role="alert">{history.error}</p>}
        {history.data?.items.map((item) => (
          <div className="decision-history-row" key={item.id}>
            <Button
              variant="ghost"
              disabled={!!busy}
              onClick={() => void perform('open', () => open(item.id))}
            >
              {item.query}
            </Button>
            <span>
              {item.mode} · {date(item.created_at)}
            </span>
          </div>
        ))}
        {history.data?.items.length === 0 && (
          <p>No saved searches on this page.</p>
        )}
        <div className="decision-controls">
          <Button
            size="sm"
            variant="outline"
            disabled={!!busy || offset === 0}
            onClick={() => setOffset((v) => Math.max(0, v - 20))}
          >
            Newer
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={
              !!busy || (history.data?.items.length || 0) < 20 || offset >= 40
            }
            onClick={() => setOffset((v) => v + 20)}
          >
            Older
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void history.refresh()}
          >
            Refresh list
          </Button>
        </div>
      </details>
    </div>
  );
}
