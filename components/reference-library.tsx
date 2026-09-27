'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Globe,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination';
import { WorkField } from '@/components/action-dialog';
import { SourceProvenance } from '@/components/source-provenance';
import { SourceReviews, SourceReviewStatus } from '@/components/source-reviews';
import { api } from '@/lib/api';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import {
  referenceFilters,
  firstReferencePage,
  referenceLibraryPath,
  referencePage,
} from '@/lib/reference-library';
import type {
  DossierProps,
  Entry,
  ReferenceDecision,
  ReferenceLibraryResult,
  ReferenceSelection,
} from '@/lib/contracts';

export function ReferenceLibrary({
  dossier,
  canEdit,
  busy,
  run,
  reload,
  notify,
}: Pick<
  DossierProps,
  'dossier' | 'canEdit' | 'busy' | 'run' | 'reload' | 'notify'
>) {
  const [draft, setDraft] = useState({
    query: '',
    decision: 'all' as ReferenceDecision,
  });
  const [selection, setSelection] = useState<ReferenceSelection>(() =>
    firstReferencePage(draft),
  );
  const [reviewing, setReviewing] = useState<Entry | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const url = referenceLibraryPath(product.id, dossier.id, selection);
  const { data, error, loading, refresh } = useResource<ReferenceLibraryResult>(
    url,
    dossier.entry_count,
  );
  async function refreshLibrary() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }
  function search(next: ReferenceSelection) {
    if (referenceLibraryPath(product.id, dossier.id, next) === url)
      void refreshLibrary();
    else setSelection(next);
  }
  const waiting = !!busy || loading || refreshing;
  return (
    <section className="reference-library" aria-label="Saved source library">
      {reviewing && (
        <SourceReviews
          key={reviewing.id}
          dossierId={dossier.id}
          reference={reviewing}
          canEdit={canEdit}
          onClose={() => setReviewing(null)}
          onSaved={async () => {
            await reload();
            await refresh();
            notify('Source decision saved.');
          }}
        />
      )}
      <div className="section-header spaced">
        <h2>Source library</h2>
        <Button
          variant="outline"
          disabled={waiting}
          onClick={() => void refreshLibrary()}
        >
          <RefreshCw size={16} />
          Refresh
        </Button>
      </div>
      <p className="muted">
        Find any saved reference in this dossier, including older sources.
        Search words can match its name, notes, URL or imported catalogue
        details.
      </p>
      <form
        className="reference-library-search"
        onSubmit={(e) => {
          e.preventDefault();
          search(firstReferencePage(draft));
        }}
      >
        <WorkField label="Search saved sources">
          <Input
            type="search"
            maxLength={300}
            placeholder="Name, note, URL or catalogue query"
            value={draft.query}
            onChange={(e) => setDraft({ ...draft, query: e.target.value })}
          />
        </WorkField>
        <WorkField label="Team review">
          <NativeSelect
            value={draft.decision}
            onChange={(e) =>
              setDraft({
                ...draft,
                decision: e.target.value as ReferenceDecision,
              })
            }
          >
            {Object.entries(referenceFilters).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </WorkField>
        <div className="reference-library-controls">
          <Button type="submit" disabled={waiting}>
            <Search size={16} />
            Search library
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={waiting}
            onClick={() => {
              const reset = firstReferencePage({ query: '', decision: 'all' });
              setDraft(reset);
              search(reset);
            }}
          >
            Clear filters
          </Button>
        </div>
      </form>
      {error && (
        <div className="banner error" role="alert">
          <span>{error}</span>
          <Button
            variant="outline"
            disabled={waiting}
            onClick={() => void refreshLibrary()}
          >
            Retry library
          </Button>
        </div>
      )}
      {(loading || refreshing) && <output>Loading saved sources…</output>}
      {!error && data && (
        <>
          <div className="reference-library-summary" aria-live="polite">
            <p>
              <b>{data.dossier_total}</b> saved{' '}
              {data.dossier_total === 1 ? 'reference' : 'references'} ·{' '}
              <b>{data.total}</b> matching current filters
            </p>
            <p className="muted">
              {data.query ? `Text search: “${data.query}”` : 'All saved text'} ·{' '}
              {referenceFilters[data.decision]}
            </p>
            <p className="muted">
              Within this text search: {data.counts.include} included ·{' '}
              {data.counts.exclude} excluded · {data.counts.unreviewed} needing
              review.
            </p>
          </div>
          {data.items.map((reference) => (
            <article className="reference-row" key={reference.id}>
              <Globe size={22} />
              <div>
                <h3>{reference.title || new URL(reference.url).hostname}</h3>
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noreferrer"
                  className="source-link break-url"
                >
                  {reference.url}
                  <ArrowUpRight size={14} />
                </a>
                <p>{reference.body}</p>
                <SourceProvenance value={reference.data.discovery} />
                <SourceReviewStatus review={reference.source_review} />
                <Button
                  variant="outline"
                  disabled={waiting}
                  onClick={() => setReviewing(reference)}
                >
                  {canEdit ? 'Review source' : 'Review history'}
                </Button>
              </div>
              {dossier.documents.some(
                (watch) => watch.url === reference.url,
              ) ? (
                <span className="tag good">Connected</span>
              ) : (
                <Button
                  variant="outline"
                  disabled={
                    !canEdit || waiting || dossier.profile.status !== 'active'
                  }
                  onClick={() =>
                    void run('Connecting primary-source page', async () => {
                      await api(
                        `/products/${product.id}/dossiers/${dossier.id}/sources/${reference.id}/monitor`,
                        {},
                      );
                      await reload();
                      notify(
                        'Page baseline saved. Automatic checks are enabled for this page.',
                      );
                    })
                  }
                >
                  Connect page watch
                </Button>
              )}
            </article>
          ))}
          {!data.items.length && (
            <div className="work-empty">
              <Globe size={26} />
              <h3>
                {!data.dossier_total
                  ? 'Keep your sources together'
                  : data.total
                    ? 'This page has changed'
                    : 'No matching saved references'}
              </h3>
              <p>
                {!data.dossier_total
                  ? 'Save a discovery result or add a reference below to build this library.'
                  : data.total
                    ? 'New team activity changed this page. Return to the first page to see the current list.'
                    : 'Try fewer words or another review filter. The other saved references remain in this dossier.'}
              </p>
              {data.total > 0 && (
                <Button
                  variant="outline"
                  disabled={waiting}
                  onClick={() => search(referencePage(data, 0))}
                >
                  First page
                </Button>
              )}
            </div>
          )}
          {(data.total > data.page_size || data.offset > 0) && (
            <Pagination aria-label="Saved source pages">
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    disabled={waiting || !data.offset}
                    onClick={() => search(referencePage(data, -1))}
                  >
                    <ArrowLeft size={16} />
                    Previous
                  </Button>
                </PaginationItem>
                {data.items.length > 0 && (
                  <PaginationItem>
                    <span>
                      {data.offset + 1}–{data.offset + data.items.length} of{' '}
                      {data.total}
                    </span>
                  </PaginationItem>
                )}
                <PaginationItem>
                  <Button
                    variant="outline"
                    disabled={
                      waiting ||
                      data.offset + data.items.length >= data.total ||
                      !data.items.length
                    }
                    onClick={() => search(referencePage(data, 1))}
                  >
                    Next
                    <ArrowRight size={16} />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </section>
  );
}
