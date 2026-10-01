'use client';
import { MonitoringOutcomeReader } from './monitoring-outcome';
import { useState } from 'react';
import { date } from '@/lib/api';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import { currentPageChecks, pageChecksPath } from '@/lib/page-check-history';
import type { PageCheckHistory as History, CheckedPageVersion } from '@/lib/page-check-history';
import { Button } from './ui/button';
import { DocumentHistory } from './document-history';

const outcomes: Record<string, string> = {
  pending: 'Check has not finished',
  unchanged: 'Saved page text unchanged',
  changed: 'Page text changed',
  baseline_created: 'First version saved',
  failed: 'Source check failed',
  interrupted: 'Check interrupted',
  skipped: 'Check skipped',
  identity_unresolved: 'Captured document identity needs review',
  evidence_unavailable: 'Supporting versions unavailable',
  example_or_import: 'Example or imported evidence',
  historical_comparison: 'Compared with a selected earlier version',
};
const analysis: Record<string, string> = {
  pending: 'Analysis not completed',
  queued: 'Analysis queued',
  running: 'Analysis has no completed result',
  complete: 'Analysis completed',
  completed: 'Analysis completed',
  succeeded: 'Analysis completed',
  failed: 'Source was read; analysis failed',
  not_needed: 'No new analysis was needed',
  not_configured: 'Analysis was not configured',
  not_run: 'Analysis was not run',
  unsupported: 'Analysis unavailable for this source',
};

export function PageChecksReading({ value, onVersion, onInvestigation }: {
  value: History;
  onVersion: (version: CheckedPageVersion) => void;
  onInvestigation: (id: string) => void;
}) {
  return (
    <div className="page-check-reading">
      <p className="source-meta">{value.scope}</p>
      {!value.items.length && <p>No separate checks are recorded on this page. A saved first version does not establish a repeated check.</p>}
      {value.items.map((item) => (
        <article key={item.id}>
          <p><strong>{outcomes[item.outcome] || 'Check outcome not established'}</strong></p>
          <p className="source-meta">Recorded {date(item.created_at)} · {item.finished_at ? <>finished {date(item.finished_at)}</> : 'completion time not recorded'}</p>
          {item.limitation && <p className="coverage-explanation">{item.limitation}</p>}
          {!['failed', 'interrupted', 'pending', 'skipped', 'evidence_unavailable', 'identity_unresolved', 'example_or_import'].includes(item.outcome) && (
            <p>{analysis[item.analysis_status] || 'Analysis status not established'}</p>
          )}
          {!!item.versions.length && (
            <div className="snapshot-actions">
              {item.versions.map((version) => <Button key={version.id} variant="outline" onClick={() => onVersion(version)}>{version.label} · {date(version.created_at)}</Button>)}
            </div>
          )}
          {item.research ? (
            <>
              <p>Dossier research: {item.research.state === 'completed' ? 'completed' : item.research.state === 'failed' ? 'could not be completed' : item.research.state === 'unavailable' ? 'evidence no longer available' : item.research.state === 'skipped' ? 'not started for this capture' : item.research.state}.</p>
              {item.research.outcome && <MonitoringOutcomeReader outcome={item.research.outcome} onOpen={onInvestigation} />}
              {!item.research.outcome && item.research.finding && ['completed', 'failed'].includes(item.research.state) && (
                <details>
                  <summary>{item.research.finding.statement}</summary>
                  <p className="content-origin">AI finding · read the supporting passage</p>
                  <blockquote>{item.research.finding.evidence?.quote}</blockquote>
                  <p className="source-meta">{item.research.finding.evidence?.source.title} · {item.research.finding.evidence?.locator}</p>
                </details>
              )}
              {item.research.investigation_id && item.research.state !== 'unavailable' && (
                <Button variant="ghost" onClick={() => onInvestigation(item.research!.investigation_id!)}>Open related research</Button>
              )}
            </>
          ) : item.outcome === 'changed' || item.outcome === 'baseline_created' ? (
            <p className="source-meta">No related dossier research is recorded for this capture. Checking a page and researching its changes have separate permissions.</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function PageCheckHistory({ dossierId, documentId, name, onInvestigation }: {
  dossierId: string;
  documentId: string;
  name: string;
  onInvestigation: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ offset: 0, asOf: '' });
  const [generation, setGeneration] = useState(0);
  const [selected, setSelected] = useState<CheckedPageVersion | null>(null);
  const { data, error, loading, refreshing, refresh } = useResource<History>(open ? pageChecksPath(dossierId, documentId, product.id, position.offset, position.asOf) : null, generation);
  const current = currentPageChecks(data, error, dossierId, documentId, position.offset);
  const reset = () => { setPosition({ offset: 0, asOf: '' }); setGeneration((n) => n + 1); };
  return (
    <>
      <details className="page-check-history" onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary>History of checks</summary>
        {open && (
          <>
            <Button variant="ghost" disabled={refreshing} onClick={reset}>Refresh check history</Button>
            {loading && <output>Reading saved checks…</output>}
            {error && <div className="banner error" role="alert"><p>Check history could not be loaded. {error}</p><Button variant="outline" disabled={refreshing} onClick={() => void refresh()}>Retry history</Button></div>}
            {!loading && !error && data && !current && <p role="alert">This check-history format is unavailable. Refresh to try again.</p>}
            {current && (
              <>
                <PageChecksReading value={current} onVersion={setSelected} onInvestigation={onInvestigation} />
                <nav className="snapshot-actions" aria-label="Source check history">
                  <Button variant="outline" disabled={!position.offset || refreshing} onClick={() => setPosition({ offset: Math.max(0, position.offset - current.page_size), asOf: current.as_of })}>Newer checks</Button>
                  <span>Page {Math.floor(position.offset / current.page_size) + 1}</span>
                  <Button variant="outline" disabled={current.next_offset === null || refreshing} onClick={() => { if (current.next_offset !== null) setPosition({ offset: current.next_offset, asOf: current.as_of }); }}>Older checks</Button>
                </nav>
              </>
            )}
          </>
        )}
      </details>
      {current && selected && <DocumentHistory key={`${dossierId}:${documentId}:${selected.id}:${selected.evidence_revision}`} dossierId={dossierId} documentId={documentId} name={name} initialPage={{ id: selected.id, offset: 0, revision: selected.evidence_revision }} onClose={() => setSelected(null)} />}
    </>
  );
}
