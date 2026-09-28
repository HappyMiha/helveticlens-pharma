import type { PageChange } from './monitoring-research';
import { sourceCount } from './source-reading';

/** A full reader opens only the exact retained version and revision. */
export function savedPagePosition(page: PageChange, side: 'before' | 'after') {
  const id = side === 'before' ? page.previous.version_id : page.version_id;
  const revision = sourceCount(
    side === 'before' ? page.previous.revision : page.revision,
  );
  return typeof id === 'string' &&
    id.length > 0 &&
    id.length <= 200 &&
    revision !== null &&
    revision >= 1
    ? { id, revision, offset: 0 as const }
    : null;
}
