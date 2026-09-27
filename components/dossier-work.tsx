'use client';

import { useState } from 'react';
import {
  CalendarCheck,
  Check,
  ClipboardList,
  Plus,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type {
  ActionsPage,
  DossierRecord,
  Entry,
  Member,
  Priority,
  Run,
  WorkAction,
} from '@/lib/contracts';
import { api, date, uid } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { product } from '@/lib/product';
import { day, priorities, priorityLabel } from '@/lib/work';
import { ActionDialog, AssigneeSelect, WorkField } from './action-dialog';
import { ActionRow } from './workbench';

export function DossierWork({
  dossier,
  entries,
  canEdit,
  busy,
  run,
  reload,
  notify,
}: {
  dossier: DossierRecord;
  entries: Entry[];
  canEdit: boolean;
  busy: string;
  run: Run;
  reload: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const work = dossier.work;
  const [form, setForm] = useState({
      ...work.context,
      owner: work.owner?.id || '',
      priority: work.priority,
      review: work.next_review_on || '',
    }),
    [offset, setOffset] = useState(0),
    [editing, setEditing] = useState<WorkAction | null>(null),
    [adding, setAdding] = useState(false),
    [reviewOpen, setReviewOpen] = useState(false),
    [reviewNote, setReviewNote] = useState(''),
    [nextReview, setNextReview] = useState(''),
    [reviewKey] = useState(uid);
  const root = `/products/${product.id}/dossiers/${dossier.id}`;
  const {
    data,
    error: actionError,
    refresh: load,
  } = useResource<ActionsPage>(`${root}/actions?offset=${offset}`);
  const {
    data: membersData,
    error: memberError,
    refresh: loadMembers,
  } = useResource<Member[]>(
    `/products/${product.id}/dossiers/${dossier.id}/assignees`,
  );
  const members = membersData || [],
    failure = actionError || memberError;
  async function saved() {
    await reload();
    await load();
    notify('Action saved. The work queue and decision history are up to date.');
  }
  return (
    <>
      <div className="work-context-grid">
        <section className="surface work-context-card">
          <h2>
            {product.id === 'pharma'
              ? 'Medicine & programme'
              : 'Client & matter'}
          </h2>
          <p className="muted">{product.work.contextHint}</p>
          <form
            className="work-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run('Saving dossier context', async () => {
                await api(
                  `${root}/work`,
                  {
                    expected_revision: work.revision,
                    context: {
                      subject: form.subject,
                      reference: form.reference,
                      jurisdictions: form.jurisdictions,
                      category: form.category,
                    },
                    priority: form.priority,
                    owner_user_id: form.owner || null,
                    next_review_on: form.review || null,
                  },
                  'PUT',
                );
                await reload();
                notify('Dossier context and review schedule saved.');
              });
            }}
          >
            <div className="work-form-grid">
              <WorkField label={product.work.subject}>
                <Input
                  value={form.subject}
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
                  maxLength={240}
                  disabled={!canEdit || !!busy}
                  placeholder={
                    product.id === 'pharma'
                      ? 'Medicine or active substance'
                      : 'Client or organisation'
                  }
                />
              </WorkField>
              <WorkField label={product.work.reference}>
                <Input
                  value={form.reference}
                  onChange={(e) =>
                    setForm({ ...form, reference: e.target.value })
                  }
                  maxLength={120}
                  disabled={!canEdit || !!busy}
                />
              </WorkField>
              <WorkField label={product.work.jurisdictions}>
                <Input
                  value={form.jurisdictions}
                  onChange={(e) =>
                    setForm({ ...form, jurisdictions: e.target.value })
                  }
                  maxLength={240}
                  disabled={!canEdit || !!busy}
                  placeholder="For example: Switzerland"
                />
              </WorkField>
              <WorkField label={product.work.category}>
                <NativeSelect
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  disabled={!canEdit || !!busy}
                >
                  <NativeSelectOption value="">
                    Choose when relevant
                  </NativeSelectOption>
                  {form.category &&
                    !(product.work.categories as readonly string[]).includes(
                      form.category,
                    ) && (
                      <NativeSelectOption value={form.category}>
                        {form.category}
                      </NativeSelectOption>
                    )}
                  {product.work.categories.map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {value}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </WorkField>
              <WorkField label="Dossier owner">
                <AssigneeSelect
                  members={members}
                  value={form.owner}
                  onChange={(owner) => setForm({ ...form, owner })}
                  disabled={!canEdit || !!busy || !!failure}
                />
              </WorkField>
              <WorkField label="Review priority">
                <NativeSelect
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: e.target.value as Priority })
                  }
                  disabled={!canEdit || !!busy}
                >
                  {priorities.map((p) => (
                    <NativeSelectOption key={p} value={p}>
                      {priorityLabel(p)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </WorkField>
              <WorkField label="Next team review">
                <Input
                  type="date"
                  value={form.review}
                  onChange={(e) => setForm({ ...form, review: e.target.value })}
                  disabled={!canEdit || !!busy}
                />
              </WorkField>
            </div>
            <p className="muted">
              Scope describes your work. Live source coverage is shown in
              Evidence & sources.
            </p>
            {canEdit && (
              <div className="work-form-footer">
                <Button type="submit" disabled={!!busy || !!failure}>
                  <Check size={16} />
                  Save context
                </Button>
              </div>
            )}
          </form>
        </section>
        <aside className="work-review-summary">
          <CalendarCheck size={25} />
          <h3>Review rhythm</h3>
          <dl>
            <dt>Last recorded review</dt>
            <dd>
              {work.last_reviewed_at
                ? date(work.last_reviewed_at)
                : 'No review recorded'}
            </dd>
            <dt>Next review</dt>
            <dd className={work.review_due ? 'work-overdue' : ''}>
              {day(work.next_review_on)}
              {work.review_due ? ' · Due for review' : ''}
            </dd>
            <dt>Responsible</dt>
            <dd>{work.owner?.name || 'Unassigned'}</dd>
          </dl>
          <Button
            onClick={() => setReviewOpen(true)}
            disabled={!canEdit || !!busy}
          >
            Record review
          </Button>
          <p className="muted spaced">
            A review records your team’s decision. Monitoring continues with its
            existing settings.
          </p>
          <a
            href={`/api${root}/brief`}
            target="_blank"
            rel="noreferrer"
            className="brief-link"
          >
            <Printer size={16} />
            Open decision brief
          </a>
        </aside>
      </div>
      <section className="work-section">
        <div className="section-header">
          <div>
            <h2>Actions & outcomes</h2>
            <p className="muted">
              A named owner and a recorded decision for each next step.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={!canEdit || !!busy}
            onClick={() => setAdding(true)}
          >
            <Plus size={16} />
            Add action
          </Button>
        </div>
        {failure && (
          <div className="banner error" role="alert">
            <span>{failure}</span>
            <Button
              variant="outline"
              onClick={() => {
                void load();
                void loadMembers();
              }}
            >
              <RefreshCw size={16} />
              Retry
            </Button>
          </div>
        )}
        <div className="surface work-actions-panel">
          {!data ? (
            <p className="muted">Loading actions…</p>
          ) : (
            <>
              {data.items.map((action) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  onEdit={() => setEditing(action)}
                />
              ))}
              {!data.items.length && (
                <div className="work-empty">
                  <ClipboardList size={27} />
                  <h3>No follow-up actions yet</h3>
                  <p>
                    Create an action from current evidence or add a next step
                    here.
                  </p>
                  {canEdit && (
                    <Button variant="outline" onClick={() => setAdding(true)}>
                      <Plus size={16} />
                      Create an action
                    </Button>
                  )}
                </div>
              )}
              {data.total > 50 && (
                <div className="work-pagination">
                  <Button
                    variant="outline"
                    disabled={!offset}
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
                    disabled={offset + 50 >= data.total}
                    onClick={() => setOffset(offset + 50)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
      <section className="work-section">
        <div className="section-header">
          <h2>Decision history</h2>
          <span className="muted">Attributed to your team</span>
        </div>
        <div className="work-audit">
          {entries
            .filter((e) => ['context', 'review', 'action'].includes(e.kind))
            .map((e) => (
              <article key={e.id}>
                <h3>{e.title}</h3>
                <p className="meta">
                  {e.author} · {date(e.created_at)}
                </p>
                <p>{e.body}</p>
              </article>
            ))}
          {!entries.some((e) =>
            ['context', 'review', 'action'].includes(e.kind),
          ) && (
            <p className="muted">
              Saved context, action changes and reviews will appear here.
            </p>
          )}
        </div>
      </section>
      {(adding || editing) && (
        <ActionDialog
          key={editing?.id || 'new'}
          dossierId={dossier.id}
          action={editing || undefined}
          canEdit={canEdit}
          busy={busy}
          run={run}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={saved}
        />
      )}
      <Dialog
        open={reviewOpen}
        onOpenChange={(v) => {
          if (!busy) setReviewOpen(v);
        }}
      >
        <DialogContent className="work-dialog">
          <DialogHeader>
            <DialogTitle>Record your review</DialogTitle>
            <DialogDescription>{product.work.reviewPrompt}</DialogDescription>
          </DialogHeader>
          <form
            className="work-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run('Recording review', async () => {
                await api(`${root}/review`, {
                  expected_revision: work.revision,
                  request_key: reviewKey,
                  note: reviewNote,
                  next_review_on: nextReview || null,
                });
                await reload();
                setReviewOpen(false);
                notify(
                  'Review recorded with your decision and next review date.',
                );
              });
            }}
          >
            <WorkField label="Review decision">
              <Textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                minLength={3}
                maxLength={4000}
                required
                rows={5}
                disabled={!!busy}
              />
            </WorkField>
            <WorkField label="Next review (optional)">
              <Input
                type="date"
                value={nextReview}
                onChange={(e) => setNextReview(e.target.value)}
                disabled={!!busy}
              />
            </WorkField>
            <p className="muted">
              Leave the next date empty to clear the current scheduled review.
              Existing actions keep their own deadlines.
            </p>
            <div className="work-form-footer">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReviewOpen(false)}
                disabled={!!busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!!busy}>
                <Check size={16} />
                Record review
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
