import type { PublicDossier } from '@/lib/publication';
import type { PublicOrigin } from '@/lib/public-following';
import { date } from '@/lib/api';
import '@/app/public-dossiers/public.css';

export function PublicSnapshot({ snapshot }: { snapshot: PublicDossier }) {
  return (
    <div className="public-snapshot">
      <h3>{snapshot.title}</h3>
      <p>{snapshot.summary}</p>
      <p className="public-meta">
        Published by {snapshot.author_label} · Revision {snapshot.revision}
      </p>
      <div className="public-body">{snapshot.body}</div>
      <h4>Published source links</h4>
      {snapshot.sources.length ? (
        <ol>
          {snapshot.sources.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
              >
                {source.title}
              </a>
              <span className="public-source-address">{source.url}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p>No source links were published.</p>
      )}
    </div>
  );
}
export function PublicCopyOrigin({ origin }: { origin?: PublicOrigin | null }) {
  if (!origin) return null;
  return (
    <details className="public-origin">
      <summary>
        Public origin · {origin.snapshot.author_label} · revision{' '}
        {origin.snapshot.revision}
      </summary>
      <p>
        Copied {date(origin.copied_at)}. This saved version stays with your
        dossier; later changes to the original are separate.
      </p>
      <p>
        <a href={origin.source_url} target="_blank" rel="noopener noreferrer">
          Open original public dossier
        </a>
      </p>
      <PublicSnapshot snapshot={origin.snapshot} />
      <p className="public-integrity">
        Snapshot SHA-256: <code>{origin.snapshot_sha256}</code>
      </p>
    </details>
  );
}
