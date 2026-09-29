'use client';
import { useEffect, useState } from 'react';
import { date } from '@/lib/api';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import type { DossierCoverage } from '@/lib/dossier-coverage';
import type { ResearchUpdatesPage } from '@/lib/research-following';
import type { InvestigationPage } from '@/lib/dossier-reading';
import { coverageAttention, researchProgress } from '@/lib/dossier-reading';
import { readable } from '@/lib/investigation';
import { Button } from './ui/button';

type Actions = {
  onOpen: (id: string, anchor?: string) => void;
  onCoverage: () => void;
};
export function DossierReading({
  dossierId,
  onOpen,
  onCoverage,
}: Actions & { dossierId: string }) {
  const base = `/products/${product.id}/dossiers/${dossierId}`;
  const [tick, setTick] = useState(0);
  const runs = useResource<InvestigationPage>(base + '/investigations', tick);
  const updates = useResource<ResearchUpdatesPage>(
    base + '/follow/updates',
    tick,
  );
  const coverage = useResource<DossierCoverage>(base + '/coverage', tick);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  const error = runs.error || updates.error || coverage.error;
  const ready =
    !error &&
    runs.data &&
    updates.data &&
    coverage.data?.dossier_id === dossierId;
  return (
    <section
      className="dossier-reading-summary"
      aria-labelledby="dossier-reading-title"
    >
      <div className="section-header">
        <h2 id="dossier-reading-title">Research so far</h2>
        <Button
          variant="ghost"
          disabled={
            runs.refreshing || updates.refreshing || coverage.refreshing
          }
          onClick={() => setTick((n) => n + 1)}
        >
          Refresh summary
        </Button>
      </div>
      {error ? (
        <p role="alert">
          {error} Saved results are hidden until this view can be checked again.
        </p>
      ) : !ready ? (
        <output>Loading saved research…</output>
      ) : (
        <ReadingSummary
          runs={runs.data!}
          updates={updates.data!}
          coverage={coverage.data!}
          onOpen={onOpen}
          onCoverage={onCoverage}
        />
      )}
    </section>
  );
}

/** A compact view of saved records; no synthesis, acquisition or implicit review. */
export function ReadingSummary({
  runs,
  updates,
  coverage,
  onOpen,
  onCoverage,
}: Actions & {
  runs: InvestigationPage;
  updates: ResearchUpdatesPage;
  coverage: DossierCoverage;
}) {
  const latest = runs.items[0];
  const saved = updates.items[0];
  const attention = coverageAttention(coverage);
  const source = saved?.sources[0];
  return (
    <>
      <div
        className="dossier-reading-progress"
        data-research-state={latest?.status || 'empty'}
      >
        <strong>{researchProgress(latest)}</strong>
        {latest && (
          <>
            <p>{latest.question}</p>
            <p className="source-meta">Updated {date(latest.updated_at)}</p>
            <Button variant="ghost" onClick={() => onOpen(latest.id)}>
              Open latest investigation
            </Button>
          </>
        )}
        {latest &&
          ['failed', 'paused', 'cancelled'].includes(latest.status) &&
          latest.stop_reason && (
            <p className="dossier-reading-attention">{latest.stop_reason}</p>
          )}
        {latest?.status === 'completed' && (
          <p className="muted">
            Finished research can still contain gaps. Review the evidence and
            source checks below.
          </p>
        )}
      </div>
      {saved ? (
        <article className="dossier-reading-evidence">
          <p className="content-origin">
            Saved research · {date(saved.completed_at)}
          </p>
          <h3>{saved.question}</h3>
          {latest?.id !== saved.investigation_id && (
            <p className="muted">
              These retained results come from an earlier completed
              investigation.
            </p>
          )}
          <p>
            {saved.finding_count} AI findings · {saved.source_count} newly
            captured sources
          </p>
          {!!saved.comparison_counts.CONTRADICTS && (
            <p className="dossier-reading-attention">
              {saved.comparison_counts.CONTRADICTS} possible contradictions with
              earlier findings need review.
            </p>
          )}
          {!!saved.comparison_counts.UPDATES && (
            <p className="muted">
              {saved.comparison_counts.UPDATES} proposed updates to earlier
              findings are recorded.
            </p>
          )}
          {!!saved.findings.length && (
            <>
              <h4>AI findings</h4>
              <p className="muted">
                Open a finding for its evidence, later changes and human review.
              </p>
              <ol className="dossier-reading-findings">
                {saved.findings.slice(0, 3).map((finding) => (
                  <li key={finding.id}>
                    {finding.source_id ? (
                      <>
                        <p>
                          {finding.statement.length > 280
                            ? finding.statement.slice(0, 280) + '…'
                            : finding.statement}
                        </p>
                        <span className="source-meta">
                          Recorded AI assessment: {readable(finding.status)}
                        </span>
                        <div>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              onOpen(
                                saved.investigation_id,
                                `claim-${finding.id}`,
                              )
                            }
                          >
                            Read finding
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              onOpen(
                                saved.investigation_id,
                                `source-${finding.source_id}`,
                              )
                            }
                          >
                            View cited source
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p>A saved finding needs a source citation.</p>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            onOpen(
                              saved.investigation_id,
                              `claim-${finding.id}`,
                            )
                          }
                        >
                          Inspect uncited finding
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ol>
              {saved.finding_count > saved.findings.length && (
                <p className="muted">
                  Showing {saved.findings.length} of {saved.finding_count}{' '}
                  findings from this investigation.
                </p>
              )}
            </>
          )}
          {!saved.findings.length && (
            <p>
              Source evidence is saved; no machine findings were recorded in
              this investigation.
            </p>
          )}
          {source && (
            <div className="dossier-reading-source">
              <p className="content-origin">From the source · excerpt</p>
              <blockquote>{source.quote}</blockquote>
              {source.truncated && (
                <p className="source-meta">
                  Excerpt shortened in this summary. Open the saved source for
                  its retained passages.
                </p>
              )}
              <Button
                variant="ghost"
                onClick={() =>
                  onOpen(saved.investigation_id, `source-${source.id}`)
                }
              >
                {source.title || 'Open saved source'}
                {source.locator ? ` · ${source.locator}` : ''}
              </Button>
              {saved.source_count > 1 && (
                <p className="muted">
                  One excerpt shown from {saved.source_count} newly captured
                  sources.
                </p>
              )}
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => onOpen(saved.investigation_id)}
          >
            Read this investigation
          </Button>
          {updates.total > 1 && (
            <p className="muted">
              Earlier results remain in AI research. This summary shows the
              latest saved evidence update.
            </p>
          )}
        </article>
      ) : (
        <p className="dossier-reading-empty">
          No completed research with new, accessible source evidence is saved
          yet. This does not mean that no information or changes exist.
        </p>
      )}
      <div className="dossier-reading-coverage">
        <h3>
          {attention.length
            ? 'Source checks need attention'
            : 'What was checked'}
        </h3>
        {!!attention.length && (
          <ul>
            {attention.slice(0, 3).map((item) => (
              <li key={item.key}>
                <strong>{item.name}</strong> — {item.reason}
              </li>
            ))}
          </ul>
        )}
        {attention.length > 3 && (
          <p>{attention.length - 3} more items need attention.</p>
        )}
        <p className="muted">
          This is a view of saved research and recorded source checks, with
          limited excerpts. It does not establish complete coverage or verify a
          finding.
        </p>
        <Button variant="ghost" onClick={onCoverage}>
          See source checks and limitations
        </Button>
      </div>
    </>
  );
}
