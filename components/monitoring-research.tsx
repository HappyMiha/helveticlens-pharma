'use client';
import { MonitoringOutcomeReader } from './monitoring-outcome';
import { useEffect, useId, useRef, useState } from 'react';
import { api, date, uid } from '@/lib/api';
import { readable, sourceHref } from '@/lib/investigation';
import { currentMonitoring } from '@/lib/monitoring-research';
import type {
  MonitoringResearch,
  MonitoringTrigger,
} from '@/lib/monitoring-research';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import { DossierSection } from './research-blocks';
import { SavedPageComparison } from './saved-page-comparison';
import { DocumentHistory } from './document-history';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { NativeSelect, NativeSelectOption } from './ui/native-select';

export function MonitoringResearchPanel({
  dossierId,
  onOpen,
}: {
  dossierId: string;
  onOpen: (id: string) => void;
}) {
  const base = `/products/${product.id}/dossiers/${dossierId}/monitoring-research`;
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(0);
  const resource = useResource<MonitoringResearch>(
    `${base}?offset=${offset}`,
    tick,
  );
  const page = currentMonitoring(resource.data, resource.error, dossierId);
  const refresh = () => setTick((v) => v + 1);
  useEffect(() => {
    const timer = setInterval(() => setTick((v) => v + 1), 15000);
    return () => clearInterval(timer);
  }, []);
  return (
    <DossierSection
      id="monitoring-research"
      number="08"
      title="Keep this dossier current"
    >
      <p className="investigation-muted">
        New monitoring signals can start private research and reveal changes to
        earlier findings. Every start stays connected to its source.
      </p>
      {resource.error && (
        <p role="alert">
          {resource.error} Monitoring history is hidden until access can be
          checked again.
        </p>
      )}
      {!page && !resource.error && (
        <output>Checking automatic research settings…</output>
      )}
      {page && (
        <>
          <MonitoringPolicyStatus policy={page.policy} />
          {page.can_manage && (
            <MonitoringPolicyForm
              key={page.policy.revision}
              base={base}
              policy={page.policy}
              onSaved={refresh}
            />
          )}
          {!page.can_manage && (
            <p className="investigation-muted">
              A dossier editor with workspace monitoring permission can manage
              this mode.
            </p>
          )}
          <div className="evolution-tools">
            <h3>Monitoring research history</h3>
            <Button variant="ghost" onClick={refresh}>
              Refresh history
            </Button>
          </div>
          {!page.items.length && (
            <p>
              No recorded signals on this page. New evidence saved after
              automatic research was enabled is considered within its chosen
              scope.
            </p>
          )}
          <ol className="monitoring-research-history">
            {page.items.map((item) => (
              <MonitoringTriggerRow
                key={item.id}
                item={item}
                dossierId={dossierId}
                onOpen={onOpen}
              />
            ))}
          </ol>
          <div className="evolution-tools">
            <span>{page.total} recorded signals</span>
            <Button
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset((v) => Math.max(0, v - 20))}
            >
              Previous signals
            </Button>
            <Button
              variant="outline"
              disabled={offset + 20 >= page.total}
              onClick={() => setOffset((v) => v + 20)}
            >
              Next signals
            </Button>
          </div>
          <details>
            <summary>Research settings history</summary>
            <ol className="monitoring-research-history">
              {page.policy.history.map((item) => (
                <li key={item.revision}>
                  <strong>{readable(item.action)}</strong>
                  <p>{item.reason}</p>

                  <p className="source-meta">
                    {date(item.at)} · Settings revision {item.revision} ·{' '}
                    {item.daily_limit} starts per UTC day
                    {' · '}
                    {item.include_page_changes
                      ? 'Topic matches and saved page changes'
                      : 'Topic matches only'}
                  </p>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </DossierSection>
  );
}

export function MonitoringPolicyStatus({
  policy,
}: {
  policy: MonitoringResearch['policy'];
}) {
  return (
    <div className="monitoring-research-status">
      <strong>
        {policy.enabled
          ? 'Automatic research enabled'
          : 'Automatic research off'}
      </strong>
      <p>{policy.reason}</p>
      <p>
        {policy.include_page_changes
          ? 'Topic matches and saved page changes'
          : 'Topic matches only'}
      </p>
      {policy.page_readiness && (
        <p className="investigation-muted">{policy.page_readiness.reason}</p>
      )}
      <p className="source-meta">
        {policy.used_today} of {policy.daily_limit} starts used today · Resets
        at 00:00 UTC
      </p>
      <p className="source-meta">Last checked: {date(policy.checked_at)}</p>
      {policy.starts_on && (
        <p className="source-meta">
          New evidence after {date(policy.starts_on)}
        </p>
      )}
      <p className="investigation-muted">
        The saved monitoring feed is checked about once a minute. Capacity or
        source availability can delay research. A match is a candidate signal,
        not an established change.
      </p>
    </div>
  );
}

export function MonitoringTriggerRow({
  item,
  onOpen,
  dossierId,
}: {
  item: MonitoringTrigger;
  onOpen: (id: string) => void;
  dossierId?: string;
}) {
  const source = sourceHref(item.source.url);
  const [version, setVersion] = useState<{
    id: string;
    revision: number;
  } | null>(null);
  const page = item.page;
  return (
    <li id={`monitoring-trigger-${item.id}`}>
      <p className="source-meta">
        {date(item.matched_at)} ·{' '}
        {readable(item.investigation?.status || item.state)} · Settings revision{' '}
        {item.policy_revision}
      </p>
      <h4>{item.source.title || 'Monitoring signal'}</h4>
      {item.source_kind === 'watched_page' && (
        <p className="source-meta">Saved page change</p>
      )}
      <p>{item.reason}</p>
      {item.outcome && <MonitoringOutcomeReader outcome={item.outcome} onOpen={onOpen} />}
      {item.investigation?.stop_reason && (
        <p>{item.investigation.stop_reason}</p>
      )}
      <div className="evolution-tools">
        {source && (
          <a href={source} target="_blank" rel="noreferrer noopener">
            Open original source
          </a>
        )}
        {item.investigation && (
          <Button
            variant="outline"
            onClick={() => onOpen(item.investigation!.id)}
          >
            Open investigation
          </Button>
        )}
        {item.investigation && (
          <a href="#evidence-changes">Changes over time</a>
        )}
      </div>
      <details>
        <summary>Why this signal?</summary>
        {item.source_kind === 'watched_page' ? (
          <p>
            A linked page watch retained a new text version while page research
            was enabled. Only the new excerpt enters extraction. Earlier
            findings are compared in a separate step. A text change alone does
            not establish that a conclusion changed.
          </p>
        ) : (
          <p>
            This signal matched the dossier’s native monitoring topics while
            ongoing private research was enabled. The investigation uses the
            saved event metadata; the linked document may contain additional
            information.
          </p>
        )}
        <p className="source-meta monitoring-fingerprint">
          Signal: {item.source_identifier || item.match_id}
        </p>
        <p className="source-meta monitoring-fingerprint">
          Evidence identity:{' '}
          {item.source_revision || item.evaluation_fingerprint}
        </p>
        {item.source.sha256 && (
          <p className="source-meta monitoring-fingerprint">
            Captured excerpt SHA-256: {item.source.sha256}
          </p>
        )}
      </details>
      {page && (
        <SavedPageComparison
          page={page}
          capturedAt={item.matched_at}
          onRead={dossierId ? (position) => setVersion(position) : undefined}
        />
      )}
      {page && version && dossierId && (
        <DocumentHistory
          key={version.id}
          dossierId={dossierId}
          documentId={page.document_id}
          name={item.source.title}
          initialPage={{ ...version, offset: 0 }}
          onClose={() => setVersion(null)}
        />
      )}
    </li>
  );
}

export function MonitoringPolicyForm({
  base,
  policy,
  onSaved,
}: {
  base: string;
  policy: MonitoringResearch['policy'];
  onSaved: () => void;
}) {
  const id = useId();
  const [limit, setLimit] = useState(policy.daily_limit);
  const [pages, setPages] = useState(policy.include_page_changes || false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef({ fingerprint: '', key: '' });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function save(enabled: boolean) {
    if (busy || (enabled && !confirm)) return;
    setBusy(true);
    setError('');
    const body = {
      expected_revision: policy.revision,
      enabled,
      daily_limit: limit,
      include_page_changes: pages,
      standing_authority_confirmed: enabled && confirm,
    };
    const fingerprint = JSON.stringify(body);
    if (request.current.fingerprint !== fingerprint)
      request.current = { fingerprint, key: uid() };
    try {
      await api(base, { ...body, request_key: request.current.key });
      if (alive.current) {
        setConfirm(false);
        onSaved();
      }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <details className="monitoring-research-settings">
      <summary>
        {policy.enabled
          ? 'Manage automatic research'
          : 'Enable automatic research'}
      </summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save(true);
        }}
      >
        <fieldset disabled={busy}>
          <p>{policy.disclosure}</p>
          <label className="evolution-checkbox" htmlFor={`${id}-pages`}>
            <Checkbox
              id={`${id}-pages`}
              checked={pages}
              disabled={!policy.page_readiness?.allowed}
              onCheckedChange={(value) => {
                setPages(value === true);
                setConfirm(false);
              }}
            />
            Include changes to saved source pages
          </label>
          {policy.page_readiness && (
            <p className="investigation-muted">
              {policy.page_readiness.reason}
            </p>
          )}
          {pages && <p>{policy.page_disclosure}</p>}
          <label htmlFor={`${id}-limit`}>
            Maximum research starts per UTC day
          </label>
          <NativeSelect
            id={`${id}-limit`}
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setConfirm(false);
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((value) => (
              <NativeSelectOption key={value} value={value}>
                {value} {value === 1 ? 'start' : 'starts'}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <p className="investigation-muted">
            Explicit retries also count. Unused capacity is not carried over.
            Your existing notification preferences stay in effect.
          </p>
          <label className="evolution-checkbox" htmlFor={`${id}-confirm`}>
            <Checkbox
              id={`${id}-confirm`}
              checked={confirm}
              onCheckedChange={(value) => setConfirm(value === true)}
            />
            Allow ongoing private analysis of future topic matches
            {pages ? ' and saved page changes' : ''}, including while I am
            signed out.
          </label>
          <p className="investigation-muted">
            Saving settings ends pending work from the previous settings.
            Completed findings remain available. Monitoring changes or revoked
            access stop this authorization.
          </p>
          <div className="evolution-tools">
            <Button type="submit" disabled={busy || !confirm}>
              {busy
                ? 'Saving…'
                : policy.enabled
                  ? 'Save research settings'
                  : 'Enable automatic research'}
            </Button>
            {policy.enabled && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void save(false)}
              >
                Turn off automatic research
              </Button>
            )}
          </div>
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </form>
    </details>
  );
}
