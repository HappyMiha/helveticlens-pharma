import type { ResearchPreview, ResearchScope } from './contracts';

export function hasClaimInputs(scope: ResearchScope | undefined) {
  return scope === 'claims_v1' || scope === 'claims_typed_v1';
}

export function researchRequest(
  preview: ResearchPreview,
  keys: Map<string, string>,
  createKey: () => string,
) {
  const format = preview.answer_format || 'standard';
  if (
    !['standard', 'source_analysis_v1'].includes(format) ||
    (format === 'source_analysis_v1' &&
      (!hasClaimInputs(preview.evidence_scope) ||
        preview.answer_contract?.id !== 'source-analysis/v1' ||
        preview.answer_contract.schema_version !== 1)) ||
    (preview.evidence_scope !== undefined &&
      !['saved', 'claims_v1', 'claims_typed_v1'].includes(
        preview.evidence_scope,
      )) ||
    !/^[a-f0-9]{64}$/.test(preview.evidence_fingerprint) ||
    !Number.isSafeInteger(preview.expected_revision) ||
    preview.expected_revision < 1 ||
    !preview.dossier_id ||
    !preview.question_id
  )
    throw new Error('Refresh the evidence preview before generating.');
  const identity = `${preview.evidence_scope || 'saved'}:${preview.dossier_id}:${preview.question_id}:${preview.expected_revision}:${preview.evidence_fingerprint}${format === 'standard' ? '' : `:${format}`}`;
  let key = keys.get(identity);
  if (!key) {
    key = createKey();
    keys.set(identity, key);
  }
  return {
    ...(format === 'source_analysis_v1' ? { answer_format: format } : {}),
    request_key: key,
    expected_revision: preview.expected_revision,
    expected_evidence: preview.evidence_fingerprint,
    ...(hasClaimInputs(preview.evidence_scope)
      ? { evidence_scope: preview.evidence_scope }
      : {}),
  };
}
