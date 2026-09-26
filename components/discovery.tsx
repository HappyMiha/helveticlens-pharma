'use client';

import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Globe,
  LoaderCircle,
  Plus,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import type { DiscoveryResult, Preset, SearchHit } from '@/lib/contracts';
import { api, date, uid } from '@/lib/api';
import { product } from '@/lib/product';

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
}: {
  initialQuery?: string;
  onOpen: (id: string, threadId?: string | null) => void;
  onCreate?: (seed: Preset) => void;
  onSave?: (hit: SearchHit) => Promise<void>;
}) {
  const [query, setQuery] = useState(initialQuery),
    [provider, setProvider] = useState('workspace'),
    [result, setResult] = useState<DiscoveryResult | null>(null),
    [failure, setFailure] = useState(''),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState<string[]>([]);
  async function search() {
    setBusy(true);
    setFailure('');
    try {
      setResult(
        await api<DiscoveryResult>(
          `/products/${product.id}/discover?provider=${provider}&q=${encodeURIComponent(query.trim())}`,
        ),
      );
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
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
            disabled={busy}
          />
        </div>
        <NativeSelect
          aria-label="Where to search"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          disabled={busy}
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
        <Button type="submit" disabled={busy}>
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Search size={17} />
          )}
          Search
        </Button>
      </form>
      <p className="search-scope">
        {provider === 'workspace'
          ? 'Search saved topics, questions and contributions visible to you.'
          : `Only the search phrase above is sent to ${provider === 'fedlex' ? 'Fedlex' : 'Europe PMC'}. Open results to check their scope and status.`}
      </p>
      {failure && (
        <div role="alert" className="banner error">
          {failure}
        </div>
      )}
      {result && !failure && (
        <>
          <div className="search-result-heading">
            <span>
              <b>{result.items.length}</b> results ·{' '}
              {result.provider === 'workspace'
                ? 'Team knowledge'
                : result.provider === 'fedlex'
                  ? 'Fedlex'
                  : 'Europe PMC'}
            </span>
            <span>{date(result.checked_at)}</span>
          </div>
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
                        disabled={busy || saved.includes(hit.id)}
                        onClick={async () => {
                          setBusy(true);
                          setFailure('');
                          try {
                            await onSave(hit);
                            setSaved((x) => [...x, hit.id]);
                          } catch (e) {
                            setFailure((e as Error).message);
                          } finally {
                            setBusy(false);
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
