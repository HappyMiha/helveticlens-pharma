'use client';
import { useEffect, useRef, useState } from 'react';
import { api, date, uid } from '@/lib/api';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import { currentWebResearch } from '@/lib/web-research';
import type { WebResearch } from '@/lib/web-research';
import { Button } from './ui/button';

/** Actual saved policy, kept separate from the legacy topic-profile status. */
export function QuestionMonitoring({
  dossierId,
  onChanged,
  onManage,
}: {
  dossierId: string;
  onChanged: () => Promise<void>;
  onManage?: () => void;
}) {
  const base = `/products/${product.id}/dossiers/${dossierId}/web-research`;
  const resource = useResource<WebResearch>(base);
  const page = currentWebResearch(resource.data, resource.error, dossierId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const refresh = resource.refresh;
  useEffect(() => {
    const timer = setInterval(() => void refresh(), 30000);
    return () => clearInterval(timer);
  }, [refresh]);
  async function toggle() {
    if (!page?.can_manage || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      await api(base, {
        request_key: uid(),
        expected_revision: page.policy.revision,
        enabled: !page.policy.enabled,
        question: page.policy.question,
        cadence_hours: page.policy.cadence_hours,
        standing_public_query_confirmed: !page.policy.enabled,
      });
      await resource.refresh();
      await onChanged();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not update monitoring.',
      );
      // A lost write response is not evidence that the old policy still holds.
      await resource.refresh();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="question-monitoring" aria-label="Question monitoring">
      {!page && !resource.error && <output>Checking monitoring…</output>}
      {resource.error && (
        <p role="alert">
          {resource.error}{' '}
          <Button variant="ghost" onClick={() => void resource.refresh()}>
            Refresh monitoring
          </Button>
        </p>
      )}
      {page && (
        <>
          <div>
            <strong>
              {page.policy.enabled
                ? page.policy.readiness.configured
                  ? 'Monitoring is on'
                  : 'Monitoring is waiting for setup'
                : 'Monitoring is paused'}
            </strong>
            <p>
              {page.policy.cadence_hours === 24 ? 'Daily' : 'Weekly'}{' '}
              public-source checks · updates in this dossier.
            </p>
            {page.policy.enabled &&
              page.policy.readiness.configured &&
              page.policy.next_run_at && (
                <p className="muted">
                  Next scheduled check: {date(page.policy.next_run_at)}
                </p>
              )}
            {page.policy.enabled && !page.policy.readiness.configured && (
              <output>{page.policy.readiness.reason}</output>
            )}
            {!page.policy.enabled && (
              <p className="muted">
                Resuming sends the saved question to public research providers
                again.
              </p>
            )}
          </div>
          {page.can_manage && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => (onManage ? onManage() : void toggle())}
            >
              {onManage
                ? 'Manage monitoring and updates'
                : busy
                  ? 'Saving…'
                  : page.policy.enabled
                    ? 'Pause monitoring'
                    : 'Resume monitoring'}
            </Button>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
