/* oxlint-disable next/no-html-link-for-pages -- Native navigation avoids the deployed runtime namespace failure. */
import { readPublicKnowledge } from '@/lib/public-reader';
import { publicSearch } from '@/lib/publication';

export async function PublicKnowledgeResults({
  query,
  offset,
}: {
  query: string;
  offset: number;
}) {
  const result = await readPublicKnowledge(query, offset);
  if (!result.data)
    return (
      <div className="public-empty" role="alert">
        <p>{result.error}</p>
        <a href={publicSearch(query, offset)}>Retry search</a>
      </div>
    );
  const page = result.data;
  return (
    <>
      <p className="public-count">
        {page.total} public knowledge items matching “{query}”
      </p>
      <div className="public-list">
        {page.items.map((item) => (
          <article key={`${item.kind}:${item.id}`}>
            <p className="eyebrow">{item.kind}</p>
            <h2>
              <a href={item.href}>{item.label}</a>
            </h2>
            <p>{item.text}</p>
            <p className="public-meta">{item.dossier_title}</p>
          </article>
        ))}
      </div>
      {!page.total && (
        <div className="public-empty">
          <h2>No matching public evidence</h2>
          <p>
            Try fewer words or{' '}
            <a href="/public-dossiers">browse published dossiers</a>.
          </p>
        </div>
      )}
      <nav
        className="public-search-pages"
        aria-label="Public knowledge result pages"
      >
        {offset > 0 && (
          <a href={publicSearch(query, Math.max(0, offset - 20))}>
            Previous page
          </a>
        )}
        {offset + 20 < page.total && (
          <a href={publicSearch(query, offset + 20)}>Next page</a>
        )}
      </nav>
      <p className="discussion-note">{page.method}</p>
    </>
  );
}
