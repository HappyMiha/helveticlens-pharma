'use client';

import { date, text } from '@/lib/api';
import { product } from '@/lib/product';
import { sourceReference } from '@/lib/source-reading';
import { useResource } from '@/lib/use-resource';
import {
  pageCoverage,
  packCoverage,
  streamCoverage,
} from '@/lib/dossier-coverage';
import type { DossierCoverage, CoverageStatus } from '@/lib/dossier-coverage';
import { Button } from '@/components/ui/button';
import { PageCheckHistory } from './page-check-history';

function Status({ value }: { value: CoverageStatus }) {
  return (
    <span className="coverage-state" data-attention={value.attention}>
      {value.label}
    </span>
  );
}
function Time({ value }: { value: string | null | undefined }) {
  return value ? (
    <time dateTime={value}>{date(value)}</time>
  ) : (
    <>Not recorded</>
  );
}

export function CoverageReading({
  value,
  onMonitoring,
  onInvestigation,
}: {
  value: DossierCoverage;
  onMonitoring: () => void;
  onInvestigation: (id: string) => void;
}) {
  const web = value.web_research;
  return (
    <div className="coverage-reading">
      <p className="coverage-caption">
        Saved state as of <Time value={value.captured_at} /> · Europe/Zurich
      </p>
      <p className="coverage-limit">
        Coverage has limits. These records do not represent a complete scan of
        this dossier or the internet.
      </p>
      <details className="coverage-group">
        <summary>
          Saved pages <span>{value.documents.length} connected</span>
        </summary>
        {!value.documents.length && (
          <p>
            No pages connected for monitoring. Saved references and files remain
            in the library below.
          </p>
        )}
        <ul className="coverage-list">
          {value.documents.map((page) => {
            const href = sourceReference(page.url)?.href;
            return (
              <li key={page.id}>
                <div className="coverage-row-title">
                  <h4>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer nofollow ugc"
                      >
                        {page.name} ↗
                      </a>
                    ) : (
                      page.name
                    )}
                  </h4>
                  <Status value={pageCoverage(page)} />
                </div>
                <dl className="coverage-times">
                  <div>
                    <dt>Last successful check</dt>
                    <dd>
                      <Time
                        value={page.synthetic ? null : page.last_success_at}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>Last attempt</dt>
                    <dd>
                      <Time value={page.last_checked} />
                    </dd>
                  </div>
                </dl>
                {page.last_error && (
                  <p className="coverage-explanation">{page.last_error}</p>
                )}
                <p className="coverage-caption">
                  {!page.active ? (
                    'Monitoring is paused.'
                  ) : !page.auto_check_enabled ? (
                    'Automatic checks are off.'
                  ) : page.next_check_at ? (
                    <>
                      Next planned check: <Time value={page.next_check_at} />.
                    </>
                  ) : (
                    'Next check not scheduled.'
                  )}
                </p>
                <PageCheckHistory key={`${value.dossier_id}:${page.id}`} dossierId={value.dossier_id} documentId={page.id} name={page.name} onInvestigation={onInvestigation} />
              </li>
            );
          })}
        </ul>
      </details>
      <details className="coverage-group">
        <summary>
          Topic sources <span>{value.packs.length} selected collections</span>
        </summary>
        <p>
          Shared source collection and your topic matching have separate states.
          A collected feed does not mean every document was checked for this
          dossier.
        </p>
        {value.profile_status === 'draft' && (
          <p className="coverage-explanation">
            Draft choices only. Topic monitoring has not been started.
          </p>
        )}
        {!value.topics.length && <p>No saved monitoring topics.</p>}
        <ul className="coverage-topic-list">
          {value.topics.map((topic) => (
            <li key={topic.id}>
              <strong>{topic.name}</strong> —{' '}
              {topic.status === 'active'
                ? 'matching active'
                : topic.status === 'paused'
                  ? 'matching paused'
                  : topic.status === 'archived'
                    ? 'archived'
                    : 'saved topic unavailable'}
              {topic.revision !== null && <> · revision {topic.revision}</>}
              {!topic.pack_ids.length && ' · no source collections recorded'}
            </li>
          ))}
        </ul>
        {!value.packs.length && (
          <p>
            No source collections selected. This is not evidence that no changes
            occurred.
          </p>
        )}
        <ul className="coverage-list">
          {value.packs.map((pack) => (
            <li key={pack.id}>
              <div className="coverage-row-title">
                <h4>{text(pack.name) || pack.id}</h4>
                <Status value={packCoverage(pack)} />
              </div>
              <details className="coverage-source-details">
                <summary>Sources and recorded checks</summary>
                <ul className="coverage-streams">
                  {pack.streams.map((stream) => (
                    <li key={`${stream.connector}:${stream.stream}`}>
                      <strong>{stream.publisher}</strong>{' '}
                      <span className="coverage-caption">{stream.stream}</span>
                      <Status value={streamCoverage(stream)} />
                      <dl className="coverage-times">
                        <div>
                          <dt>Last successful collection</dt>
                          <dd>
                            <Time value={stream.last_success_at} />
                          </dd>
                        </div>
                        <div>
                          <dt>Last attempt</dt>
                          <dd>
                            <Time value={stream.last_attempt_at} />
                          </dd>
                        </div>
                      </dl>
                      {!!stream.known_gaps.length && (
                        <details>
                          <summary>Known source limits</summary>
                          <ul>
                            {stream.known_gaps.map((gap, i) => (
                              <li key={i}>{gap}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </li>
                  ))}
                  {pack.unsupported_streams.map((stream) => (
                    <li key={`${stream.connector}:${stream.stream}`}>
                      <strong>
                        {stream.connector} / {stream.stream}
                      </strong>
                      <Status
                        value={{
                          label: 'Unsupported source · no verified check',
                          attention: true,
                        }}
                      />
                    </li>
                  ))}
                </ul>
                {!pack.streams.length && !pack.unsupported_streams.length && (
                  <p>No source details available for this saved selection.</p>
                )}
              </details>
            </li>
          ))}
        </ul>
      </details>
      <details className="coverage-group">
        <summary>
          Recurring web research <span>{web.enabled ? 'Enabled' : 'Off'}</span>
        </summary>
        <p>{web.reason}</p>
        <p className="coverage-caption">
          Last scheduling check: <Time value={web.last_scheduler_check_at} />. A
          scheduling check is not a successful source search.
        </p>
        {web.latest_run ? (
          <div className="coverage-latest-run">
            <p>
              Latest investigation: <strong>{web.latest_run.status}</strong> ·
              started <Time value={web.latest_run.created_at} />
              {web.latest_run.policy_revision !== web.revision &&
                ' · from earlier search settings'}
            </p>
            <Button
              variant="outline"
              onClick={() => onInvestigation(web.latest_run!.id)}
            >
              Read investigation & source limits
            </Button>
          </div>
        ) : (
          <p>No recurring investigation recorded.</p>
        )}
      </details>
      <div className="coverage-footer">
        <Button variant="ghost" onClick={onMonitoring}>
          Open monitoring settings
        </Button>
        <details>
          <summary>What this view includes</summary>
          <ul>
            {value.limitations.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}

export function DossierCoveragePanel({
  dossierId,
  refreshToken,
  onMonitoring,
  onInvestigation,
}: {
  dossierId: string;
  refreshToken: number;
  onMonitoring: () => void;
  onInvestigation: (id: string) => void;
}) {
  const { data, error, loading, refreshing, refresh } =
    useResource<DossierCoverage>(
      `/products/${product.id}/dossiers/${dossierId}/coverage`,
      refreshToken,
    );
  const current =
    !error &&
    data?.dossier_id === dossierId &&
    data.schema_id === 'dossier-coverage/v1'
      ? data
      : null;
  return (
    <section
      className="dossier-coverage"
      data-content-kind="workspace"
      aria-label="Source checks"
    >
      <div className="section-header">
        <div>
          <h2>What has been checked</h2>
          <p className="muted">
            Successful checks, delays and gaps in this dossier’s sources.
          </p>
        </div>
        <Button
          variant="ghost"
          disabled={loading || refreshing}
          onClick={() => void refresh()}
        >
          Refresh status
        </Button>
      </div>
      {loading && <output>Reading saved source status…</output>}
      {error && (
        <p className="banner error" role="alert">
          Source status could not be loaded. {error}
        </p>
      )}
      {!loading && !error && data && !current && (
        <p role="alert">
          This source-status format is unavailable. Refresh to try again.
        </p>
      )}
      {current && (
        <CoverageReading
          value={current}
          onMonitoring={onMonitoring}
          onInvestigation={onInvestigation}
        />
      )}
    </section>
  );
}
