'use client';
import { useState } from 'react';
import { date } from '@/lib/api';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import { currentFeedChecks, feedChecksPath } from '@/lib/feed-check-history';
import type { FeedCheckHistory as History } from '@/lib/feed-check-history';
import { Button } from './ui/button';

const states: Record<string, string> = {
  queued: 'Collection was queued',
  running: 'Collection has no completed result',
  persisted: 'Collection completed',
  partial: 'Collection partly completed',
  degraded: 'Source collection failed',
  failed: 'Source collection failed',
  cancelled: 'Collection cancelled',
  interrupted: 'Collection interrupted',
};
export function FeedChecksReading({ value }: { value: History }) {
  return (
    <div className="page-check-reading">
      <p className="source-meta">{value.scope}</p>
      {value.profile_status === 'draft' && <p>Draft selection. Monitoring for this dossier has not started.</p>}
      {value.profile_status === 'paused' && <p>Dossier monitoring is paused.</p>}
      {value.pack.definition_state !== 'active' && <p>This collection is inactive in the source catalogue.</p>}
      {(!value.pack.subscription_enabled || value.pack.subscription_state !== 'active') && <p>This workspace is not currently connected to this collection.</p>}
      {!value.source.enabled && <p>Automatic collection is currently off.</p>}
      {!value.items.length && <p>No collection runs are recorded for this source. This does not establish that it was checked.</p>}
      {value.items.map((run) => (
        <article key={run.id}>
          <p><strong>{states[run.status] || 'Collection outcome not established'}</strong></p>
          <p className="source-meta">Recorded {date(run.created_at)} · {run.started_at ? <>started {date(run.started_at)}</> : 'start time not recorded'} · {run.finished_at ? <>finished {date(run.finished_at)}</> : 'completion time not recorded'}</p>
          {run.explanation && <p>{run.explanation}</p>}
          {run.reported_counts && <p className="source-meta">Reported feed events: {run.reported_counts.new ?? 'unknown'} new · {run.reported_counts.changed ?? 'unknown'} changed. Recorded item errors: {run.reported_counts.failed ?? 'unknown'}.</p>}
        </article>
      ))}
    </div>
  );
}
export function FeedCheckHistory({ dossierId, packId, connector, stream }: { dossierId: string; packId: string; connector: string; stream: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ offset: 0, asOf: '' });
  const [generation, setGeneration] = useState(0);
  const { data, error, loading, refreshing, refresh } = useResource<History>(open ? feedChecksPath(product.id, dossierId, packId, connector, stream, position.offset, position.asOf) : null, generation);
  const current = currentFeedChecks(data, error, dossierId, packId, connector, stream, position.offset);
  return (
    <details className="page-check-history" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Collection history</summary>
      {open && <>
        <Button variant="ghost" disabled={refreshing} onClick={() => { setPosition({ offset: 0, asOf: '' }); setGeneration((n) => n + 1); }}>Refresh collection history</Button>
        {loading && <output>Reading saved collections…</output>}
        {error && <div className="banner error" role="alert"><p>Collection history could not be loaded. {error}</p><Button variant="outline" disabled={refreshing} onClick={() => void refresh()}>Retry collections</Button></div>}
        {!loading && !error && data && !current && <p role="alert">This collection-history format is unavailable. Refresh to try again.</p>}
        {current && <>
          <FeedChecksReading value={current} />
          <nav className="snapshot-actions" aria-label="Source collection history">
            <Button variant="outline" disabled={!position.offset || refreshing} onClick={() => setPosition({ offset: Math.max(0, position.offset - current.page_size), asOf: current.as_of })}>Newer collections</Button>
            <span>Page {Math.floor(position.offset / current.page_size) + 1}</span>
            <Button variant="outline" disabled={current.next_offset === null || refreshing} onClick={() => { if (current.next_offset !== null) setPosition({ offset: current.next_offset, asOf: current.as_of }); }}>Older collections</Button>
          </nav>
        </>}
      </>}
    </details>
  );
}
