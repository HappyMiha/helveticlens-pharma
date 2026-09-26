'use client';

import { useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Globe,
  LoaderCircle,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import type {
  DiscoveryResult,
  Preset,
  SearchHit,
  SearchPlan,
} from '@/lib/contracts';
import { api, date, uid } from '@/lib/api';
import { product } from '@/lib/product';
import { SearchPlanView } from './search-plan';

export function monitoringSeed(query: string, hit?: SearchHit): Preset {
  return {
    name: query.slice(0, 120),
    goal: `Monitor developments related to: ${query}${hit ? `. Starting source: ${hit.title}` : ''}`.slice(
      0,
      3000,
    ),
    sector: product.id === 'pharma' ? 'Pharmaceuticals' : 'Legal services',
    ...(hit?.url
      ? {
          source_requests: [
            {
              id: uid(),
              label: hit.title.slice(0, 200),
              url: hit.url,
              kind: 'signals' as const,
              status: 'requested' as const,
            },
          ],
        }
      : {}),
  };
}

export function Discovery({
  initialQuery = '',
  onOpen,
  onCreate,
  onSave,
  canPlan = false,
}: {
  initialQuery?: string;
  onOpen: (id: string, threadId?: string | null) => void;
  onCreate?: (seed: Preset) => void;
  onSave?: (hit: SearchHit) => Promise<void>;
  canPlan?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery),
    [provider, setProvider] = useState('workspace'),
    [matchMode, setMatchMode] = useState('all'),
    [result, setResult] = useState<DiscoveryResult | null>(null),
    [plan, setPlan] = useState<SearchPlan | null>(null),
    [failure, setFailure] = useState(''),
    [busy, setBusy] = useState(''),
    [saved, setSaved] = useState<string[]>([]);
  const searchInput = useRef<HTMLInputElement>(null);
  async function search() {
    if (busy || query.trim().length < 2) return;
    setBusy('search');
    setFailure('');
    setResult(null);
    try {
      setResult(
        await api<DiscoveryResult>(
          `/products/${product.id}/discover?provider=${provider}&q=${encodeURIComponent(query.trim())}${provider === 'workspace' ? `&mode=${matchMode}` : ''}`,
        ),
      );
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function planSearch() {
    if (busy || !canPlan || query.trim().length < 5) return;
    setBusy('plan');
    setFailure('');
    setPlan(null);
    try {
      setPlan(
        await api<SearchPlan>(`/products/${product.id}/discover/plan`, {
          question: query.trim(),
        }),
      );
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="discovery">
      <form
        className="discovery-form"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <div className="discovery-input">
          <Search size={21} />
          <Input
            ref={searchInput}
            aria-label="Search phrase"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              product.id === 'pharma'
                ? 'A medicine, safety question, regulation…'
                : 'A legal question, obligation, subject…'
            }
            minLength={2}
            maxLength={300}
            required
            disabled={!!busy}
          />
        </div>
        <NativeSelect
          aria-label="Where to search"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          disabled={!!busy}
        >
          <NativeSelectOption value="workspace">
            Team knowledge
          </NativeSelectOption>
          <NativeSelectOption value="fedlex">
            Fedlex · official laws
          </NativeSelectOption>
          <NativeSelectOption value="europepmc">
            Europe PMC · literature
          </NativeSelectOption>
        </NativeSelect>
        {provider === 'workspace' && (
          <NativeSelect
            aria-label="How to match team knowledge"
            value={matchMode}
            onChange={(e) => setMatchMode(e.target.value)}
            disabled={!!busy}
          >
            <NativeSelectOption value="all">All words</NativeSelectOption>
            <NativeSelectOption value="phrase">Exact phrase</NativeSelectOption>
          </NativeSelect>
        )}
        <Button type="submit" disabled={!!busy || query.trim().length < 2}>
          {busy === 'search' ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Search size={17} />
          )}
          Search
        </Button>
      </form>
      <p className="search-scope">
        {provider === 'workspace'
          ? `Search saved topics, questions and contributions visible to you. ${matchMode === 'all' ? 'All words must appear in the same record, in any order or field (up to 12 distinct words).' : 'Find the complete phrase within one field.'}`
          : `Only the search phrase above is sent to ${provider === 'fedlex' ? 'Fedlex' : 'Europe PMC'}. Open results to check their scope and status.`}
      </p>
      {canPlan && (
        <div className="discovery-plan-action">
          <Button
            variant="outline"
            disabled={!!busy || query.trim().length < 5}
            onClick={() => void planSearch()}
          >
            {busy === 'plan' ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {busy === 'plan' ? 'Planning your search…' : 'Plan with AI'}
          </Button>
          <span>
            Only the text in the search field goes to your configured AI. Get
            suggested queries and sources to review.
          </span>
        </div>
      )}
      {failure && (
        <div role="alert" className="banner error">
          {failure}
        </div>
      )}
      {plan && (
        <SearchPlanView
          plan={plan}
          disabled={!!busy}
          onDismiss={() => setPlan(null)}
          onSelect={(angle) => {
            setQuery(angle.query);
            setProvider(angle.provider);
            setMatchMode('all');
            setResult(null);
            setFailure('');
            searchInput.current?.focus();
            searchInput.current?.scrollIntoView({
              block: 'nearest',
              behavior: 'smooth',
            });
          }}
        />
      )}
      {result && !failure && (
        <>
          <div className="search-result-heading">
            <span>
              <b>
                {result.items.length}
                {result.total != null && result.total > result.items.length
                  ? ` of ${result.total}`
                  : ''}
              </b>{' '}
              results for “{result.query}” ·{' '}
              {result.provider === 'workspace'
                ? 'Team knowledge'
                : result.provider === 'fedlex'
                  ? 'Fedlex'
                  : 'Europe PMC'}
              {result.match_mode &&
                ` · ${result.match_mode === 'all' ? 'All words' : 'Exact phrase'}`}
            </span>
            <span>{date(result.checked_at)}</span>
          </div>
          {result.total != null && result.total > result.items.length && (
            <output className="search-scope block">
              Showing up to 20 topics, 20 questions and 20 contributions. Add
              another word or choose Exact phrase to narrow these {result.total}{' '}
              matches.
            </output>
          )}
          <div className="discovery-results">
            {result.items.map((hit) => (
              <article className="discovery-hit" key={`${hit.kind}:${hit.id}`}>
                <div className="search-hit-symbol">
                  {hit.dossier_id ? (
                    <BookOpen size={20} />
                  ) : (
                    <Globe size={20} />
                  )}
                </div>
                <div>
                  <div className="search-hit-kind">
                    {hit.provider} · {hit.kind.replaceAll('_', ' ')}
                  </div>
                  <h3>{hit.title}</h3>
                  {hit.summary && <p>{hit.summary}</p>}
                  <div className="search-hit-actions">
                    {hit.dossier_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpen(hit.dossier_id!, hit.thread_id)}
                      >
                        Open topic <ArrowRight size={14} />
                      </Button>
                    )}
                    {hit.url && (
                      <a
                        href={hit.url}
                        target="_blank"
                        rel="noreferrer"
                        className="source-link"
                      >
                        Open source <ArrowUpRight size={14} />
                      </a>
                    )}
                    {!hit.dossier_id && onSave && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!!busy || saved.includes(hit.id)}
                        onClick={async () => {
                          setBusy('save');
                          setFailure('');
                          try {
                            await onSave(hit);
                            setSaved((x) => [...x, hit.id]);
                          } catch (e) {
                            setFailure((e as Error).message);
                          } finally {
                            setBusy('');
                          }
                        }}
                      >
                        {saved.includes(hit.id) ? (
                          'Saved to topic'
                        ) : (
                          <>
                            <Plus size={14} />
                            Save to topic
                          </>
                        )}
                      </Button>
                    )}
                    {!hit.dossier_id && onCreate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onCreate(monitoringSeed(result.query, hit))
                        }
                      >
                        <Plus size={14} />
                        Monitor this subject
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!result.items.length && (
            <div className="work-empty">
              <Search size={27} />
              <h3>No results in this source</h3>
              <p>
                Try a more specific phrase or another source. This search does
                not establish that no relevant information exists.
              </p>
            </div>
          )}
          <p className="search-scope">{result.coverage}</p>
          {onCreate && (
            <div className="discovery-next">
              <div>
                <h3>Keep following this question.</h3>
                <p>
                  Turn “{result.query}” into a topic your team can develop and
                  monitor.
                </p>
              </div>
              <Button onClick={() => onCreate(monitoringSeed(result.query))}>
                Create monitoring topic <ArrowRight size={16} />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
