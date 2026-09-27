'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination';
import type { SavedSearch } from '@/lib/contracts';
import { date } from '@/lib/api';
import { product } from '@/lib/product';
import { recipeLabel } from '@/lib/search-recipes';
import { useResource } from '@/lib/use-resource';

export function SavedSearches({
  dossierId,
  onReview,
}: {
  dossierId: string;
  onReview: (search: SavedSearch) => void;
}) {
  const [offset, setOffset] = useState(0);
  const { data, error, loading, refresh } = useResource<{
    items: SavedSearch[];
    total: number;
  }>(`/products/${product.id}/dossiers/${dossierId}/searches?offset=${offset}`);
  return (
    <div className="saved-searches">
      {error && (
        <div className="banner error" role="alert">
          <span>{error}</span>
          <Button variant="outline" onClick={() => void refresh()}>
            Retry loading
          </Button>
        </div>
      )}
      {loading && <output>Loading saved searches…</output>}
      {data && (
        <>
          <p className="saved-search-count">
            {data.total} saved {data.total === 1 ? 'search' : 'searches'}
          </p>
          {data.items.map((search) => (
            <article className="saved-search-card" key={search.id}>
              <div className="saved-search-source">
                {recipeLabel(search.data)}
              </div>
              <h3>{search.data.query}</h3>
              {search.body && (
                <p className="saved-search-purpose">{search.body}</p>
              )}
              <div className="saved-search-footer">
                <span>
                  Saved by {search.author} · {date(search.created_at)}
                </span>
                <Button variant="outline" onClick={() => onReview(search)}>
                  <Search size={16} />
                  Review search
                </Button>
              </div>
            </article>
          ))}
          {!data.total && (
            <div className="work-empty">
              <Search size={26} />
              <h3>Keep useful searches with this topic</h3>
              <p>
                Use Find sources, search, then save the query and its purpose
                for your team.
              </p>
            </div>
          )}
          {data.total > 50 && (
            <Pagination aria-label="Saved search pages">
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - 50))}
                  >
                    <ArrowLeft size={16} />
                    Previous
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <span className="saved-search-count">
                    {offset + 1}–
                    {Math.min(offset + data.items.length, data.total)} of{' '}
                    {data.total}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <Button
                    variant="outline"
                    disabled={offset + data.items.length >= data.total}
                    onClick={() => setOffset(offset + 50)}
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
    </div>
  );
}
