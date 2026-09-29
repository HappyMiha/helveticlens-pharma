import type { ResearchPreview } from './contracts';

export function researchRequest(
  preview: ResearchPreview,
  keys: Map<string, string>,
  createKey: () => string,
) {
  if (
    (preview.evidence_scope !== undefined && !["saved", "claims_v1"].includes(preview.evidence_scope)) ||
    !/^[a-f0-9]{64}$/.test(preview.evidence_fingerprint) ||
    !Number.isSafeInteger(preview.expected_revision) ||
    preview.expected_revision < 1 ||
    !preview.dossier_id ||
    !preview.question_id
  )
    throw new Error('Refresh the evidence preview before generating.');
  const identity = `${preview.evidence_scope || "saved"}:${preview.dossier_id}:${preview.question_id}:${preview.expected_revision}:${preview.evidence_fingerprint}`;
  let key = keys.get(identity);
  if (!key) {
    key = createKey();
    keys.set(identity, key);
  }
  return {
    request_key: key,
    expected_revision: preview.expected_revision,
    expected_evidence: preview.evidence_fingerprint,
    ...(preview.evidence_scope === "claims_v1" ? { evidence_scope: preview.evidence_scope } : {}),
  };
}
