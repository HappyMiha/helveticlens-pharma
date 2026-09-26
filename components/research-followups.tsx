'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, ClipboardList, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ActionsPage, WorkAction } from '@/lib/contracts';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import { ActionRow } from './workbench';

export function ResearchFollowups({
  dossierId,
  threadId,
  refreshToken,
  busy,
  onEdit,
}: {
  dossierId: string;
  threadId: string;
  refreshToken: number;
  busy: boolean;
  onEdit: (action: WorkAction) => void;
}) {
  const [offset, setOffset] = useState(0);
  const { data, error, loading, refresh } = useResource<ActionsPage>(
    `/products/${product.id}/dossiers/${dossierId}/actions?thread_id=${threadId}&offset=${offset}`,
    refreshToken,
  );
  return (
    <section
      className="research-followups surface"
      aria-label="Follow-up from this question"
    >
      <div className="section-header">
        <h3>
          <ClipboardList size={18} /> Follow-up from this question
        </h3>
        {data && <span className="muted">{data.total} actions</span>}
      </div>
      <p className="muted">
        Keep responsibility and recorded outcomes beside the question that
        prompted the work. Completing an action does not accept an answer.
      </p>
      {error && (
        <div className="banner error" role="alert">
          {error}
          <Button variant="outline" onClick={() => void refresh()}>
            <RefreshCw size={15} /> Retry
          </Button>
        </div>
      )}
      {loading && <output>Loading follow-up…</output>}
      {data && (
        <>
          {data.items.map((action) => (
            <div className="research-followup" key={action.id}>
              <ActionRow action={action} onEdit={() => onEdit(action)} />
              {action.evidence.research?.gap && (
                <p className="followup-gap">
                  <b>Gap:</b> {action.evidence.research.gap}
                </p>
              )}
              {action.outcome && (
                <div className="followup-outcome">
                  <b>Recorded outcome</b>
                  <p>{action.outcome}</p>
                </div>
              )}
            </div>
          ))}
          {!data.total && (
            <p className="followup-empty">
              Team actions created from this question or its research gaps will
              appear here, with their owner, deadline and outcome.
            </p>
          )}
          {data.total > 50 && (
            <div className="work-pagination">
              <span>
                {offset + 1}–{offset + data.items.length} of {data.total}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || offset === 0}
                onClick={() => setOffset((value) => Math.max(0, value - 50))}
              >
                <ArrowLeft size={14} /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || offset + data.items.length >= data.total}
                onClick={() => setOffset((value) => value + 50)}
              >
                Next <ArrowRight size={14} />
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
