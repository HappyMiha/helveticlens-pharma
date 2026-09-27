import type { ResearchPreview } from './contracts';

export function researchRequest(
  preview: ResearchPreview,
  keys: Map<string, string>,
  createKey: () => string,
) {
  if (
    !/^[a-f0-9]{64}$/.test(preview.evidence_fingerprint) ||
    !Number.isSafeInteger(preview.expected_revision) ||
    preview.expected_revision < 1 ||
    !preview.dossier_id ||
    !preview.question_id
  )
    throw new Error('Refresh the evidence preview before generating.');
  const identity = `${preview.dossier_id}:${preview.question_id}:${preview.expected_revision}:${preview.evidence_fingerprint}`;
  let key = keys.get(identity);
  if (!key) {
    key = createKey();
    keys.set(identity, key);
  }
  return {
    request_key: key,
    expected_revision: preview.expected_revision,
    expected_evidence: preview.evidence_fingerprint,
  };
}
