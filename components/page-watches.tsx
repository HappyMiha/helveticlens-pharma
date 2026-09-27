'use client';

import {
  ArrowUpRight,
  Clock3,
  ExternalLink,
  Pause,
  Play,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DocumentWatch, Run } from '@/lib/contracts';
import { api, date } from '@/lib/api';
import { pageWatchResult, pageWatchStatus } from '@/lib/page-watch';

export function PageWatches({
  documents,
  canEdit,
  busy,
  run,
  reload,
  notify,
}: {
  documents: DocumentWatch[];
  canEdit: boolean;
  busy: string;
  run: Run;
  reload: () => Promise<void>;
  notify: (message: string) => void;
}) {
  async function settings(
    watch: DocumentWatch,
    values: { active?: boolean; auto_check_enabled?: boolean },
  ) {
    await api(`/laws/${watch.id}`, values, 'PATCH');
    await reload();
    notify(
      'Page-watch settings saved for this document across your organization.',
    );
  }
  return (
    <section className="page-watch-section">
      <div className="section-header spaced">
        <h2>Connected page watches</h2>
        <span className="tag">{documents.length} connected</span>
      </div>
      <p className="muted">
        These checks cover the connected page. Page-watch settings apply
        wherever this document is used in your organization; topic matching has
        its own pause control.
      </p>
      {documents.map((watch) => {
        const state = pageWatchStatus(watch);
        return (
          <article className="page-watch source-health" key={watch.id}>
            <div>
              <div className="source-health-heading">
                <h3>{watch.name}</h3>
                <span
                  className={`source-health-badge source-health-${state.tone}`}
                >
                  {state.label}
                </span>
              </div>
              <a
                className="source-link break-url"
                href={watch.url}
                target="_blank"
                rel="noreferrer"
              >
                {watch.url}
                <ArrowUpRight size={14} />
              </a>
              <dl className="source-health-facts">
                <div>
                  <dt>Last successful page check</dt>
                  <dd>
                    {watch.last_success_at
                      ? date(watch.last_success_at)
                      : 'No successful check time recorded'}
                  </dd>
                </div>
                <div>
                  <dt>Last attempt</dt>
                  <dd>
                    {watch.last_checked
                      ? date(watch.last_checked)
                      : 'No attempt recorded'}{' '}
                    · {pageWatchResult(watch.last_result)}
                  </dd>
                </div>
                <div>
                  <dt>Saved source version</dt>
                  <dd>
                    {watch.saved_version_at
                      ? date(watch.saved_version_at)
                      : 'No version time available'}
                  </dd>
                </div>
                <div>
                  <dt>Automatic schedule</dt>
                  <dd>
                    {!watch.active
                      ? 'Paused'
                      : !watch.auto_check_enabled
                        ? 'Off · manual checks available'
                        : watch.schedule === 'needs_operator'
                          ? 'Needs an active workspace administrator'
                          : watch.schedule === 'unscheduled'
                            ? 'No next check scheduled'
                            : watch.schedule === 'due'
                              ? `Due since ${date(watch.next_check_at || null)}`
                              : watch.next_check_at
                                ? `Next due ${date(watch.next_check_at)}`
                                : 'Next check time unavailable'}
                  </dd>
                </div>
              </dl>
              {watch.last_result === 'failed' && (
                <div className="source-health-warning" role="alert">
                  <b>The last attempt did not complete successfully.</b>
                  <p>
                    {watch.last_error ||
                      'Refresh the status or retry the check.'}{' '}
                    Saved evidence is retained; this failed attempt does not
                    establish that the source is unchanged.
                  </p>
                </div>
              )}
              {watch.synthetic && (
                <p className="source-health-warning">
                  The saved version is marked synthetic. Inspect the source
                  history before using it as evidence.
                </p>
              )}
              {watch.stale && (
                <p className="source-health-warning">
                  The last successful page check is more than 48 hours old.
                  Review the source or request a new check before relying on its
                  current state.
                </p>
              )}
              {watch.active_scan && (
                <output className="source-check-progress">
                  <Clock3 size={15} />{' '}
                  {watch.active_scan.status === 'queued'
                    ? 'Waiting in the native check queue'
                    : `Processing: ${watch.active_scan.stage.replaceAll('_', ' ')}`}{' '}
                  · Refresh status to see the latest result.
                </output>
              )}
            </div>
            <div className="watch-actions">
              <Button
                variant="outline"
                disabled={!canEdit || !!busy || !state.canCheck}
                onClick={() =>
                  void run('Queuing source check', async () => {
                    const scan = await api<{ status?: string }>('/scans', {
                      law_ids: [watch.id],
                    });
                    await reload();
                    notify(
                      `Source check ${scan.status || 'queued'}. Its latest state is shown on this page.`,
                    );
                  })
                }
              >
                <RefreshCw size={15} />{' '}
                {watch.last_result === 'failed' ? 'Retry check' : 'Check now'}
              </Button>
              <Button
                variant="ghost"
                disabled={!!busy}
                onClick={() => void run('Refreshing source status', reload)}
              >
                <RefreshCw size={15} /> Refresh status
              </Button>
              <Button
                variant="outline"
                disabled={!canEdit || !!busy}
                onClick={() =>
                  void run('Updating page watch', () =>
                    settings(watch, { active: !watch.active }),
                  )
                }
              >
                {watch.active ? <Pause size={15} /> : <Play size={15} />}
                {watch.active ? 'Pause page watch' : 'Resume page watch'}
              </Button>
              <Button
                variant="ghost"
                disabled={!canEdit || !!busy || !watch.active}
                onClick={() =>
                  void run('Updating daily checks', () =>
                    settings(watch, {
                      auto_check_enabled: !watch.auto_check_enabled,
                    }),
                  )
                }
              >
                {watch.auto_check_enabled
                  ? 'Turn daily checks off'
                  : 'Enable daily checks'}
              </Button>
              {watch.schedule === 'unscheduled' &&
                watch.active &&
                watch.auto_check_enabled && (
                  <p className="muted">
                    Turn daily checks off and on to request a new schedule.
                  </p>
                )}
              <a
                href={`https://helveticlens.ch/laws/${watch.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Open full evidence history <ExternalLink size={14} />
              </a>
            </div>
          </article>
        );
      })}
      {!documents.length && (
        <p className="muted">
          No individual page watches connected. Scheduled source collections
          continue through the selected topics.
        </p>
      )}
    </section>
  );
}
