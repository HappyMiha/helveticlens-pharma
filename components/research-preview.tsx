'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { api, date, uid } from '@/lib/api';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import { researchRequest } from '@/lib/research-preview';
import { dossierHref } from '@/lib/dossier-navigation';
import type { Entry, ResearchPreview as Preview } from '@/lib/contracts';

function sourceUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

export function ResearchPreview({
  dossierId,
  questionId,
  canEdit,
  onClose,
  onSaved,
}: {
  dossierId: string;
  questionId: string;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const root = `/products/${product.id}/dossiers/${encodeURIComponent(dossierId)}/discussion/${encodeURIComponent(questionId)}`;
  const { data, error, loading, refresh } = useResource<Preview>(
    `${root}/research-preview`,
  );
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failure, setFailure] = useState('');
  const [saved, setSaved] = useState<Entry | null>(null);
  const keys = useRef(new Map<string, string>());
  const lifecycle = useRef({ active: true });
  useEffect(() => {
    const state = lifecycle.current;
    state.active = true;
    return () => {
      state.active = false;
    };
  }, []);
  async function refreshInputs() {
    if (saving || refreshing) return;
    setRefreshing(true);
    setFailure('');
    try {
      await refresh();
    } finally {
      if (lifecycle.current.active) setRefreshing(false);
    }
  }
  async function generate() {
    if (saving || refreshing || (!saved && !canEdit) || (!saved && (!data || error)))
      return;
    setSaving(true);
    setFailure('');
    let result = saved;
    try {
      if (!result && data) {
        result = await api<Entry>(
          `${root}/research`,
          researchRequest(data, keys.current, uid),
        );
        if (!lifecycle.current.active) return;
        setSaved(result);
      }
      await onSaved();
      if (lifecycle.current.active) onClose();
    } catch (e) {
      if (lifecycle.current.active)
        setFailure(
          `${result ? 'The note was saved, but the question could not refresh. ' : ''}${(e as Error).message}`,
        );
    } finally {
      if (lifecycle.current.active) setSaving(false);
    }
  }
  const waiting = saving || refreshing || loading;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="research-preview-dialog">
        <DialogHeader>
          <DialogTitle>Review the evidence before AI</DialogTitle>
          <DialogDescription>
            Inspect the exact saved text that will accompany this question. AI
            runs only when you choose Generate below.
          </DialogDescription>
        </DialogHeader>
        {loading && <output>Preparing saved evidence…</output>}
        {error && (
          <div className="banner error" role="alert">
            <span>{error}</span>
            <Button
              variant="outline"
              disabled={waiting}
              onClick={() => void refreshInputs()}
            >
              Retry preview
            </Button>
          </div>
        )}
        {failure && (
          <div className="banner error" role="alert">
            {failure}
          </div>
        )}
        {!error && data && (
          <>
            <div className="research-preview-overview">
              <h3>{data.input.title}</h3>
              <p>
                {data.input.sources.length} saved{' '}
                {data.input.sources.length === 1 ? 'excerpt' : 'excerpts'} ·{' '}
                {data.provider} · {data.model}
              </p>
              <p className="muted">
                Prepared {date(data.prepared_at)}. A changed question, goal,
                source decision or selected excerpt requires a fresh preview.
              </p>
            </div>
            <details className="research-preview-context">
              <summary>Question context and monitoring goal</summary>
              <h4>Question context</h4>
              <p>{data.input.context || 'No additional context saved.'}</p>
              <h4>Monitoring goal</h4>
              <p>{data.input.monitoring_goal || 'No monitoring goal saved.'}</p>
            </details>
            <div className="research-preview-limits">
              <b>A bounded selection of saved evidence</b>
              <p>
                Question-word matches select up to{' '}
                {data.selection.team_candidate_limit} team contributions before
                recency. Up to {data.selection.linked_page_limit} linked pages
                and current matches from {data.selection.topic_limit} monitor
                topics ({data.selection.matches_per_topic} per topic) can also
                contribute. AI receives at most {data.selection.snapshot_limit}{' '}
                excerpts of {data.selection.excerpt_char_limit.toLocaleString()}{' '}
                characters each.
              </p>
              <p>
                {data.selection.excluded_urls} source{' '}
                {data.selection.excluded_urls === 1 ? 'URL is' : 'URLs are'}{' '}
                excluded by team review. Unreviewed sources remain eligible.
                This does not search the web or read uploaded files; it may miss
                relevant evidence.
              </p>
            </div>
            {!data.input.sources.length && (
              <div className="work-empty">
                <h3>No saved excerpts available</h3>
                <p>
                  Add source notes or connect a page watch to provide evidence.
                  With these inputs AI can only propose research gaps, not
                  source-backed findings.
                </p>
              </div>
            )}
            <div className="research-preview-sources">
              {data.input.sources.map((source) => (
                <article key={source.id}>
                  <h4>
                    {source.id} · {source.title}
                  </h4>
                  <p className="muted">
                    {source.kind.replaceAll('_', ' ')}
                    {source.entry_kind ? ` · ${source.entry_kind}` : ''} · saved{' '}
                    {date(source.date)}
                  </p>
                  <p className="research-preview-excerpt">{source.text}</p>
                  <div className="research-preview-links">
                    {source.entry_kind === 'reference' && (
                      <a
                        href={dossierHref({
                          id: dossierId,
                          referenceId: source.key,
                        })}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Review saved source <ArrowUpRight size={14} />
                      </a>
                    )}
                    {sourceUrl(source.url) && (
                      <a href={source.url} target="_blank" rel="noreferrer">
                        Open source URL <ArrowUpRight size={14} />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        {saved && (
          <output className="banner">
            The research note is saved. Retry opening the question to see it.
          </output>
        )}
        <div className="research-preview-actions">
          <Button variant="outline" disabled={saving} onClick={onClose}>
            {saved ? 'Close' : 'Cancel'}
          </Button>
          {!saved && (
            <Button
              variant="outline"
              disabled={waiting}
              onClick={() => void refreshInputs()}
            >
              <RefreshCw size={16} />
              {refreshing ? 'Refreshing…' : 'Refresh inputs'}
            </Button>
          )}
          <Button
            disabled={
              waiting || (!saved && !canEdit) || (!saved && (!data || !!error))
            }
            onClick={() => void generate()}
          >
            <Sparkles size={16} />
            {saving
              ? 'Working…'
              : saved
                ? 'Open saved note'
                : data?.input.sources.length
                  ? 'Generate from these excerpts'
                  : 'Draft research gaps'}
          </Button>
        </div>
        {!canEdit && (
          <p className="muted">
            Your viewer role can inspect these inputs. A workspace administrator
            can generate a note.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
