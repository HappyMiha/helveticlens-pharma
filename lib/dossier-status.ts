import type { DossierRecord } from './contracts';

/** Either active monitoring path counts; a private draft can have daily research. */
export function dossierStatus(dossier: DossierRecord) {
  if (
    dossier.profile.status === 'active' ||
    dossier.research_monitoring?.enabled
  )
    return 'active';
  if (dossier.exploration && !dossier.research_monitoring) return 'research';
  return dossier.research_monitoring ? 'paused' : dossier.profile.status;
}
