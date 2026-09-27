'use client';

import { discoveryTarget } from '@/lib/dossier-navigation';

import { useId, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  Globe,
  LoaderCircle,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import type {
  DiscoveryResult,
  Preset,
  SearchHit,
  SearchPlan,
  SearchRecipe,
  SavedSearchInput,
} from '@/lib/contracts';
import { api, date, uid } from '@/lib/api';
import { product } from '@/lib/product';
import { SearchPlanView } from './search-plan';
import { DecisionDiscovery } from './decision-search';
import { recipeFromResult } from '@/lib/search-recipes';
import { appendDiscoveryPage, discoveryPath } from '@/lib/discovery-pages';

type DiscoveryProps = Parameters<typeof CatalogueDiscovery>[0];
export function Discovery(props: DiscoveryProps) {
  const [tab, setTab] = useState(props.initialRecipe ? 'catalogues' : 'web');
  return (
    <div>
      <fieldset
        className="filters decision-tabs"
        aria-label="Search collection"
      >
        <Button
          variant={tab === 'web' ? 'secondary' : 'ghost'}
          onClick={() => setTab('web')}
        >
          Public web
        </Button>
        <Button
          variant={tab === 'catalogues' ? 'secondary' : 'ghost'}
          onClick={() => setTab('catalogues')}
        >
          Team & source catalogues
        </Button>
      </fieldset>
      {tab === 'web' ? (
        <DecisionDiscovery
          initialQuery={props.initialQuery}
          canSearch={!!props.canPlan}
          onSave={props.onSave}
          onCreate={props.onCreate}
        />
      ) : (
        <CatalogueDiscovery {...props} />
      )}
    </div>
  );
}

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

function CatalogueDiscovery({
  initialQuery = '',
  initialRecipe,
  onOpen,
  onCreate,
  onSave,
  onSaveSearch,
  canPlan = false,
}: {
  initialQuery?: string;
  initialRecipe?: SearchRecipe | null;
  onOpen: (
    id: string,
    threadId?: string | null,
    referenceId?: string | null,
  ) => void;
  onCreate?: (seed: Preset) => void;
  onSave?: (hit: SearchHit) => Promise<void>;
  onSaveSearch?: (recipe: SavedSearchInput) => Promise<void>;
  canPlan?: boolean;
}) {
  const [query, setQuery] = useState(initialRecipe?.query || initialQuery),
    [provider, setProvider] = useState<string>(
      initialRecipe?.provider || 'workspace',
    ),
    [matchMode, setMatchMode] = useState<string>(
      initialRecipe?.match_mode || 'all',
    ),
    [pages, setPages] = useState<DiscoveryResult[]>([]),
    [pageIndex, setPageIndex] = useState(0),
    [plan, setPlan] = useState<SearchPlan | null>(null),
    [failure, setFailure] = useState(''),
    [busy, setBusy] = useState(''),
    [saved, setSaved] = useState<string[]>([]),
    [purpose, setPurpose] = useState(''),
    [savedRecipes, setSavedRecipes] = useState<string[]>([]);
  const searchInput = useRef<HTMLInputElement>(null);
  const resultsHeading = useRef<HTMLDivElement>(null);
  const purposeId = useId();
  const recipeKeys = useRef(new Map<string, string>());
  const result = pages[pageIndex] || null;
  const recipe = result ? recipeFromResult(result) : null;
  const recipeFingerprint = recipe
    ? JSON.stringify({ ...recipe, purpose: purpose.trim() })
    : '';
  async function saveRecipe() {
    if (busy || !recipe || !onSaveSearch) return;
    setBusy('save-search');
    setFailure('');
    let key = recipeKeys.current.get(recipeFingerprint);
    if (!key) {
      key = uid();
      recipeKeys.current.set(recipeFingerprint, key);
    }
    try {
      await onSaveSearch({
        ...recipe,
        purpose: purpose.trim(),
        request_key: key,
      });
      setSavedRecipes((values) => [...values, recipeFingerprint]);
    } catch (error) {
      setFailure((error as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function search() {
    if (busy || query.trim().length < 2) return;
    setBusy('search');
    setFailure('');
    try {
      const found = await api<DiscoveryResult>(
        discoveryPath(product.id, {
          provider,
          query: query.trim(),
          match_mode: matchMode,
        }),
      );
      setPages([found]);
      setPageIndex(0);
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function nextPage() {
    if (busy || !result) return;
    setFailure('');
    if (pageIndex + 1 < pages.length) {
      setPageIndex(pageIndex + 1);
      resultsHeading.current?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (!result.next_cursor) return;
    setBusy('page');
    try {
      const found = await api<DiscoveryResult>(
        discoveryPath(product.id, result, result.next_cursor),
      );
      setPages(appendDiscoveryPage(pages, found));
      setPageIndex(pageIndex + 1);
      resultsHeading.current?.scrollIntoView({ block: 'nearest' });
    } catch (error) {
      setFailure(
        `The next page could not be loaded. Your current results are retained. ${(error as Error).message}`,
      );
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
            setPages([]);
            setPageIndex(0);
            setFailure('');
            searchInput.current?.focus();
            searchInput.current?.scrollIntoView({
              block: 'nearest',
              behavior: 'smooth',
            });
          }}
        />
      )}
      {result && (
        <>
          <div className="search-result-heading" ref={resultsHeading}>
            <span>
              <b>
                {result.items.length}
                {result.provider === 'workspace' &&
                result.total != null &&
                result.total > result.items.length
                  ? ` of ${result.total}`
                  : ''}
              </b>{' '}
              results
              {result.provider !== 'workspace'
                ? ` on page ${result.page_number || 1}`
                : ''}{' '}
              for “{result.query}” ·{' '}
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
          {onSave && result.provider !== 'workspace' && (
            <p className="muted">
              Saving a record preserves this query, catalogue metadata and
              retrieval time. Save within 30 minutes, or run the search again. A
              saved reference can be connected to a page watch separately.
            </p>
          )}
          {onSaveSearch && (
            <form
              className="save-search-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveRecipe();
              }}
            >
              <label htmlFor={purposeId}>
                <span>
                  Why keep this search? <span className="muted">Optional</span>
                </span>
                <Input
                  id={purposeId}
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                  disabled={!!busy}
                  maxLength={2000}
                  placeholder="What should your team look for?"
                />
              </label>
              <Button
                type="submit"
                variant="outline"
                disabled={!!busy || savedRecipes.includes(recipeFingerprint)}
              >
                <Bookmark size={16} />
                {savedRecipes.includes(recipeFingerprint)
                  ? 'Search saved'
                  : 'Save search for team'}
              </Button>
              <p>
                Saves the query shown with these results. Teammates review it
                before searching again; automatic checks stay separate.
              </p>
            </form>
          )}
          {result.provider === 'workspace' &&
            result.total != null &&
            result.total > result.items.length && (
              <output className="search-scope block">
                Showing up to 20 topics, 20 questions and 20 contributions. Add
                another word or choose Exact phrase to narrow these{' '}
                {result.total} matches.
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
                        onClick={() => {
                          const target = discoveryTarget(hit);
                          if (target)
                            onOpen(
                              target.id,
                              target.questionId,
                              target.referenceId,
                            );
                        }}
                      >
                        {hit.kind === 'reference'
                          ? 'Open saved source'
                          : hit.thread_id
                            ? 'Open question'
                            : 'Open topic'}{' '}
                        <ArrowRight size={14} />
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
              <h3>
                {(result.page_number || 1) > 1
                  ? 'No results on this page'
                  : 'No results in this source'}
              </h3>
              <p>
                Try a more specific phrase or another source. This search does
                not establish that no relevant information exists.
              </p>
            </div>
          )}
          {result.provider !== 'workspace' && (
            <>
              <Pagination
                className="discovery-pagination"
                aria-label="Source result pages"
              >
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      variant="outline"
                      disabled={!!busy || pageIndex === 0}
                      onClick={() => {
                        setPageIndex(pageIndex - 1);
                        setFailure('');
                        resultsHeading.current?.scrollIntoView({
                          block: 'nearest',
                        });
                      }}
                    >
                      <ArrowLeft size={16} />
                      Previous results
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <output className="discovery-page-count">
                      Page {result.page_number || 1} ·{' '}
                      {result.total == null
                        ? 'Total unavailable'
                        : `${result.total.toLocaleString()} source matches`}
                    </output>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      variant="outline"
                      disabled={
                        !!busy ||
                        (pageIndex + 1 >= pages.length && !result.next_cursor)
                      }
                      onClick={() => void nextPage()}
                    >
                      {busy === 'page' ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <ArrowRight size={16} />
                      )}
                      Next results
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
              {!!result.omitted_records && (
                <p className="search-scope">
                  {result.omitted_records} source records were omitted because
                  their identifiers were unusable or duplicated.
                </p>
              )}
              {result.continuation_unavailable && (
                <p className="search-scope">
                  The source reports more matches but did not provide a usable
                  next page. Refine your query or try the search again.
                </p>
              )}
              {result.limit_reached && (
                <p className="search-scope">
                  You reached the 1,000-record limit for one interactive search.
                  Add a more specific term to continue your research.
                </p>
              )}
              <p className="search-scope">
                Previous results are the pages already loaded in this view.
                Press Search for a fresh search.
              </p>
            </>
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
