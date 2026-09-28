import type { SavedPageVersion } from '@/lib/contracts';
import { date } from '@/lib/api';
import {
  sourceCount,
  sourceFingerprint,
  sourceReference,
  sourceTimestamp,
} from '@/lib/source-reading';

export function SavedVersionContext({
  version,
}: {
  version: SavedPageVersion;
}) {
  const scope = version.selection_provenance,
    capture = sourceTimestamp(version.created_at),
    reference = sourceReference(version.source_url, true),
    hash = sourceFingerprint(version.content_hash),
    revision = sourceCount(version.evidence_revision);
  return (
    <section className="saved-version-context" data-saved-version-context>
      <dl className="saved-version-facts">
        <div>
          <dt>Saved on</dt>
          <dd>
            {capture ? (
              <time dateTime={capture}>{date(capture)}</time>
            ) : (
              'Not established'
            )}
          </dd>
        </div>
        <div>
          <dt>Declared document date</dt>
          <dd>
            {version.declared_date || 'Not recorded'}
            {version.date_provenance ? ` (${version.date_provenance})` : ''}
          </dd>
        </div>
        <div>
          <dt>Source origin</dt>
          <dd>{reference?.origin || 'Origin not established'}</dd>
        </div>
        <div>
          <dt>Capture origin</dt>
          <dd>
            {version.origin === 'live'
              ? 'Page capture'
              : version.origin || 'Not recorded'}
          </dd>
        </div>
      </dl>
      <dl className="saved-version-counts">
        {(
          [
            [version.passage_count, 'saved passages'],
            [version.characters, 'saved characters'],
          ] as const
        ).map(([raw, label]) => {
          const count = sourceCount(raw);
          return (
            <div key={label}>
              <dt>{label}</dt>
              <dd
                className={count === null ? 'saved-version-unknown' : undefined}
              >
                {count === null
                  ? 'Not recorded'
                  : count.toLocaleString('en-CH')}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="saved-version-limits">
        Counts describe retained extracted text. They do not establish that the
        complete original document was captured.
      </p>
      {version.synthetic && (
        <p className="source-health-warning">
          <b>Synthetic saved version.</b> This is not a verified live-source
          capture.
        </p>
      )}
      {(scope.scope ||
        scope.official_version_date ||
        scope.articles.length > 0) && (
        <details className="snapshot-scope">
          <summary>
            Saved selection ·{' '}
            {scope.scope || `${scope.articles.length} selected articles`}
          </summary>
          <p>
            This capture may cover only selected parts of the source. Official
            version date: {scope.official_version_date || 'Not recorded'}.
          </p>
          {scope.articles.map((article, i) => (
            <p key={`${article.number}:${i}`}>
              Art. {article.number} · {article.heading}
            </p>
          ))}
        </details>
      )}
      <details className="saved-version-details">
        <summary>Saved version details</summary>
        <dl className="saved-version-facts">
          <div>
            <dt>Version</dt>
            <dd>{version.id || 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Evidence revision</dt>
            <dd>
              {revision !== null && revision > 0 ? revision : 'Not recorded'}
            </dd>
          </div>
          <div>
            <dt>File name</dt>
            <dd>{version.filename || 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>
              {version.content_type && version.content_type !== 'unknown'
                ? version.content_type
                : 'Not recorded'}
            </dd>
          </div>
          <div>
            <dt>Capture fingerprint</dt>
            <dd>
              {hash ? (
                <code data-saved-version-fingerprint>SHA-256 {hash}</code>
              ) : (
                'Not available in this record'
              )}
            </dd>
          </div>
        </dl>
        <p className="saved-version-limits">
          Use this recorded fingerprint to identify the saved capture. Capture
          time does not establish publication or legal effect.
        </p>
      </details>
    </section>
  );
}
