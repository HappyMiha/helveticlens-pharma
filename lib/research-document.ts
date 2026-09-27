import type { ResearchDocumentTarget, ResearchSource } from './contracts';
import type { PagePosition } from './document-history';

const identifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
const revision = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= 1 &&
  value <= 2147483647;

export function previewDocument(
  source: ResearchSource,
): ResearchDocumentTarget | null {
  if (
    source.kind !== 'saved_page_extract' ||
    !identifier(source.key) ||
    !identifier(source.document_id) ||
    !revision(source.evidence_revision)
  )
    return null;
  return {
    document_id: source.document_id,
    version_id: source.key,
    expected_revision: source.evidence_revision,
    revision_recorded: true,
  };
}

export function researchDocumentPath(
  root: string,
  questionId: string,
  noteId: string,
  sourceId: string,
) {
  return `${root}/discussion/${encodeURIComponent(questionId)}/research/${encodeURIComponent(noteId)}/sources/${encodeURIComponent(sourceId)}/document`;
}

export function researchDocumentPage(
  target: ResearchDocumentTarget,
): PagePosition {
  if (
    !identifier(target.document_id) ||
    !identifier(target.version_id) ||
    (target.revision_recorded === true
      ? !revision(target.expected_revision)
      : target.revision_recorded !== false || target.expected_revision !== null)
  )
    throw new Error(
      'The saved source identity could not be verified. Retry opening it.',
    );
  return {
    id: target.version_id,
    offset: 0,
    ...(target.revision_recorded
      ? { revision: target.expected_revision as number }
      : {}),
  };
}
