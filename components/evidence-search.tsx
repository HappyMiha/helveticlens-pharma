'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useImperativeHandle,
  type Ref,
} from 'react';
import { Search } from 'lucide-react';
import { api, date } from '@/lib/api';
import { product } from '@/lib/product';
import { readable, sourceHref } from '@/lib/investigation';
import { currentEvidenceSearch, evidenceAnchor } from '@/lib/evidence-search';
import type {
  EvidenceSearchItem,
  EvidenceSearchMode,
  EvidenceSearchPage,
} from '@/lib/evidence-search';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { NativeSelect, NativeSelectOption } from './ui/native-select';
import { LensProgress } from './lens';

export type EvidenceSearchHandle = { start: (query: string) => void };

export function EvidenceSearch({
  dossierId,
  ref,
  onOpen,
}: {
  dossierId: string;
  ref?: Ref<EvidenceSearchHandle>;
  onOpen: (id: string, anchor?: string) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<EvidenceSearchMode>('semantic');
  const [stored, setStored] = useState<EvidenceSearchPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const epoch = useRef({ value: 0 });
  const base = `/products/${product.id}/dossiers/${dossierId}/evidence-search`;
  const page = currentEvidenceSearch(stored, dossierId, query, mode, error);
  const search = useCallback(
    async (
      question: string,
      method: EvidenceSearchMode,
      offset = 0,
      asOf?: string,
    ) => {
      const attempt = ++epoch.current.value;
      setStored(null);
      setError('');
      setBusy(true);
      try {
        const value = await api<EvidenceSearchPage>(base, {
          query: question.trim(),
          mode: method,
          offset,
          as_of: asOf,
        });
        if (epoch.current.value === attempt) setStored(value);
      } catch (failure) {
        if (epoch.current.value === attempt)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Search could not finish. Try again.',
          );
      } finally {
        if (epoch.current.value === attempt) setBusy(false);
      }
    },
    [base],
  );
  useEffect(() => {
    const counter = epoch.current;
    const clear = () => {
      epoch.current.value++;
      setStored(null);
      setQuery('');
      setBusy(false);
      setError('');
    };
    window.addEventListener('helvetic-session-changed', clear);
    return () => {
      counter.value++;
      window.removeEventListener('helvetic-session-changed', clear);
    };
  }, [base]);
  useImperativeHandle(
    ref,
    () => ({
      start(question) {
        setQuery(question);
        setMode('semantic');
        document
          .getElementById(`evidence-search-${dossierId}`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        void search(question, 'semantic');
      },
    }),
    [search, dossierId],
  );
  useEffect(() => {
    if (!page) return;
    let active = true;
    let checking = false;
    const check = async () => {
      if (checking) return;
      checking = true;
      try {
        await api(base, {
          query: page.query,
          mode: page.mode,
          offset: page.offset,
          as_of: page.as_of,
          check_only: true,
          fingerprint: page.fingerprint,
        });
      } catch {
        if (active) {
          setStored(null);
          setError(
            'Saved evidence or access could not be confirmed. Search again to see current results.',
          );
        }
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(() => void check(), 15000);
    window.addEventListener('focus', check);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, [base, page]);
  return (
    <section
      className="evidence-search"
      id={`evidence-search-${dossierId}`}
      aria-labelledby={`${id}-title`}
    >
      <div className="eyebrow">YOUR SAVED KNOWLEDGE</div>
      <h3 id={`${id}-title`}>Find the evidence you already have.</h3>
      <p>
        Search captured passages and source-linked findings in this dossier.
        Meaning search runs locally; your question and private evidence stay on
        the platform.
      </p>
      <form
        className="evidence-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && query.trim().length >= 2) void search(query, mode);
        }}
      >
        <label htmlFor={`${id}-query`}>
          Question or search words
          <Input
            id={`${id}-query`}
            value={query}
            maxLength={300}
            minLength={2}
            required
            disabled={busy}
            placeholder="What changed, and which source explains it?"
            onChange={(event) => {
              setQuery(event.target.value);
              setStored(null);
              setError('');
            }}
          />
        </label>
        <label htmlFor={`${id}-mode`}>
          Match by
          <NativeSelect
            id={`${id}-mode`}
            value={mode}
            disabled={busy}
            onChange={(event) => {
              setMode(event.target.value as EvidenceSearchMode);
              setStored(null);
              setError('');
            }}
          >
            <NativeSelectOption value="semantic">
              Meaning · local
            </NativeSelectOption>
            <NativeSelectOption value="literal">
              All words · no model
            </NativeSelectOption>
          </NativeSelect>
        </label>
        <Button type="submit" disabled={busy || query.trim().length < 2}>
          <Search size={16} />
          Search saved evidence
        </Button>
      </form>
      <p className="investigation-muted">
        Meaning compares 12 records at a time, newest first. Continue to older
        batches for more coverage. Words searches across the saved ledger.
        Typing alone sends nothing.
      </p>
      {busy && (
        <LensProgress
          activity={{
            state: mode === 'semantic' ? 'searching' : 'idle',
            label: 'Searching saved evidence',
            detail:
              mode === 'semantic'
                ? 'Checking permissions and comparing this batch locally.'
                : 'Finding all-word matches in permitted evidence.',
          }}
        />
      )}
      {error && (
        <p role="alert" className="investigation-error">
          {error}
        </p>
      )}
      {page && (
        <EvidenceSearchResults
          page={page}
          onOpen={onOpen}
          onPage={(offset) =>
            void search(page.query, page.mode, offset, page.as_of)
          }
        />
      )}
    </section>
  );
}

export function EvidenceSearchResults({
  page,
  onOpen,
  onPage,
}: {
  page: EvidenceSearchPage;
  onOpen: (id: string, anchor?: string) => void;
  onPage: (offset: number) => void;
}) {
  const literal = page.mode === 'literal';
  return (
    <div className="evidence-search-results" aria-live="polite">
      <output>
        {page.items.length}{' '}
        {literal || page.method === 'literal_fallback'
          ? 'results'
          : 'ranked candidates'}{' '}
        ·{' '}
        {literal
          ? `${page.matching_records} all-word matches`
          : `${page.examined_records} records in this batch`}{' '}
        · {page.total_records} saved records
      </output>
      {page.method === 'literal_fallback' && (
        <output>
          Local comparison was unavailable. These are word matches in this
          batch; switch to Words to search the full saved ledger.
        </output>
      )}
      {!page.items.length && (
        <p>
          {page.total_records === 0
            ? 'No captured evidence is available yet. Investigate a question or analyse a contribution to build this dossier.'
            : 'No match was returned in this search window. Try older evidence, another phrase or Words. This does not establish that evidence is absent.'}
        </p>
      )}
      {page.items.map((item) => (
        <EvidenceSearchResult key={item.id} item={item} onOpen={onOpen} />
      ))}
      <div className="evolution-tools">
        {page.offset > 0 && (
          <Button
            variant="outline"
            onClick={() => onPage(Math.max(0, page.offset - page.batch_size))}
          >
            Newer {literal ? 'matches' : 'evidence'}
          </Button>
        )}
        {page.next_offset !== null && (
          <Button variant="outline" onClick={() => onPage(page.next_offset!)}>
            Search older {literal ? 'matches' : 'evidence'}
          </Button>
        )}
      </div>
      <details className="evidence-search-method">
        <summary>Coverage & search measurements</summary>
        <p>{page.coverage}</p>
        <p>
          Time: {page.measurement.latency_ms.toFixed(0)} ms · Completed local
          requests: {page.measurement.requests_completed} · Cost: Unknown
        </p>
        <p>{page.measurement.cost_scope}</p>
        <p>
          Independent accuracy: not evaluated. {page.measurement.accuracy_basis}{' '}
          {page.measurement.confidence_definition}
        </p>
        {!!page.measurement.models.length && (
          <p>Model: {page.measurement.models.join(', ')}</p>
        )}
        <p>
          Records captured by {date(page.as_of)}. Current access is checked
          again while results are open.
        </p>
      </details>
    </div>
  );
}

export function EvidenceSearchResult({
  item,
  onOpen,
}: {
  item: EvidenceSearchItem;
  onOpen: (id: string, anchor?: string) => void;
}) {
  const href = sourceHref(item.url);
  return (
    <article className="evidence-search-result">
      <div className="eyebrow">
        {item.kind === 'claim'
          ? `Finding · ${readable(item.claim_status)} · revision ${item.claim_revision}`
          : 'Captured passage'}
      </div>
      <h4>{item.statement || item.title}</h4>
      <blockquote>{item.quote}</blockquote>
      {item.text_truncated && (
        <p>
          First 2,400 of {item.text_characters} retained characters. Open the
          source for the full captured passage.
        </p>
      )}
      <p className="investigation-muted">
        {item.title} · {item.locator} · {date(item.created_at)}
      </p>
      <div className="source-actions">
        <Button
          variant="outline"
          onClick={() => onOpen(item.investigation_id, evidenceAnchor(item))}
        >
          Open{' '}
          {item.kind === 'claim' ? 'finding & citations' : 'captured source'}
        </Button>
        {href && (
          <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
            Original source ↗
          </a>
        )}
      </div>
      <details>
        <summary>Why this result & provenance</summary>
        <p>
          {item.semantic_match
            ? 'The local model judged this record relevant.'
            : item.literal_match
              ? 'This record matched the search words.'
              : 'The model did not judge this record relevant. It remains visible for your review so an uncertain score cannot hide evidence.'}{' '}
          {item.literal_match && item.semantic_match
            ? 'It also matched all search words.'
            : ''}{' '}
          Relevance does not verify the finding.
        </p>
        {item.relevance_probability !== null && (
          <p>
            Model relevance probability: {item.relevance_probability.toFixed(3)}{' '}
            · Confidence: {item.confidence?.toFixed(3) ?? 'Unknown'}. These are
            model signals, not measured accuracy.
          </p>
        )}
        <code>SHA-256 {item.sha256}</code>
      </details>
    </article>
  );
}
