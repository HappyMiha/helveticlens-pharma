'use client';

import { useState } from 'react';
import {
  ArrowRight,
  MessageSquare,
  Plus,
  Radar,
  Search,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DossierRecord, Identity, Preset, Run } from '@/lib/contracts';
import { date } from '@/lib/api';
import { product } from '@/lib/product';
import { Discovery, monitoringSeed } from './discovery';

export function ResearchDesk({
  identity,
  items,
  total,
  busy,
  run,
  onStart,
  onOpen,
  onMore,
}: {
  identity: Identity | null;
  items: DossierRecord[];
  total: number;
  busy: string;
  run: Run;
  onStart: (seed?: Preset) => void;
  onOpen: (
    id: string,
    threadId?: string | null,
    referenceId?: string | null,
  ) => Promise<void>;
  onMore: () => Promise<void>;
}) {
  const [question, setQuestion] = useState(''),
    [filter, setFilter] = useState('all');
  const visible = items.filter(
    (d) =>
      filter === 'all' ||
      (filter === 'open'
        ? (d.discussion?.open_questions || 0) > 0
        : d.profile.status === filter),
  );
  return (
    <>
      <div className="page-heading research-heading">
        <div>
          <div className="eyebrow">{product.eyebrow} · SHARED KNOWLEDGE</div>
          <h1>Every question, a living topic.</h1>
          <p>
            {product.id === 'pharma'
              ? 'Build shared understanding around medicines, evidence and regulatory change.'
              : 'Build shared understanding around clients, legal questions and regulatory change.'}
          </p>
        </div>
        <Button onClick={() => onStart()}>
          <Plus size={17} />
          New topic
        </Button>
      </div>
      <section className="research-search surface">
        <div className="section-header">
          <h2>What do you need to understand?</h2>
          <Search size={21} />
        </div>
        {identity ? (
          <Discovery
            canPlan={identity.role === 'organization_admin'}
            onOpen={(id, thread, source) =>
              void run('Opening topic', () => onOpen(id, thread, source))
            }
            onCreate={onStart}
          />
        ) : (
          <>
            <form
              className="discovery-form"
              onSubmit={(e) => {
                e.preventDefault();
                onStart(monitoringSeed(question));
              }}
            >
              <div className="discovery-input">
                <Search size={21} />
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  aria-label="Your monitoring question"
                  placeholder={
                    product.id === 'pharma'
                      ? 'How are safety requirements changing for this medicine?'
                      : 'Which changes could affect this client or legal question?'
                  }
                  required
                  minLength={5}
                  maxLength={300}
                />
              </div>
              <Button type="submit">
                Explore this question <ArrowRight size={17} />
              </Button>
            </form>
            <p className="search-scope">
              Sign in to search team knowledge and official sources, then build
              a monitored topic.
            </p>
          </>
        )}
      </section>
      <section className="research-topics">
        <div className="section-header">
          <div>
            <h2>Your team’s living topics</h2>
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
                ['all', 'All topics'],
                ['open', 'Open questions'],
                ['active', 'Monitoring'],
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
                      {d.profile.status === 'active' ? (
                        <span className="topic-live">
                          <Radar size={13} />
                          Monitoring
                        </span>
                      ) : (
                        <span>{d.profile.status}</span>
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
          <div className="research-onboarding">
            <div>
              <span>
                <Search size={22} />
              </span>
              <h3>Frame the question</h3>
              <p>
                Start from what you need to know, then choose relevant sources
                and monitoring.
              </p>
            </div>
            <div>
              <span>
                <Users size={22} />
              </span>
              <h3>Develop it together</h3>
              <p>
                Ask focused questions, add sources and accept a working answer
                as a team.
              </p>
            </div>
            <div>
              <span>
                <Radar size={22} />
              </span>
              <h3>Keep learning</h3>
              <p>
                Monitor new evidence and refine the topic as your understanding
                changes.
              </p>
            </div>
            <Button onClick={() => onStart()}>
              Create your first topic <ArrowRight size={17} />
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
