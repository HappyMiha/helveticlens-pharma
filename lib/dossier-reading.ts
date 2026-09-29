import type { InvestigationSummary } from './investigation';
import type { DossierCoverage } from './dossier-coverage';
import { packCoverage, pageCoverage } from './dossier-coverage';
import { text } from './api';

export type InvestigationPage = {
  items: InvestigationSummary[];
  total: number;
};
export function researchProgress(latest: InvestigationSummary | undefined) {
  switch (latest?.status) {
    case 'queued':
      return 'Research is queued';
    case 'running':
      return 'Research is in progress';
    case 'paused':
      return 'Research is paused';
    case 'failed':
      return 'Latest research needs attention';
    case 'cancelled':
      return 'Latest research was stopped';
    case 'completed':
      return 'Latest investigation finished';
    default:
      return 'No investigation saved yet';
  }
}

/** These are recorded operational checks, never an assertion of total coverage. */
export function coverageAttention(value: DossierCoverage) {
  const pages = value.documents.flatMap((page) => {
    const state = pageCoverage(page);
    return state.attention
      ? [{ key: `page:${page.id}`, name: page.name, reason: state.label }]
      : [];
  });
  const packs = value.packs.flatMap((pack) => {
    const state = packCoverage(pack);
    return state.attention
      ? [{ key: `pack:${pack.id}`, name: text(pack.name), reason: state.label }]
      : [];
  });
  return [...pages, ...packs];
}
