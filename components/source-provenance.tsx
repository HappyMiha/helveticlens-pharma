import type { DiscoveryProvenance } from '@/lib/contracts';

export function SourceProvenance({ value }: { value?: DiscoveryProvenance }) {
  if (!value) return <p className="muted">No search provenance recorded</p>;
  return (
    <details className="spaced">
      <summary>Search provenance · {value.record.provider}</summary>
      <p>
        <b>Query:</b> {value.query}
      </p>
      <p>
        <b>Retrieved:</b> {new Date(value.retrieved_at).toLocaleString()} · page{' '}
        {value.page_number}
      </p>
      <p className="break-url">
        <b>Catalogue record:</b> {value.record.id}
      </p>
      <p>{value.record.title}</p>
      {value.record.date && (
        <p>
          <b>Source date:</b> {value.record.date}
        </p>
      )}
      <p className="muted">
        Search provenance verified on import. This saves catalogue metadata;
        read the original source to assess its contents and current status.
      </p>
    </details>
  );
}
