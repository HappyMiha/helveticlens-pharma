'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { api, date, uid } from '@/lib/api';
import { readable } from '@/lib/investigation';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import { currentWebResearch } from '@/lib/web-research';
import type { WebResearch, WebTrigger } from '@/lib/web-research';
import { DossierSection } from './research-blocks';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Textarea } from './ui/textarea';
import { NativeSelect, NativeSelectOption } from './ui/native-select';

export function WebResearchPanel({
  dossierId,
  onOpen,
}: {
  dossierId: string;
  onOpen: (id: string) => void;
}) {
  const base = `/products/${product.id}/dossiers/${dossierId}/web-research`;
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(0);
  const resource = useResource<WebResearch>(`${base}?offset=${offset}`, tick);
  const page = currentWebResearch(resource.data, resource.error, dossierId);
  const refresh = () => setTick((v) => v + 1);
  useEffect(() => {
    const timer = setInterval(() => setTick((v) => v + 1), 15000);
    return () => clearInterval(timer);
  }, []);
  return (
    <DossierSection
      id="web-research"
      number="09"
      title="Keep discovering new sources"
    >
      <p className="investigation-muted">
        Save a public question to search daily or weekly. New evidence joins
        this dossier; unchanged captures skip repeated analysis.
      </p>
      {resource.error && (
        <p role="alert">
          {resource.error} Search history is hidden until access can be checked
          again.
        </p>
      )}
      {!page && !resource.error && (
        <output>Checking recurring search settings…</output>
      )}
      {page && (
        <>
          <WebPolicyStatus policy={page.policy} />
          {page.can_manage ? (
            <WebPolicyForm
              key={page.policy.revision}
              base={base}
              policy={page.policy}
              onSaved={refresh}
            />
          ) : (
            <p className="investigation-muted">
              A dossier editor can manage recurring search.
            </p>
          )}
          <div className="evolution-tools">
            <h3>Recurring search history</h3>
            <Button variant="ghost" onClick={refresh}>
              Refresh history
            </Button>
          </div>
          {!page.items.length && (
            <p>
              No searches recorded on this page. Enabling the schedule
              authorizes the first run when capacity is available.
            </p>
          )}
          <ol className="monitoring-research-history">
            {page.items.map((item) => (
              <WebTriggerRow key={item.id} item={item} onOpen={onOpen} />
            ))}
          </ol>
          <div className="evolution-tools">
            <span>{page.total} recorded searches</span>
            <Button
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset((v) => Math.max(0, v - 20))}
            >
              Previous searches
            </Button>
            <Button
              variant="outline"
              disabled={offset + 20 >= page.total}
              onClick={() => setOffset((v) => v + 20)}
            >
              Next searches
            </Button>
          </div>
          <details>
            <summary>Search settings history</summary>
            <ol className="monitoring-research-history">
              {page.policy.history.map((item) => (
                <li key={item.revision}>
                  <strong>
                    {readable(item.action)} · {date(item.at)}
                  </strong>
                  <p>{item.question}</p>
                  <p>{item.reason}</p>
                  <p className="source-meta">
                    Every {item.cadence_hours} hours · Settings revision{' '}
                    {item.revision}
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

export function WebPolicyStatus({ policy }: { policy: WebResearch['policy'] }) {
  return (
    <div className="monitoring-research-status">
      <strong>
        {policy.enabled
          ? 'Recurring public search enabled'
          : 'Recurring public search off'}
      </strong>
      {policy.question && <p>{policy.question}</p>}
      <p>{policy.reason}</p>
      <p className="investigation-muted">{policy.readiness.reason}</p>
      <p>
        {policy.cadence_hours === 24 ? 'Daily' : 'Weekly'} · {policy.used_today}{' '}
        of {policy.daily_limit} starts/retries used today
      </p>
      <p className="source-meta">Last checked: {date(policy.checked_at)}</p>
      <p className="source-meta">
        Next search:{' '}
        {policy.next_run_at ? date(policy.next_run_at) : 'Not scheduled'}
      </p>
      <p className="investigation-muted">
        Capacity or source availability can delay a run. Missed runs do not
        accumulate. The daily limit resets at 00:00 UTC.
      </p>
    </div>
  );
}

export function WebPolicyForm({
  base,
  policy,
  onSaved,
}: {
  base: string;
  policy: WebResearch['policy'];
  onSaved: () => void;
}) {
  const id = useId();
  const [question, setQuestion] = useState(policy.question);
  const [cadence, setCadence] = useState(policy.cadence_hours);
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
    if (busy || (enabled && (!confirm || question.trim().length < 5))) return;
    setBusy(true);
    setError('');
    const body = {
      expected_revision: policy.revision,
      enabled,
      question: enabled ? question.trim() : policy.question,
      cadence_hours: enabled ? cadence : policy.cadence_hours,
      standing_public_query_confirmed: enabled && confirm,
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
        {policy.enabled ? 'Manage recurring search' : 'Set up recurring search'}
      </summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save(true);
        }}
      >
        <fieldset disabled={busy}>
          <label htmlFor={`${id}-question`}>Public search question</label>
          <Textarea
            id={`${id}-question`}
            value={question}
            minLength={5}
            maxLength={300}
            required
            rows={3}
            placeholder="Which new public sources address this topic?"
            onChange={(event) => {
              setQuestion(event.target.value);
              setConfirm(false);
            }}
          />
          <p className="investigation-muted">
            Write only information you intend to send to external search
            providers. Private notes are not added to this question.
          </p>
          <label htmlFor={`${id}-cadence`}>Repeat search</label>
          <NativeSelect
            id={`${id}-cadence`}
            value={cadence}
            onChange={(event) => {
              setCadence(Number(event.target.value) as 24 | 168);
              setConfirm(false);
            }}
          >
            <NativeSelectOption value={24}>
              Daily · every 24 hours
            </NativeSelectOption>
            <NativeSelectOption value={168}>
              Weekly · every 7 days
            </NativeSelectOption>
          </NativeSelect>
          <p>{policy.disclosure}</p>
          <label className="evolution-checkbox" htmlFor={`${id}-confirm`}>
            <Checkbox
              id={`${id}-confirm`}
              checked={confirm}
              onCheckedChange={(value) => setConfirm(value === true)}
            />
            Allow this public question to be searched on this schedule,
            including while I am signed out, and analyse the resulting evidence.
          </label>
          <p className="investigation-muted">
            The first search starts when capacity is available. Saving changes
            cancels unfinished work from the previous settings. Completed
            findings stay available.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="evolution-tools">
            <Button
              type="submit"
              disabled={busy || !confirm || question.trim().length < 5}
            >
              {busy
                ? 'Saving…'
                : policy.enabled
                  ? 'Save search schedule'
                  : 'Enable recurring search'}
            </Button>
            {policy.enabled && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void save(false)}
              >
                Pause recurring search
              </Button>
            )}
          </div>
        </fieldset>
      </form>
    </details>
  );
}

export function WebTriggerRow({
  item,
  onOpen,
}: {
  item: WebTrigger;
  onOpen: (id: string) => void;
}) {
  return (
    <li id={`web-trigger-${item.id}`}>
      <p className="source-meta">
        {date(item.created_at)} · {readable(item.investigation.status)} ·
        Settings revision {item.policy_revision}
      </p>
      <h4>{item.question}</h4>
      <p>
        {item.analysed_sources} sources analysed · {item.unchanged_sources}{' '}
        unchanged captures skipped
      </p>
      {item.investigation.stop_reason && (
        <p>{item.investigation.stop_reason}</p>
      )}
      <Button variant="outline" onClick={() => onOpen(item.investigation.id)}>
        Open search investigation
      </Button>
      {!!item.coverage.length && (
        <details>
          <summary>Indexes, timing and decision measurements</summary>
          {item.coverage.map((coverage, i) => (
            <div key={i}>
              <p>
                Selected decision engine:{' '}
                {coverage.selected_engine || 'Unavailable'} · Search elapsed:{' '}
                {coverage.latency_ms === null
                  ? 'Unknown'
                  : `${coverage.latency_ms} ms`}
              </p>
              {coverage.error && <p>{coverage.error}</p>}
              <ul>
                {coverage.retrieval?.lanes?.map((lane) => (
                  <li key={lane.name}>
                    {lane.name}: {readable(lane.status)} · {lane.count}{' '}
                    candidates
                  </li>
                ))}
              </ul>
              <ul>
                {coverage.engines.map((engine) => (
                  <li key={engine.engine}>
                    <strong>{engine.engine}</strong>
                    {engine.error ? ` · ${readable(engine.error)}` : ''}
                    <p>
                      Elapsed:{' '}
                      {engine.latency_ms == null
                        ? 'Unknown'
                        : `${engine.latency_ms} ms`}{' '}
                      · Decision cost estimate:{' '}
                      {engine.estimated_cost_usd == null
                        ? 'Unknown'
                        : `$${engine.estimated_cost_usd.toFixed(6)}`}
                    </p>
                    {engine.cost_basis && (
                      <p className="source-meta">
                        USD per million tokens:{' '}
                        {engine.cost_basis.input_usd_per_million} input /{' '}
                        {engine.cost_basis.output_usd_per_million} output
                      </p>
                    )}
                    <p>
                      Provider confidence:{' '}
                      {engine.mean_confidence == null
                        ? 'Not reported'
                        : engine.mean_confidence.toFixed(3)}
                      . Independent accuracy: not evaluated for this run.
                    </p>
                    {engine.cost_scope && (
                      <p className="investigation-muted">{engine.cost_scope}</p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="investigation-muted">
                {coverage.scope ||
                  'Bounded discovery across the reported indexes.'}{' '}
                Source-reading, extraction and comparison costs are not included
                in these decision estimates.
              </p>
            </div>
          ))}
        </details>
      )}
    </li>
  );
}
