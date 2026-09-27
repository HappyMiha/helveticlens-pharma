import type { PublicContent } from '@/lib/publication';

export function PublicContentView({ content }: { content: PublicContent }) {
  return (
    <article className="public-article">
      <h1>{content.title}</h1>
      <p className="public-summary">{content.summary}</p>
      <p className="public-byline">Published by {content.author_label}</p>
      <div className="public-body">{content.body}</div>
      <section className="public-sources" aria-label="Published source links">
        <h2>Sources</h2>
        {content.sources.length ? (
          <ol>
            {content.sources.map((source, index) => (
              <li key={source.url + index}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                >
                  {source.title}
                </a>
                <span>{source.url}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p>No source links were included in this publication.</p>
        )}
      </section>
    </article>
  );
}
