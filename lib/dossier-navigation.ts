import type { SearchHit } from './contracts';

export interface DossierLink {
  id: string;
  questionId?: string | null;
  referenceId?: string | null;
}
export function dossierHref(target: DossierLink) {
  const params = new URLSearchParams({ dossier: target.id });
  if (target.referenceId) params.set('source', target.referenceId);
  else if (target.questionId) params.set('question', target.questionId);
  return `/?${params}`;
}
export function readDossierLink(search: string): DossierLink | null {
  const params = new URLSearchParams(search);
  const id = params.get('dossier');
  if (!id) return null;
  const referenceId = params.get('source') || null;
  return {
    id,
    referenceId,
    questionId: referenceId ? null : params.get('question') || null,
  };
}
export function discoveryTarget(hit: SearchHit): DossierLink | null {
  if (!hit.dossier_id) return null;
  return {
    id: hit.dossier_id,
    referenceId: hit.kind === 'reference' ? hit.id : null,
    questionId: hit.kind === 'reference' ? null : hit.thread_id || null,
  };
}
export function recordDossierNavigation(
  history: Pick<History, 'pushState'>,
  target: DossierLink,
  push: boolean,
) {
  if (push) history.pushState({}, '', dossierHref(target));
}
export function referencePath(
  product: string,
  dossierId: string,
  referenceId: string,
) {
  return `/products/${product}/dossiers/${encodeURIComponent(dossierId)}/references/${encodeURIComponent(referenceId)}`;
}
