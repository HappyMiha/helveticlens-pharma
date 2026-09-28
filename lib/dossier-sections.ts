/** Resolve retained deep links before choosing the opening dossier chapter. */
export function initialDossierSection(
  source?: string | null,
  question?: string | null,
  research?: string | null,
) {
  if (source) return 'evidence';
  if (question) return 'discussion';
  if (research) return 'research';
  return 'overview';
}
