'use client';
import { EntityIdentities } from './entity-identity';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { api, uid } from '@/lib/api';
import { product } from '@/lib/product';
import { usePublicSession } from '@/lib/use-public-session';
import { useResource } from '@/lib/use-resource';
import { isRunning, readable } from '@/lib/investigation';
import type { PublicResearch, PublicResearchPage } from '@/lib/public-research';
import type { Contribution } from '@/lib/community';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { InvestigationFindings } from './investigation-findings';
import { LensAnalysisState } from './lens';
import { DossierTimeline, TransparencyPanel } from './transparency-panel';
import { useAskSearch } from './universal-ask-search';
import { ClaimEvolution } from './claim-evolution';
import type { EvidenceChangesPage } from '@/lib/claim-evolution';

export function PublicResearchView({
  publicationId,
  revision,
  initial,
  selectedId,
  initialValue,
  initialChanges = null,
}: {
  publicationId: string;
  revision: number;
  initial: PublicResearchPage | null;
  selectedId: string;
  initialValue: PublicResearch | null;
  initialChanges?: EvidenceChangesPage | null;
}) {
  const base = `/products/${product.id}/public-dossiers/${publicationId}/research`;
  const [offset, setOffset] = useState(0);
  const [selection, setSelected] = useState(
    selectedId || initial?.items[0]?.id || '',
  );
  const [tick, setTick] = useState(0);
  const [fenced, setFenced] = useState(false);
  const session = usePublicSession();
  const identity =
    !session.error && session.data?.authenticated ? session.data : null;
  const resource = useResource<PublicResearchPage>(
    `${base}?offset=${offset}`,
    tick,
  );
  const selected = selection || resource.data?.items[0]?.id || '';
  const detail = useResource<PublicResearch>(
    selected ? `${base}/${selected}` : null,
    tick,
  );
  const controls = useResource<{ can_control: boolean }>(
    identity && selected
      ? `${base}/${selected}/workspace?account=${encodeURIComponent(identity.user.id)}&workspace=${encodeURIComponent(identity.organization.id)}`
      : null,
    tick,
  );
  const page = resource.error
    ? null
    : resource.data || (offset === 0 ? initial : null);
  const scopeValid =
    !fenced &&
    !resource.error &&
    page?.publication_revision === revision &&
    page.living_research;
  const value =
    scopeValid && !detail.error
      ? detail.data || (initialValue?.id === selected ? initialValue : null)
      : null;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => setTick((v) => v + 1), []);
  const select = useCallback(
    (id: string) => {
      setSelected(id);
      const url = new URL(window.location.href);
      url.searchParams.set('research', id);
      url.hash = `investigation-${id}`;
      window.history.replaceState(window.history.state, '', url);
      refresh();
    },
    [refresh],
  );
  useEffect(() => {
    const timer = setInterval(refresh, 15000);
    window.addEventListener('helvetic-public-research-changed', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('helvetic-public-research-changed', refresh);
    };
  }, [refresh]);
  const running = isRunning(value);
  useEffect(() => {
    if (!selected || !running) return;
    const source = new EventSource(`/api${base}/${selected}/events`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 250);
    };
    source.addEventListener('activity', changed);
    source.addEventListener('checkpoint', changed);
    source.addEventListener('access_changed', () => {
      source.close();
      setFenced(true);
      setSelected('');
      setError(
        'This research is no longer public. Refresh to read the current dossier.',
      );
      refresh();
    });
    return () => {
      source.close();
      if (timer) clearTimeout(timer);
    };
  }, [base, selected, running, refresh]);
  const hasValue = !!value;
  useEffect(() => {
    if (hasValue && window.location.hash) {
      const element = document.getElementById(window.location.hash.slice(1));
      element?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
  }, [selected, hasValue]);
  async function control(action: 'pause' | 'resume' | 'cancel' | 'retry') {
    if (!value || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`${base}/${value.id}/control`, {
        action,
        expected_revision: value.revision,
      });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
      refresh();
    }
  }
  return (
    <section
      className="dossier-investigation public-research"
      id="public-research"
      aria-label="Living public research"
    >
      <div className="investigation-introduction">
        <h2>Investigate together.</h2>
        <p>
          Questions, findings and sources are public. New contributions can
          develop this dossier without exposing its private workspace.
        </p>
      </div>
      {identity && scopeValid ? (
        <PublicAsk
          key={`${identity.user.id}:${identity.organization.id}`}
          publicationId={publicationId}
          revision={revision}
          onStarted={select}
        />
      ) : (
        <p>
          <a href="#discussion">Sign in to add a public question or source.</a>
        </p>
      )}
      {(error || resource.error || detail.error) && (
        <div role="alert" className="investigation-error">
          {error || resource.error || detail.error}{' '}
          <Button variant="outline" onClick={refresh}>
            Refresh research
          </Button>
        </div>
      )}
      {!scopeValid && page && (
        <p className="public-reading-note">
          The published version changed.{' '}
          <a href={`/public-dossiers/${publicationId}`}>
            Read the current dossier
          </a>
          .
        </p>
      )}
      {page && scopeValid && (
        <>
          <p className="investigation-muted">
            {page.total} public investigations · findings stay attributed to
            their sources.
          </p>
          {!!page.items.length && (
            <Select
              value={selected}
              onValueChange={(id) => {
                if (id) select(id);
              }}
            >
              <SelectTrigger aria-label="Public investigation">
                <SelectValue placeholder="Choose an investigation" />
              </SelectTrigger>
              <SelectContent>
                {page.items.map((run) => (
                  <SelectItem key={run.id} value={run.id}>
                    {readable(run.status)} · {run.question}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="investigation-controls">
            {offset > 0 && (
              <Button
                variant="outline"
                onClick={() => setOffset(Math.max(0, offset - 20))}
              >
                Newer investigations
              </Button>
            )}
            {offset + 20 < page.total && (
              <Button variant="outline" onClick={() => setOffset(offset + 20)}>
                Older investigations
              </Button>
            )}
          </div>
          {!page.total && (
            <p>
              No public research yet. Start with a focused question or add a
              source below.
            </p>
          )}
        </>
      )}
      {value && (
        <div id={`investigation-${value.id}`}>
          <div className="investigation-run-heading">
            <div>
              <span className="investigation-status" data-status={value.status}>
                {readable(value.status)}
              </span>
              <h2>{value.question}</h2>
            </div>
            {controls.data?.can_control && !controls.error && (
              <div className="investigation-controls">
                {running && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void control('pause')}
                  >
                    Pause
                  </Button>
                )}
                {value.status === 'paused' && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void control('resume')}
                  >
                    Resume
                  </Button>
                )}
                {(running || value.status === 'paused') && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void control('cancel')}
                  >
                    Cancel
                  </Button>
                )}
                {['completed', 'failed'].includes(value.status) &&
                  value.branches.some((b) => b.status === 'failed') && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void control('retry')}
                    >
                      Retry unavailable steps
                    </Button>
                  )}
              </div>
            )}
          </div>
          <output aria-live="polite">
            {running
              ? 'Progress updates automatically from saved research activity.'
              : value.stop_reason}
          </output>
          {value.original && (
            <details className="public-reading-note">
              <summary>Original contribution · {value.original.author}</summary>
              <p className="public-body">{value.original.body}</p>
              {value.original.kind === 'file' && (
                <a
                  href={`/api/products/${product.id}/public-dossiers/${publicationId}/files/${value.original.id}`}
                >
                  Download original · {value.original.title}
                </a>
              )}
            </details>
          )}
          <LensAnalysisState value={value} />
          <InvestigationFindings value={value} />
          <section id="research-timeline">
            <h3>Research activity</h3>
            <DossierTimeline value={value} />
          </section>
          <section>
            <h3>Research paths & open questions</h3>
            <ol className="investigation-branches">
              {value.branches.map((branch) => (
                <li key={branch.id}>
                  <strong>{branch.query}</strong>
                  <p>{branch.reason}</p>
                  <p>
                    {readable(branch.status)} · {readable(branch.phase)}
                  </p>
                  {branch.error && <p>{branch.error}</p>}
                </li>
              ))}
            </ol>
          </section>
          <TransparencyPanel value={value} />
        </div>
      )}
      {scopeValid && (
        <EntityIdentities
          key={`entity-identities:${publicationId}:${revision}:${identity?.user.id || ''}:${identity?.organization.id || ''}`}
          base={`/products/${product.id}/public-dossiers/${publicationId}/entity-identities`}
          publicationRevision={revision}
          accountKey={
            identity
              ? `${identity.user.id}:${identity.organization.id}`
              : undefined
          }
          refreshToken={tick}
          onOpen={select}
          onChange={refresh}
        />
      )}
      {scopeValid && (
        <ClaimEvolution
          key={`claim-evolution:${publicationId}:${revision}:${identity?.user.id || ''}:${identity?.organization.id || ''}`}
          base={`/products/${product.id}/public-dossiers/${publicationId}/evidence-changes`}
          publicationRevision={revision}
          accountKey={
            identity
              ? `${identity.user.id}:${identity.organization.id}`
              : undefined
          }
          initial={initialChanges}
          refreshToken={tick}
          onOpen={select}
          onChange={refresh}
        />
      )}
    </section>
  );
}

