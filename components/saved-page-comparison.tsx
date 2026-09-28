import { date } from '@/lib/api';
import type { PageChange } from '@/lib/monitoring-research';
import {
  sourceCount,
  sourceFingerprint,
  sourceTimestamp,
} from '@/lib/source-reading';
import { savedPagePosition } from '@/lib/saved-comparisons';
import { Button } from './ui/button';

export function SavedPageComparison({
  page,
  capturedAt,
  onRead,
}: {
  page: PageChange;
  capturedAt: string;
  onRead?: (position: { id: string; revision: number; offset: 0 }) => void;
}) {
  const difference = sourceCount(page.first_difference);
  const sides = [
    {
      key: 'before' as const,
      label: 'Earlier saved text',
      captured: page.previous.captured_at,
      characters: page.before_characters,
      hash: page.previous.content_hash,
      text: page.before,
      empty: 'No text in this part of the earlier version.',
      action: 'Read earlier version',
    },
    {
      key: 'after' as const,
      label: 'New saved text',
      captured: capturedAt,
      characters: page.after_characters,
      hash: page.content_hash,
      text: page.after,
      empty: 'No text in this part of the new version.',
      action: 'Read new version',
    },
  ];
  return (
    <details
      className="monitoring-page-change saved-comparison"
      data-saved-comparison
    >
      <summary>Inspect the saved change</summary>
      <p className="investigation-muted">
        Excerpts around the first textual difference
        {difference === null ? '' : `, at character ${difference + 1}`}.{' '}
        {page.partial || page.preview_partial
          ? 'This is a partial view; more changes may appear elsewhere.'
          : 'Both saved texts are shown in full.'}
      </p>
      <p className="saved-comparison-limits">
        A text difference does not establish that a finding changed. Capture
        times are separate from document publication or effective dates.
      </p>
      <div className="monitoring-page-excerpts saved-comparison-pair">
        {sides.map((side) => {
          const captured = sourceTimestamp(side.captured),
            characters = sourceCount(side.characters),
            fingerprint = sourceFingerprint(side.hash),
            position = savedPagePosition(page, side.key);
          return (
            <section key={side.key}>
              <h5>{side.label}</h5>
              <dl className="saved-comparison-facts">
                <div>
                  <dt>Captured</dt>
                  <dd>
                    {captured ? (
                      <time dateTime={captured}>{date(captured)}</time>
                    ) : (
                      'Not established'
                    )}
                  </dd>
                </div>
                <div className="saved-comparison-count">
                  <dt>characters in the saved text</dt>
                  <dd>
                    {characters === null
                      ? 'Not recorded'
                      : characters.toLocaleString('en-CH')}
                  </dd>
                </div>
              </dl>
              <p className="snapshot-text saved-comparison-text">
                {side.text || side.empty}
              </p>
              {onRead && position && (
                <Button variant="outline" onClick={() => onRead(position)}>
                  {side.action}
                </Button>
              )}
              <details className="saved-comparison-provenance">
                <summary>Saved version details</summary>
                <dl>
                  <div>
                    <dt>Version</dt>
                    <dd>
                      {side.key === 'before'
                        ? page.previous.version_id
                        : page.version_id}
                    </dd>
                  </div>
                  <div>
                    <dt>Evidence revision</dt>
                    <dd>{position?.revision ?? 'Not recorded'}</dd>
                  </div>
                  <div>
                    <dt>Capture fingerprint</dt>
                    <dd>
                      {fingerprint ? (
                        <code data-comparison-fingerprint>
                          SHA-256 {fingerprint}
                        </code>
                      ) : (
                        'Not available in this record'
                      )}
                    </dd>
                  </div>
                </dl>
              </details>
            </section>
          );
        })}
      </div>
    </details>
  );
}
