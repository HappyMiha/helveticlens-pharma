'use client';

import { useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCheck,
  ClipboardList,
  Clock3,
  Inbox,
  Plus,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import type { Identity, Run, WorkAction, WorkbenchPage } from '@/lib/contracts';
import { useResource } from '@/lib/use-resource';
import { product } from '@/lib/product';
import { day, priorityLabel, statusLabel } from '@/lib/work';
import { ActionDialog } from './action-dialog';

export function ActionRow({
  action,
  onEdit,
  onOpen,
}: {
  action: WorkAction;
  onEdit: () => void;
  onOpen?: () => void;
}) {
  return (
    <article className={`work-row ${action.overdue ? 'work-row-overdue' : ''}`}>
      <span
        className={`priority-dot priority-${action.priority}`}
        title={`${priorityLabel(action.priority)} priority`}
      />
      <div className="work-row-main">
        <button type="button" className="work-title" onClick={onEdit}>
          {action.title}
        </button>
        {(action.dossier_name || action.subject) && (
          <button type="button" className="work-parent" onClick={onOpen}>
            {action.dossier_name}
            {action.subject ? ` · ${action.subject}` : ''}
            <ArrowRight size={13} />
          </button>
        )}
        {action.evidence.research && (
          <a
            className="work-parent"
            href={`/?dossier=${action.dossier_id}&question=${action.evidence.research.thread_id}`}
          >
            Research: {action.evidence.research.question}{' '}
            <ArrowRight size={13} />
          </a>
        )}
        <div className="work-row-meta">
          <span>
            <UserRound size={14} />
            {action.assignee?.name || 'Unassigned'}
          </span>
          <span className={action.overdue ? 'work-overdue' : ''}>
            <Clock3 size={14} />
            {action.overdue ? 'Overdue · ' : ''}
            {day(action.due_on)}
          </span>
          <span className={`work-priority priority-${action.priority}`}>
            {priorityLabel(action.priority)}
          </span>
        </div>
      </div>
      <span className={`work-status status-${action.status}`}>
        {statusLabel(action.status)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Open action: ${action.title}`}
        onClick={onEdit}
      >
        <ArrowRight size={17} />
      </Button>
    </article>
  );
}

export function Workbench({
  identity,
  busy,
  run,
  refreshToken,
  onStart,
  onOpen,
  onBrowse,
}: {
  identity: Identity | null;
  busy: string;
  run: Run;
  refreshToken: number;
  onStart: () => void;
  onOpen: (id: string) => Promise<void>;
  onBrowse: () => void;
}) {
  const [scope, setScope] = useState('all'),
    [status, setStatus] = useState('open'),
    [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [offset, setOffset] = useState(0),
    [reviewOffset, setReviewOffset] = useState(0),
    [editing, setEditing] = useState<WorkAction | null>(null);
  const {
    data,
    error: failure,
    loading,
    refresh: load,
  } = useResource<WorkbenchPage>(
    identity
      ? `/products/${product.id}/workbench?scope=${scope}&status=${status}&q=${encodeURIComponent(query)}&offset=${offset}&review_offset=${reviewOffset}`
      : null,
    refreshToken,
  );
  const canEdit = identity?.role === 'organization_admin';
  return (
    <>
      <div className="page-heading work-heading">
        <div>
          <div className="eyebrow">{product.eyebrow}</div>
          <h1>{product.work.heading}.</h1>
          <p>
            {identity
              ? 'Review what matters. Give the next step an owner. Keep the decision.'
              : product.work.contextHint}
          </p>
        </div>
        <Button onClick={onStart}>
          <Plus size={17} />
          New dossier
        </Button>
      </div>
      {!identity ? (
        <div className="work-welcome">
          <div className="work-welcome-primary">
            <ClipboardList size={30} />
            <h2>Start with one {product.noun}.</h2>
            <p>
              Describe what matters. Review suggested topics and sources, then
              create a shared monitoring dossier.
            </p>
            <Button size="lg" onClick={onStart}>
              Create your first dossier <ArrowRight size={17} />
            </Button>
          </div>
          <div className="work-welcome-steps">
            <div>
              <span>01</span>
              <h3>Define the question</h3>
              <p>
                {product.id === 'pharma'
                  ? 'A medicine, safety concern or market access programme.'
                  : 'A client, legal question or regulatory obligation.'}
              </p>
            </div>
            <div>
              <span>02</span>
              <h3>Review the evidence</h3>
              <p>Follow changes back to their original sources.</p>
            </div>
            <div>
              <span>03</span>
              <h3>Own the next step</h3>
              <p>Assign actions, set review dates and record outcomes.</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="work-scope">
            <div className="filters">
              <Button
                variant={scope === 'all' ? 'secondary' : 'ghost'}
                onClick={() => {
                  setScope('all');
                  setOffset(0);
                  setReviewOffset(0);
                }}
              >
                Team work
              </Button>
              <Button
                variant={scope === 'mine' ? 'secondary' : 'ghost'}
                onClick={() => {
                  setScope('mine');
                  setOffset(0);
                  setReviewOffset(0);
                }}
              >
                Assigned to me
              </Button>
            </div>
            <span>
              {data ? day(data.today) : 'Loading today'} · Europe/Zurich
            </span>
          </div>
          {failure && (
            <div className="banner error" role="alert">
              <span>{failure}</span>
              <Button variant="outline" onClick={() => void load()}>
                <RefreshCw size={15} />
                Retry
              </Button>
            </div>
          )}
          {data && !failure && (
            <div className="work-metrics">
              <div>
                <ClipboardList size={20} />
                <strong>{data.counts.open}</strong>
                <span>Open actions</span>
              </div>
              <div className={data.counts.overdue ? 'metric-attention' : ''}>
                <Clock3 size={20} />
                <strong>{data.counts.overdue}</strong>
                <span>Overdue actions</span>
              </div>
              <div>
                <CalendarClock size={20} />
                <strong>{data.counts.reviews_due}</strong>
                <span>Reviews due</span>
              </div>
              <div>
                <CheckCheck size={20} />
                <strong>{data.counts.completed_week}</strong>
                <span>Completed in 7 days</span>
              </div>
            </div>
          )}
          {loading && !data && (
            <div className="work-loading" aria-label="Loading team work">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-60 w-full" />
            </div>
          )}
          <div className="work-layout">
            <section className="surface work-actions-panel">
              <div className="section-header">
                <h2>Action queue</h2>
                {data && (
                  <span className="tag">
                    {data.total} {data.total === 1 ? 'action' : 'actions'}
                  </span>
                )}
              </div>
              <div className="work-tools">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setQuery(search);
                    setOffset(0);
                  }}
                  className="work-search"
                >
                  <Search size={16} />
                  <Input
                    aria-label="Search action titles"
                    placeholder="Search actions, press Enter"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </form>
                <NativeSelect
                  aria-label="Action status filter"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setOffset(0);
                  }}
                >
                  <NativeSelectOption value="open">
                    Open actions
                  </NativeSelectOption>
                  <NativeSelectOption value="completed">
                    Completed / dismissed
                  </NativeSelectOption>
                  <NativeSelectOption value="all">
                    All actions
                  </NativeSelectOption>
                </NativeSelect>
              </div>
              {data && !failure && (
                <>
                  <div
                    className={
                      loading ? 'work-results work-refreshing' : 'work-results'
                    }
                    aria-busy={loading}
                  >
                    {data.items.map((action) => (
                      <ActionRow
                        key={action.id}
                        action={action}
                        onEdit={() => setEditing(action)}
                        onOpen={() =>
                          void run('Opening dossier', () =>
                            onOpen(action.dossier_id),
                          )
                        }
                      />
                    ))}
                    {!data.items.length && (
                      <div className="work-empty">
                        <Inbox size={27} />
                        <h3>
                          {query
                            ? 'No matching actions'
                            : 'No actions in this view'}
                        </h3>
                        <p>
                          {query
                            ? 'Try another title or status.'
                            : 'Open a dossier to turn a source development into an accountable next step.'}
                        </p>
                        <Button variant="outline" onClick={onBrowse}>
                          Open dossiers <ArrowRight size={15} />
                        </Button>
                      </div>
                    )}
                  </div>
                  {data.total > 50 && (
                    <div className="work-pagination">
                      <Button
                        variant="outline"
                        disabled={offset === 0 || loading}
                        onClick={() => setOffset(Math.max(0, offset - 50))}
                      >
                        Previous
                      </Button>
                      <span>
                        {offset + 1}–{Math.min(offset + 50, data.total)} of{' '}
                        {data.total}
                      </span>
                      <Button
                        variant="outline"
                        disabled={offset + 50 >= data.total || loading}
                        onClick={() => setOffset(offset + 50)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
            <aside className="work-review-panel">
              <div className="section-header">
                <h2>Due for review</h2>
                <CalendarClock size={19} />
              </div>
              {data && !failure && (
                <>
                  {data.reviews.map((d) => (
                    <button
                      className="review-card"
                      key={d.id}
                      onClick={() =>
                        void run('Opening dossier', () => onOpen(d.id))
                      }
                    >
                      <span className="work-priority">
                        {priorityLabel(d.work.priority)}
                      </span>
                      <h3>{d.name}</h3>
                      {d.work.context.subject && (
                        <p>{d.work.context.subject}</p>
                      )}
                      <span>
                        {d.work.owner?.name || 'Unassigned'} ·{' '}
                        {day(d.work.next_review_on)}
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  ))}
                  {!data.reviews.length && (
                    <div className="work-empty small">
                      <CalendarClock size={24} />
                      <h3>No scheduled reviews due</h3>
                      <p>Set the next review date inside a dossier.</p>
                    </div>
                  )}
                  {data.counts.reviews_due > 50 && (
                    <div className="work-pagination">
                      <Button
                        variant="outline"
                        disabled={!reviewOffset || loading}
                        onClick={() =>
                          setReviewOffset(Math.max(0, reviewOffset - 50))
                        }
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        disabled={
                          reviewOffset + 50 >= data.counts.reviews_due ||
                          loading
                        }
                        onClick={() => setReviewOffset(reviewOffset + 50)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                  {data.counts.unassigned > 0 && (
                    <p className="work-attention">
                      <UserRound size={17} />
                      {data.counts.unassigned} open{' '}
                      {data.counts.unassigned === 1
                        ? 'action needs'
                        : 'actions need'}{' '}
                      an owner.
                    </p>
                  )}
                </>
              )}
              <p className="muted work-queue-note">
                This queue shows your team’s recorded work. Source coverage and
                collection status remain visible in each dossier.
              </p>
            </aside>
          </div>
          {editing && (
            <ActionDialog
              key={editing.id}
              dossierId={editing.dossier_id}
              action={editing}
              canEdit={!!canEdit}
              busy={busy}
              run={run}
              onClose={() => setEditing(null)}
              onSaved={load}
            />
          )}
        </>
      )}
    </>
  );
}