function PublicAsk({
  publicationId,
  revision,
  onStarted,
}: {
  publicationId: string;
  revision: number;
  onStarted: (id: string) => void;
}) {
  const id = useId();
  const { register } = useAskSearch();
  const [question, setQuestion] = useState('');
  const [author, setAuthor] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(
    () =>
      register({
        id: publicationId,
        title: 'this public dossier',
        canInvestigate: true,
        unavailable: false,
        investigate: async (text) => {
          setQuestion(text);
          setConsent(false);
          document.getElementById(`${id}-question`)?.focus();
          return true;
        },
      }),
    [register, publicationId, id],
  );
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !consent) return;
    const fingerprint = JSON.stringify([question, author, revision]);
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = { fingerprint, key: uid() };
    setBusy(true);
    setError('');
    try {
      const result = await api<{ contribution: Contribution }>(
        `/products/${product.id}/public-dossiers/${publicationId}/discussion`,
        {
          request_key: pending.current.key,
          publication_revision: revision,
          confirm_public: true,
          kind: 'research_request',
          analyse_publicly: true,
          public_query_confirmed: true,
          content: { author_label: author, body: question, sources: [] },
        },
      );
      pending.current = null;
      setQuestion('');
      setConsent(false);
      if (result.contribution.research)
        onStarted(result.contribution.research.id);
      window.dispatchEvent(new Event('helvetic-public-research-changed'));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="public-ask">
      <fieldset disabled={busy}>
        <label htmlFor={`${id}-question`}>
          Ask / Investigate
          <Textarea
            id={`${id}-question`}
            value={question}
            minLength={10}
            maxLength={300}
            required
            placeholder="What should we investigate next?"
            onChange={(e) => {
              setQuestion(e.target.value);
              setConsent(false);
            }}
          />
        </label>
        <label htmlFor={`${id}-author`}>
          Public display name
          <Input
            id={`${id}-author`}
            value={author}
            minLength={2}
            maxLength={100}
            required
            onChange={(e) => {
              setAuthor(e.target.value);
              setConsent(false);
            }}
          />
        </label>
        <label className="publication-consent" htmlFor={`${id}-consent`}>
          <Checkbox
            id={`${id}-consent`}
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
          />
          <span>
            Publish my question and its analysis. This question and entity names
            found in public sources may be sent to external search. I have
            excluded confidential information.
          </span>
        </label>
        <Button type="submit" disabled={!consent || busy}>
          {busy ? 'Starting…' : 'Investigate publicly'}
        </Button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
