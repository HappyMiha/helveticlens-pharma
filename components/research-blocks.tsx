import type { ReactNode } from 'react';

export function LargeMetric({
  value,
  label,
  detail,
  href,
}: {
  value: number;
  label: string;
  detail?: string;
  href?: string;
}) {
  return (
    <div className="large-metric">
      <dt>{href ? <a href={href}>{label}</a> : label}</dt>
      <dd>
        {href ? <a href={href}>{value}</a> : value}
        <small>{detail}</small>
      </dd>
    </div>
  );
}
export function DossierSection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="dossier-section"
      aria-labelledby={`${id}-heading`}
    >
      <div className="dossier-section-heading">
        <span aria-hidden="true">{number}</span>
        <h3 id={`${id}-heading`}>{title}</h3>
      </div>
      <div className="dossier-section-body">{children}</div>
    </section>
  );
}
