import type { DomainPack } from '@/lib/contracts';

export function DomainContext({ pack }: { pack?: DomainPack }) {
  if (!pack) return null;
  return (
    <div className="domain-context" aria-label="Monitoring direction">
      <strong>{pack.label}</strong>
      <p className="muted">{pack.focus}</p>
    </div>
  );
}
