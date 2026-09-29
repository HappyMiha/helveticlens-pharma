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
import { claimDecisionLabels } from '@/lib/claim-review';
import {
  currentEvidenceSearch,
  evidenceAnchor,
  completeEvidenceSearch,
} from '@/lib/evidence-search';
import type {
  EvidenceSearchItem,
  EvidenceSearchMode,
  EvidenceSearchPage,
} from '@/lib/evidence-search';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { NativeSelect, NativeSelectOption } from './ui/native-select';
import { LensProgress } from './lens';

export type EvidenceSearchHandle = {
  start: (query: string) => void;
  invalidate: () => void;
};

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
  const [mode, setMode] = useState<EvidenceSearchMode>('corpus');
  const [stored, setStored] = useState<EvidenceSearchPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<EvidenceSearchPage | null>(null);
  const [notice, setNotice] = useState('');
  const controller = useRef<AbortController | null>(null);
  const epoch = useRef({ value: 0 });
  const base = `/products/${product.id}/dossiers/${dossierId}/evidence-search`;
  const page = currentEvidenceSearch(stored, dossierId, query, mode, error);
  const search = useCallback(
    async (
      question: string,
      method: EvidenceSearchMode,
      offset = 0,
      asOf?: string,
      fence?: string,
    ) => {
      controller.current?.abort();
      const currentController = new AbortController();
      controller.current = currentController;
      const attempt = ++epoch.current.value;
      setStored(null);
      setError('');
      setNotice('');
      setProgress(null);
      setBusy(true);
      try {
        const value = await completeEvidenceSearch(
          {
            query: question.trim(),
            mode: method,
            offset,
            as_of: asOf,
            fingerprint: fence,
          },
          (body) =>
            api<EvidenceSearchPage>(
              base,
              body,
              undefined,
              currentController.signal,
            ),
          () => epoch.current.value === attempt,
          (checkpoint) => setProgress(checkpoint),
        );
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
      controller.current?.abort();
      setProgress(null);
      setNotice('');
      setStored(null);
      setQuery('');
      setBusy(false);
      setError('');
    };
    window.addEventListener('helvetic-session-changed', clear);
    return () => {
      counter.value++;
      controller.current?.abort();
      window.removeEventListener('helvetic-session-changed', clear);
    };
  }, [base]);
  useImperativeHandle(
    ref,
    () => ({
      invalidate() {
        epoch.current.value++;
        controller.current?.abort();
        setStored(null);
        setProgress(null);
        setBusy(false);
        setError('');
        setNotice('Finding review changed. Search again to see current decisions and evidence.');
      },
      start(question) {
        setQuery(question);
        setMode('corpus');
        document
          .getElementById(`evidence-search-${dossierId}`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        void search(question, 'corpus');
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
          review_claim_ids: page.review_claim_ids,
          review_fingerprint: page.review_fingerprint,
        });
      } catch {
        if (active) {
          setStored(null);
          setError(
            'Saved evidence, finding reviews or access could not be confirmed. Search again to see current results.',
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
            <NativeSelectOption value="corpus">
              Meaning · all saved evidence
            </NativeSelectOption>
            <NativeSelectOption value="semantic">
              Direct comparison · 12 records
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
        Meaning ranks the whole available dossier, including older evidence.
        First-time preparation is saved and can be resumed. Direct comparison
        examines 12 records at a time; Words matches all search words. Typing
        alone sends nothing.
      </p>
      {busy && (
        <LensProgress
          activity={{
            state: mode !== 'literal' ? 'searching' : 'idle',
            label: progress
              ? 'Preparing saved evidence'
              : 'Searching saved evidence',
            detail: progress
              ? `${progress.prepared_records} of ${progress.total_records} records prepared locally. You can stop and resume.`
              : mode !== 'literal'
                ? 'Checking permissions and ranking permitted evidence locally.'
                : 'Finding all-word matches in permitted evidence.',
          }}
        />
      )}
      {busy && (
        <Button
          variant="outline"
          onClick={() => {
            epoch.current.value++;
            controller.current?.abort();
            setBusy(false);
            setProgress(null);
            setNotice(
              'Search stopped. Prepared evidence is retained; search again to continue.',
            );
          }}
        >
          Stop search
        </Button>
      )}
      {notice && <output>{notice}</output>}
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
            void search(
              page.query,
              page.mode,
              offset,
              page.as_of,
              page.mode === 'corpus' ? page.fingerprint : undefined,
            )
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
  const corpus = page.mode === 'corpus';
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
          : corpus
            ? `${page.examined_records} records ranked across this dossier`
            : `${page.examined_records} records in this batch`}{' '}
        · {page.total_records} saved records
      </output>
      {page.method === 'literal_fallback' && (
        <output>
          Local comparison was unavailable. These are word matches in this
          batch; switch to Words to search the full saved ledger.
        </output>
      )}
      {corpus && page.measurement.error && (
        <output>
          Some direct model opinions are unavailable. The full dossier ranking
          and exact sources remain available.
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
            {corpus ? (
              'Previous results'
            ) : (
              <>Newer {literal ? 'matches' : 'evidence'}</>
            )}
          </Button>
        )}
        {page.next_offset !== null && (
          <Button variant="outline" onClick={() => onPage(page.next_offset!)}>
            {corpus ? (
              'More ranked results'
            ) : (
              <>Search older {literal ? 'matches' : 'evidence'}</>
            )}
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
          {corpus
            ? 'Quality evidence: independent retrieval sample; dossier accuracy is unknown.'
            : 'Independent accuracy: not evaluated.'}{' '}
          {page.measurement.accuracy_basis}{' '}
          {page.measurement.confidence_definition}
        </p>
        {!!page.measurement.models.length && (
          <p>Model: {page.measurement.models.join(', ')}</p>
        )}
        <p>
          Records captured by {date(page.as_of)}. Current access and finding
          reviews are checked again while results are open. Human decisions
          do not change relevance ranking or verify truth.
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
  const review = item.human_review;
  return (
    <article className="evidence-search-result">
      <div className="eyebrow">
        {item.kind === 'claim'
          ? `Finding · ${readable(item.claim_status)} · revision ${item.claim_revision}`
          : 'Captured passage'}
      </div>
      <h4>{item.statement || item.title}</h4>
      {item.kind === 'claim' && (
        <div className="evidence-search-review">
          <p>
            Human review: {review
              ? review.stale
                ? 'Evidence changed — review again'
                : review.decision
                  ? claimDecisionLabels[review.decision]
                  : 'Not reviewed'
              : 'Status unavailable'}
          </p>
          {review?.has_conflicting_evidence && (
            <p>Conflicting evidence is recorded. Open the finding to compare citations.</p>
          )}
          {review && !review.complete && (
            <p>Review context is incomplete; a full assessment is still needed.</p>
          )}
          {review && review.complete && !review.reviewable && (
            <p>The captured citations need checking before a review can be saved.</p>
          )}
        </div>
      )}
      {item.citation_relation && (
        <p className="eyebrow">Citation relationship: {readable(item.citation_relation)}</p>
      )}
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
          {item.relevance_probability === null &&
          item.semantic_similarity !== undefined
            ? 'This record was ranked by local meaning and word similarity. A direct model opinion is unavailable.'
            : item.semantic_match
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
        {item.semantic_similarity !== undefined && (
          <p>
            Whole-dossier ranking combines meaning and word similarity; direct
            model opinions do not remove or reorder candidates.
            {item.embedding_truncated
              ? ' The preparation model read only the first 512 tokens of this record.'
              : ''}{' '}
            Similarity is not a truth or accuracy score.
          </p>
        )}
        <code>SHA-256 {item.sha256}</code>
      </details>
    </article>
  );
}
