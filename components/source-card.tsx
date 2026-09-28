'use client';
import type { Investigation } from '@/lib/investigation';
import { readable, sourceHref } from '@/lib/investigation';
import { sourceUsage } from '@/lib/lens';
import { date } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

type Source = Investigation['sources'][number];
export function SourceMetadata({ source }: { source: Source }) {
  const href = sourceHref(source.url);
  return (
    <dl className="source-metadata">
      <div>
        <dt>Origin</dt>
        <dd>{href ? new URL(href).hostname : 'Saved dossier material'}</dd>
      </div>
      {source.original && (
        <div>
          <dt>Contributed by</dt>
          <dd>{source.original.author}</dd>
        </div>
      )}
      <div>
        <dt>Captured</dt>
        <dd>
          <time dateTime={source.created_at}>{date(source.created_at)}</time>
        </dd>
      </div>
      <div>
        <dt>Source classification</dt>
        <dd>Primary / secondary not established</dd>
      </div>
      <div>
        <dt>Publication date</dt>
        <dd>Not established</dd>
      </div>
    </dl>
  );
}
export function SourcePreview({ source }: { source: Source }) {
  return (
    <div className="source-preview">
      <p>{source.snapshot.scope}</p>
      {source.snapshot.unchanged_from && (
        <p className="investigation-muted">
          This capture matches the latest successfully analysed source for this
          question. Repeated extraction was skipped; the captured excerpts
          remain inspectable.
        </p>
      )}
      {source.snapshot.excerpts.map((excerpt) => (
        <section key={excerpt.passage}>
          <h4>{excerpt.passage}</h4>
          <blockquote>{excerpt.text}</blockquote>
        </section>
      ))}
      <code>SHA-256 {source.sha256}</code>
    </div>
  );
}
export function SourceCard({
  source,
  value,
}: {
  source: Source;
  value: Investigation;
}) {
  const href = sourceHref(source.url);
  const used = sourceUsage(value, source.id);
  return (
    <article id={`source-${source.id}`} className="investigation-source">
      <div className="eyebrow">{readable(source.kind)}</div>
      <h4>{source.title}</h4>
      <SourceMetadata source={source} />
      <div className="source-usage">
        <strong>
          Used in {used.claims.length}{' '}
          {used.claims.length === 1 ? 'claim' : 'claims'}
        </strong>
        <span>{used.contradictions} claims with contradicting evidence</span>
        {used.claims.map((id, i) => (
          <a href={`#claim-${id}`} key={id}>
            Claim {i + 1}
          </a>
        ))}
      </div>
      <div className="source-actions">
        {href && (
          <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
            Open original source ↗
          </a>
        )}
        <Sheet>
          <SheetTrigger render={<Button variant="outline" />}>
            Read captured source
          </SheetTrigger>
          <SheetContent className="source-reader-sheet">
            <SheetHeader>
              <SheetTitle>{source.title}</SheetTitle>
              <SheetDescription>
                Retained excerpts from this capture, with source provenance.
              </SheetDescription>
            </SheetHeader>
            <SourceMetadata source={source} />
            <SourcePreview source={source} />
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
              >
                Open original source ↗
              </a>
            )}
          </SheetContent>
        </Sheet>
      </div>
      <details>
        <summary>Preserved excerpts & provenance</summary>
        <SourcePreview source={source} />
      </details>
    </article>
  );
}
