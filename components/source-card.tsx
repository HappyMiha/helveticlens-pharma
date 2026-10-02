'use client';
import type { Investigation } from '@/lib/investigation';
import { readable } from '@/lib/investigation';
import { sourceUsage } from '@/lib/lens';
import {
  sourceReference,
  sourceTimestamp,
  sourceFingerprint,
} from '@/lib/source-reading';
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
  const reference = sourceReference(source.url);
  const href = reference?.href;
  const retained = source.snapshot?.retained_origin;
  const captured = sourceTimestamp(retained ? retained.captured_at : source.created_at);
  return (
    <dl className="source-metadata">
      <div>
        <dt>Origin</dt>
        <dd>{href ? reference?.origin : 'Saved dossier material'}</dd>
      </div>
      {source.original && (
        <div>
          <dt>Contributed by</dt>
          <dd>{source.original.author}</dd>
        </div>
      )}
      <div>
        <dt>{retained ? 'Original capture' : 'Captured'}</dt>
        <dd>
          {captured ? (
            <time dateTime={captured}>{date(captured)}</time>
          ) : (
            'Not established'
          )}
        </dd>
      </div>
      {retained && (
        <div>
          <dt>Use in this research</dt>
          <dd>Reused from earlier research; not checked again.</dd>
        </div>
      )}
      <div>
        <dt>Source classification</dt>
        <dd>
          {source.snapshot?.source_class ? (
            <>
              {source.snapshot.source_class.category.replaceAll('_', ' ')} · AI
              classification
              <details>
                <summary>Classification evidence</summary>
                <blockquote>{source.snapshot.source_class.quote}</blockquote>
                <p>{source.snapshot.source_class.basis}</p>
              </details>
            </>
          ) : (
            'Primary / secondary not established'
          )}
        </dd>
      </div>
      <div>
        <dt>Publication date</dt>
        <dd>Not established</dd>
      </div>
    </dl>
  );
}
export function SourcePreview({ source }: { source: Source }) {
  const fingerprint = sourceFingerprint(source.sha256);
  return (
    <div
      className="source-preview"
      data-source-reading
      data-content-kind="source"
    >
      <p className="content-origin">Original source · retained excerpts</p>
      <p className="source-capture-scope">
        {source.snapshot.scope || 'Only retained excerpts are shown.'}
      </p>
      <p className="source-capture-limit">
        This reader shows the retained capture. The original source may have
        changed since it was saved.
      </p>
      {!source.snapshot.excerpts.length && (
        <p>
          No excerpts were retained in this capture. Open the original source
          when available.
        </p>
      )}
      {source.snapshot.duplicate_of && <aside className="investigation-muted">
        <p>This capture contains the same document bytes as an earlier source. It was not counted as new supporting evidence.</p>
        <a href={`#source-${source.snapshot.duplicate_of}`}>Read the earlier capture</a>
      </aside>}
      {source.snapshot.unchanged_from && (
        <p className="investigation-muted">
          This capture matches the latest successfully analysed source for this
          question. Repeated extraction was skipped; the captured excerpts
          remain inspectable.
        </p>
      )}
      {source.snapshot.excerpts.map((excerpt) => (
        <section className="source-excerpt" key={excerpt.passage}>
          <h4>{excerpt.passage}</h4>
          <blockquote>{excerpt.text}</blockquote>
        </section>
      ))}
      <details className="source-provenance">
        <summary>Saved source details</summary>
        <dl className="source-metadata">
          <div>
            <dt>Saved version</dt>
            <dd>{source.id}</dd>
          </div>
          <div>
            <dt>Capture fingerprint</dt>
            <dd>
              {fingerprint ? (
                <code data-source-fingerprint>SHA-256 {fingerprint}</code>
              ) : (
                'Not available in this record'
              )}
            </dd>
          </div>
        </dl>
        <p>Use this recorded fingerprint to identify the saved capture.</p>
      </details>
    </div>
  );
}
export function SourceCard({
  source,
  value,
  idPrefix = 'source',
  onClaim,
}: {
  source: Source;
  value: Investigation;
  idPrefix?: string;
  onClaim?: (id: string) => void;
}) {
  const reference = sourceReference(source.url);
  const href = reference?.href;
  const used = sourceUsage(value, source.id);
  return (
    <article id={`${idPrefix}-${source.id}`} className="investigation-source">
      <div className="eyebrow">{readable(source.kind)}</div>
      <h4>{source.title}</h4>
      <SourceMetadata source={source} />
      <dl className="source-reading-counts">
        <div>
          <dt>
            retained{' '}
            {source.snapshot.excerpts.length === 1 ? 'excerpt' : 'excerpts'}
          </dt>
          <dd>{source.snapshot.excerpts.length}</dd>
        </div>
        <div>
          <dt>
            {used.claims.length === 1
              ? 'claim uses this source'
              : 'claims use this source'}
          </dt>
          <dd>{used.claims.length}</dd>
        </div>
      </dl>
      <div className="source-usage">
        <span>
          {used.contradictions} {used.contradictions === 1 ? 'claim' : 'claims'}{' '}
          with contradicting evidence in this investigation
        </span>
        {used.claims.map((id, i) => onClaim ? (
          <Button variant="link" key={id} onClick={() => onClaim(id)}>Claim {i + 1}</Button>
        ) : (
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
