'use client';

import { useState } from 'react';
import { ArrowRight, MessageSquare, Radar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DossierRecord, Identity, Preset, Run } from '@/lib/contracts';
import { date } from '@/lib/api';
import { dossierStatus } from '@/lib/dossier-status';
import { Discovery } from './discovery';
import { AskTrigger } from './universal-ask-search';
import { ResearchStart } from './research-start';

export function ResearchDesk({
  identity,
  items,
  total,
  busy,
  run,
  onStart,
  onSignIn,
  onOpen,
  onMore,
}: {
  identity: Identity | null;
  items: DossierRecord[];
  total: number;
  busy: string;
  run: Run;
  onStart: (seed?: Preset) => void;
  onSignIn: () => void;
  onOpen: (
    id: string,
    threadId?: string | null,
    referenceId?: string | null,
  ) => Promise<void>;
  onMore: () => Promise<void>;
}) {
  const [filter, setFilter] = useState('all');
  const visible = items.filter(
    (d) =>
      filter === 'all' ||
      (filter === 'open'
        ? (d.discussion?.open_questions || 0) > 0
        : dossierStatus(d) === filter),
  );
  return (
    <>
      <ResearchStart
        signedIn={!!identity}
        canCreate={identity?.role === 'organization_admin'}
        onSignIn={onSignIn}
        onMonitoring={() => onStart({ name: '', goal: '', sector: '' })}
      />
      <details className="source-tools research-search surface">
        <summary>Search existing knowledge</summary>
        <AskTrigger />
        <p className="search-scope">
          Explore public dossiers or search saved evidence.
        </p>
        {identity && (
          <Discovery
            key={`${identity.user.id}:${identity.organization.id}`}
            canPlan={identity.role === 'organization_admin'}
            onOpen={(id, thread, source) =>
              void run('Opening dossier', () => onOpen(id, thread, source))
            }
            onCreate={onStart}
          />
        )}
      </details>
      <section className="research-topics">
        <div className="section-header">
          <div>
            <h2>Your dossiers</h2>
            <p className="muted">
              Questions, sources, discussion and monitoring in one place.
            </p>
          </div>
          {identity && <span className="tag">{total} topics</span>}
        </div>
        {identity && items.length > 0 ? (
          <>
            <div className="filters topic-filters">
              {[
                ['all', 'All dossiers'],
                ['open', 'Open questions'],
                ['active', 'Monitoring'],
                ['paused', 'Paused'],
                ['draft', 'Drafts'],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  variant={filter === value ? 'secondary' : 'ghost'}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="forum-topics">
              {visible.map((d) => (
                <button
                  className="forum-topic"
                  key={d.id}
                  disabled={!!busy}
                  onClick={() => void run('Opening topic', () => onOpen(d.id))}
                >
                  <span className="forum-topic-icon">
                    <MessageSquare size={22} />
                  </span>
                  <div className="forum-topic-main">
                    <h3>{d.profile.config.name || 'Untitled topic'}</h3>
                    <p>
                      {d.profile.config.goal ||
                        'Continue defining the monitoring question.'}
                    </p>
                    <div className="forum-topic-tags">
                      <span>
                        {d.work?.context.subject || d.profile.config.sector}
                      </span>
                      {dossierStatus(d) === 'active' ? (
                        <span className="topic-live">
                          <Radar size={13} />
                          Monitoring
                        </span>
                      ) : (
                        <span>
                          {d.research_monitoring
                            ? 'Monitoring paused'
                            : d.profile.status}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="forum-topic-stat">
                    <strong>{d.discussion?.open_questions || 0}</strong>
                    <span>open questions</span>
                  </div>
                  <div className="forum-topic-date">
                    {date(d.activity_at || d.profile.updated_at)}
                    <ArrowRight size={16} />
                  </div>
                </button>
              ))}
            </div>
            {!visible.length && (
              <div className="work-empty">
                <MessageSquare size={25} />
                <h3>No topics in this view</h3>
                <p>Choose another filter or open a question inside a topic.</p>
              </div>
            )}
            {total > items.length && (
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() => void run('Loading topics', onMore)}
              >
                Load more topics
              </Button>
            )}
          </>
        ) : (
          <p className="muted">
            Your dossiers and their latest updates will appear here.
          </p>
        )}
      </section>
    </>
  );
}
