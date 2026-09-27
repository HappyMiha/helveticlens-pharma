import type { DocumentHistory, SavedPage } from './contracts';

export interface HistoryPosition {
  cursor: string;
  previous: string[];
}
export interface PagePosition {
  id: string;
  offset: number;
  revision?: number;
}

export function historyPath(root: string, cursor: string) {
  return cursor ? `${root}?${new URLSearchParams({ cursor })}` : root;
}

export function olderHistory(
  position: HistoryPosition,
  data: DocumentHistory,
): HistoryPosition | null {
  return data.next_cursor
    ? {
        cursor: data.next_cursor,
        previous: [...position.previous, position.cursor || data.first_cursor],
      }
    : null;
}

export function newerHistory(
  position: HistoryPosition,
): HistoryPosition | null {
  const cursor = position.previous.at(-1);
  return cursor ? { cursor, previous: position.previous.slice(0, -1) } : null;
}

export function snapshotPath(root: string, position: PagePosition) {
  const query = new URLSearchParams({ offset: String(position.offset) });
  if (position.revision !== undefined)
    query.set('expected_revision', String(position.revision));
  return `${root}/${encodeURIComponent(position.id)}?${query}`;
}

export function adjacentSnapshot(
  data: SavedPage,
  direction: 'next' | 'previous',
): PagePosition | null {
  const offset = data.pagination[`${direction}_offset`];
  if (offset === null) return null;
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(data.evidence_revision) ||
    data.evidence_revision < 1
  )
    throw new Error('Reload this saved version before continuing.');
  return { id: data.id, offset, revision: data.evidence_revision };
}
