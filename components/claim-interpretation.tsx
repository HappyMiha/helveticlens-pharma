import type { ClaimInterpretation as Interpretation } from '@/lib/claim-review';

export function ClaimInterpretation({
  value,
  stale = false,
}: {
  value?: Interpretation;
  stale?: boolean;
}) {
  return (
    <div className="claim-method">
      <p>
        <strong>
          {stale && value
            ? 'Earlier claim classification'
            : 'Claim classification'}
          :{' '}
        </strong>
        {value
          ? value.kind === 'UNKNOWN'
            ? value.label
            : `${value.kind_label} · ${value.label}`
          : 'Not classified'}
      </p>
      {value && (
        <p>
          {stale
            ? 'Evidence changed; review this classification again. '
            : 'Classified by a dossier editor. '}
          This describes what the claim represents, not whether it is true.
          Claim classification alone does not establish source authority or
          applicability.
        </p>
      )}
    </div>
  );
}
