'use client';

import type { ReactNode } from 'react';
import type { Entry, Match, Profile } from '@/lib/contracts';
import { date } from '@/lib/api';
import { Button } from './ui/button';

export function DossierTopicOverview({
  profile,
  questionMonitoring,
  matches,
  loading,
  error,
  canConfigure,
  busy,
  onRetry,
  onSources,
  onSetup,
  renderMatch,
}: {
  profile: Profile;
  questionMonitoring: boolean;
  matches: Match[];
  loading: boolean;
  error: string;
  canConfigure: boolean;
  busy: boolean;
  onRetry: () => void;
  onSources: () => void;
  onSetup: () => void;
  renderMatch: (match: Match) => ReactNode;
}) {
  const topics = profile.topics || [];
  const showUpdates =
    loading ||
    !!error ||
    matches.length > 0 ||
    topics.length > 0 ||
    !questionMonitoring;
  return (
    <>
      {topics.length > 0 && (
        <details className="dossier-secondary">
          <summary>Monitoring topics · {topics.length}</summary>
          {topics.map((topic) => (
            <article key={topic.id} className="scope-topic">
              <h3>{topic.plan.name}</h3>
              <span className="tag">Revision {topic.current_revision}</span>
              <p>{topic.plan.goal}</p>
              <div className="chips">
                {topic.plan.concepts.map((concept) => (
                  <span key={concept}>{concept}</span>
                ))}
              </div>
              <details>
                <summary>Revision history</summary>
                {topic.revisions?.map((revision) => (
                  <p key={revision.revision}>
                    <b>Revision {revision.revision}</b> ·{' '}
                    {date(revision.created_at)} · {revision.concepts.join(', ')}
                  </p>
                ))}
              </details>
            </article>
          ))}
        </details>
      )}
      {showUpdates && (
        <section
          className="dossier-topic-updates"
          aria-labelledby="topic-updates-title"
        >
          <div className="section-header">
            <h2 id="topic-updates-title">Topic monitoring updates</h2>
            <Button variant="ghost" onClick={onSources}>
              View sources
            </Button>
          </div>
          {loading ? (
            <output>Loading saved topic matches…</output>
          ) : error ? (
            <div className="banner error" role="alert">
              <span>Topic updates could not be loaded. {error}</span>
              <Button variant="outline" onClick={onRetry}>
                Retry topic updates
              </Button>
            </div>
          ) : matches.length > 0 ? (
            <div className="evidence-list">
              {matches.slice(0, 5).map(renderMatch)}
            </div>
          ) : !questionMonitoring && profile.status === 'draft' ? (
            <>
              <p>
                Topic monitoring has not started. Review its topics, sources and
                audience when you are ready.
              </p>
              {canConfigure && (
                <Button variant="outline" disabled={busy} onClick={onSetup}>
                  Complete monitoring setup
                </Button>
              )}
            </>
          ) : (
            <p className="muted">
              No saved topic matches yet. This does not establish that no change
              occurred or that all sources were checked.
            </p>
          )}
        </section>
      )}
    </>
  );
}

const activityLabels: Partial<Record<Entry['kind'], string>> = {
  note: 'Comment added',
  reference: 'Source added',
  file: 'File attached',
  feedback: 'Relevance reviewed',
  source_review: 'Source decision recorded',
  proposal: 'AI refinement proposed',
  improvement: 'Monitoring refined',
  monitor: 'Page watch connected',
  correction: 'Correction added',
  research_request: 'Research question added',
  domain_context: 'Dossier subject updated',
  dossier_template: 'Dossier template changed',
};

export function DossierRecentActivity({ entries }: { entries: Entry[] }) {
  if (!entries.length) return null;
  return (
    <details className="dossier-secondary dossier-recent-activity">
      <summary>Recent activity</summary>
      <p className="muted">
        Showing {Math.min(entries.length, 8)} recent loaded entries.
      </p>
      {entries.slice(0, 8).map((entry) => (
        <div key={entry.id} className="activity-entry">
          <span className="timeline-dot" aria-hidden="true" />
          <div>
            <b>
              {entry.title || activityLabels[entry.kind] || 'Dossier updated'}
            </b>
            <small>
              {entry.author} · {date(entry.created_at)}
            </small>
          </div>
        </div>
      ))}
    </details>
  );
}
