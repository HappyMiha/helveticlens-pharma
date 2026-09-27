import type {
  QuestionSelection,
  QuestionStatus,
  ThreadPage,
} from './contracts';

export const questionFilters: Record<QuestionStatus, string> = {
  all: 'All questions',
  open: 'Still open',
  answered: 'Working answers',
};
export function firstQuestionPage(
  input: Pick<QuestionSelection, 'query' | 'status'>,
): QuestionSelection {
  return { query: input.query.trim(), status: input.status, offset: 0 };
}
export function questionLibraryPath(
  product: string,
  dossierId: string,
  selection: QuestionSelection,
) {
  const params = new URLSearchParams({
    q: selection.query,
    status: selection.status,
    offset: String(selection.offset),
  });
  return `/products/${product}/dossiers/${encodeURIComponent(dossierId)}/discussion?${params}`;
}
export function questionPage(
  result: Pick<ThreadPage, 'query' | 'status' | 'offset' | 'page_size'>,
  direction: -1 | 0 | 1,
): QuestionSelection {
  return {
    query: result.query,
    status: result.status,
    offset:
      direction === 0
        ? 0
        : Math.max(0, result.offset + direction * result.page_size),
  };
}
/** A superseded read cannot reopen a question or replace its current error. */
export function questionReads() {
  let sequence = 0;
  return {
    cancel() {
      sequence++;
    },
    async read<T>(fetch: () => Promise<T>): Promise<T | null> {
      const attempt = ++sequence;
      try {
        const result = await fetch();
        return attempt === sequence ? result : null;
      } catch (error) {
        if (attempt === sequence) throw error;
        return null;
      }
    },
  };
}
