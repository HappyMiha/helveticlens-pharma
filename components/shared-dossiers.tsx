'use client';
import { useState } from 'react';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import { Button } from '@/components/ui/button';

type SharedDossier = {
  id: string;
  title: string;
  organization_name: string;
  status: string;
  audience: string;
};

export function SharedDossiers({
  refreshToken,
  onOpen,
}: {
  refreshToken: number;
  onOpen: (id: string) => Promise<void>;
}) {
  const [offset, setOffset] = useState(0);
  const { data, error, loading, refresh } = useResource<{
    items: SharedDossier[];
    total: number;
  }>(`/products/${product.id}/shared-dossiers?offset=${offset}`, refreshToken);
  if (!error && !loading && !data?.total) return null;
  return (
    <section className="shared-dossiers" aria-label="Dossiers shared with you">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Guest collaboration</span>
          <h2>Shared with you</h2>
          <p className="source-meta">
            Work with another team on a specific dossier. Your own workspace
            stays unchanged.
          </p>
        </div>
      </div>
      {loading && <output>Loading shared dossiers…</output>}
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <Button variant="outline" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      ) : (
        <ul className="team-people">
          {data?.items.map((item) => (
            <li className="team-person" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p className="source-meta">
                  {item.organization_name} · {item.status} · Guest access
                </p>
              </div>
              <Button variant="outline" onClick={() => void onOpen(item.id)}>
                Open dossier
              </Button>
            </li>
          ))}
        </ul>
      )}
      {!!data && data.total > 50 && (
        <div className="team-person-actions">
          <Button
            variant="outline"
            disabled={!offset || loading}
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            Previous
          </Button>
          <span>
            {offset + 1}–{offset + data.items.length} of {data.total}
          </span>
          <Button
            variant="outline"
            disabled={offset + data.items.length >= data.total || loading}
            onClick={() => setOffset(offset + 50)}
          >
            Next
          </Button>
        </div>
      )}
    </section>
  );
}
