import type { Metadata } from 'next';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination';
import { product } from '@/lib/product';
import { readPublicPage } from '@/lib/public-reader';
import { publicHref, publicOffset, publicSearch } from '@/lib/publication';
import { date } from '@/lib/api';
import './public.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: `Public dossiers · HelveticLens ${product.name}`,
  description: `Read published ${product.id === 'pharma' ? 'pharmaceutical' : 'legal'} research dossiers and their sources without an account.`,
  alternates: { canonical: `https://${product.domain}/public-dossiers` },
};
export default async function PublicDossiers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.slice(0, 300) : '';
  const offset = publicOffset(params.offset);
  const invalid =
    new Set(query.toLowerCase().split(/\s+/).filter(Boolean)).size > 12;
  const result = invalid ? null : await readPublicPage(query, offset);
  const data = result?.data;
  return (
    <main className="public-shell">
      <header className="public-header">
        <Link href="/">
          HelveticLens <b>{product.name}</b>
        </Link>
        <nav aria-label="Product navigation">
          <Link href="/guide">Guide</Link>
          <Link href="/">Open workspace</Link>
        </nav>
      </header>
      <div className="public-intro">
        <p className="eyebrow">Open research</p>
        <h1>Public dossiers</h1>
        <p>
          Read published questions, findings and source links. No account
          needed.
        </p>
      </div>
      <form action="/public-dossiers" className="public-search">
        <label htmlFor="public-query">Search public dossiers</label>
        <div>
          <Input
            id="public-query"
            name="q"
            defaultValue={query}
            maxLength={300}
            placeholder="A medicine, legal question or research topic"
          />
          <Button type="submit">Search</Button>
        </div>
        <p>
          Matches all search words across the title, summary and published text.
        </p>
      </form>
      {invalid ? (
        <div role="alert" className="banner error">
          Use at most 12 search words.
        </div>
      ) : result?.error ? (
        <div role="alert" className="public-empty">
          <h2>Public dossiers are temporarily unavailable</h2>
          <p>{result.error}</p>
          <a href={publicSearch(query, offset)}>Retry loading</a>
        </div>
      ) : (
        data && (
          <>
            <div className="public-count">
              {data.total} {data.total === 1 ? 'dossier' : 'dossiers'}
              {query && <> matching “{query}”</>}
            </div>
            {data.items.length ? (
              <div className="public-list">
                {data.items.map((item) => (
                  <article key={item.id}>
                    <h2>
                      <Link href={publicHref(item.id)}>{item.title}</Link>
                    </h2>
                    <p>{item.summary}</p>
                    <div className="public-meta">
                      <span>{item.author_label}</span>
                      <span>Updated {date(item.updated_at)}</span>
                      <span>Revision {item.revision}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="public-empty">
                <h2>
                  {offset
                    ? 'No dossiers on this page'
                    : query
                      ? 'No matching public dossiers'
                      : 'No public dossiers yet'}
                </h2>
                <p>
                  {query
                    ? 'Try fewer words or browse every published dossier.'
                    : 'Authors can publish a reviewed version from the Public version tab in their workspace.'}
                </p>
                {(offset > 0 || query) && (
                  <Link href="/public-dossiers">
                    Browse all public dossiers
                  </Link>
                )}
              </div>
            )}
            {(offset > 0 || offset + data.items.length < data.total) && (
              <Pagination>
                <PaginationContent>
                  {offset > 0 && (
                    <PaginationItem>
                      <Link
                        href={publicSearch(query, Math.max(0, offset - 20))}
                      >
                        Previous page
                      </Link>
                    </PaginationItem>
                  )}
                  {offset + 20 < data.total && (
                    <PaginationItem>
                      <Link href={publicSearch(query, offset + 20)}>
                        Next page
                      </Link>
                    </PaginationItem>
                  )}
                </PaginationContent>
              </Pagination>
            )}
          </>
        )
      )}
      <footer className="public-footer">
        Published versions are selected by their authors. Private workspace
        material stays private.
      </footer>
    </main>
  );
}
