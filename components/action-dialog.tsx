'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import type {
  ActionStatus,
  Match,
  Member,
  Priority,
  ResearchActionSeed,
  Run,
  WorkAction,
} from '@/lib/contracts';
import { api, uid } from '@/lib/api';
import {
  priorities,
  priorityLabel,
  actionStatuses,
  statusLabel,
} from '@/lib/work';
import { product } from '@/lib/product';

export function WorkField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="work-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function AssigneeSelect({
  members,
  value,
  onChange,
  disabled,
}: {
  members: Member[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <NativeSelect
      aria-label="Responsible team member"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <NativeSelectOption value="">Unassigned</NativeSelectOption>
      {members
        .filter((m) => m.role === 'organization_admin')
        .map((m) => (
          <NativeSelectOption key={m.user.id} value={m.user.id}>
            {m.user.name || m.user.email}
          </NativeSelectOption>
        ))}
    </NativeSelect>
  );
}

export function ActionDialog({
  dossierId,
  action,
  evidence,
  research,
  canEdit,
  busy,
  run,
  onClose,
  onSaved,
}: {
  dossierId: string;
  action?: WorkAction;
  evidence?: Match;
  research?: ResearchActionSeed;
  canEdit: boolean;
  busy: string;
  run: Run;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [members, setMembers] = useState<Member[]>([]),
    [membersError, setMembersError] = useState(''),
    [creationKey] = useState(uid),
    [form, setForm] = useState({
      title:
        action?.title ||
        (research
          ? `Investigate: ${research.gap || research.question}`.slice(0, 240)
          : evidence
            ? `Review: ${evidence.evidence.title || evidence.evidence.work_title || 'source development'}`.slice(
                0,
                240,
              )
            : ''),
      detail:
        action?.detail ||
        (research
          ? `Research question: ${research.question}\n${research.context}${research.gap ? `\nGap to establish: ${research.gap}` : ''}`.slice(
              0,
              4000,
            )
          : ''),
      priority: action?.priority || ('normal' as Priority),
      status: action?.status || ('open' as ActionStatus),
      assignee: action?.assignee?.id || '',
      due: action?.due_on || '',
      source: action?.source_url || evidence?.evidence.source_url || '',
      outcome: action?.outcome || '',
    });
  useEffect(() => {
    let live = true;
    void api<Member[]>(
      `/products/${product.id}/dossiers/${dossierId}/assignees`,
    )
      .then((x) => {
        if (live) setMembers(x);
      })
      .catch((e) => {
        if (live) setMembersError((e as Error).message);
      });
    return () => {
      live = false;
    };
  }, [dossierId]);
  async function save() {
    const shared = {
      title: form.title,
      detail: form.detail,
      priority: form.priority,
      assignee_user_id: form.assignee || null,
      due_on: form.due || null,
    };
    if (action)
      await api(
        `/products/${product.id}/dossiers/${dossierId}/actions/${action.id}`,
        {
          ...shared,
          expected_revision: action.revision,
          status: form.status,
          outcome: form.outcome,
        },
        'PUT',
      );
    else
      await api(`/products/${product.id}/dossiers/${dossierId}/actions`, {
        ...shared,
        creation_key: creationKey,
        source_url: form.source,
        match_id: evidence?.id || null,
        evaluation_fingerprint: evidence?.evaluation_fingerprint || '',
        ...(research ? { research_origin: research.origin } : {}),
      });
    await onSaved();
    onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="work-dialog">
        <DialogHeader>
          <DialogTitle>
            {action ? 'Action and decision' : 'Create an action'}
          </DialogTitle>
          <DialogDescription>
            {research
              ? 'Review the next step, choose an owner and save. Its research question and saved gap will stay attached.'
              : evidence
                ? 'The current evidence and its original source will be linked to this action.'
                : 'Give the next step an owner, a team deadline and a recorded outcome.'}
          </DialogDescription>
        </DialogHeader>
        {(action?.evidence.research || research) && (
          <aside className="action-research-origin">
            <b>From a research question</b>
            <p>{action?.evidence.research?.question || research?.question}</p>
            {(action?.evidence.research?.gap || research?.gap) && (
              <p>
                <b>Gap to establish:</b>{' '}
                {action?.evidence.research?.gap || research?.gap}
              </p>
            )}
            {action?.evidence.research && (
              <a
                className="source-link"
                href={`/?dossier=${dossierId}&question=${action.evidence.research.thread_id}`}
              >
                Open research question <ArrowUpRight size={14} />
              </a>
            )}
          </aside>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run('Saving action', save);
          }}
          className="work-form"
        >
          <WorkField label="Action">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={240}
              minLength={3}
              required
              disabled={!canEdit || !!busy}
              placeholder={
                product.id === 'pharma'
                  ? 'Assess impact on the medicine safety plan'
                  : 'Review implications and prepare client advice'
              }
            />
          </WorkField>
          <WorkField label="Context / next step">
            <Textarea
              value={form.detail}
              onChange={(e) => setForm({ ...form, detail: e.target.value })}
              maxLength={4000}
              rows={3}
              disabled={!canEdit || !!busy}
            />
          </WorkField>
          <div className="work-form-grid">
            <WorkField label="Responsible colleague">
              <AssigneeSelect
                members={members}
                value={form.assignee}
                onChange={(assignee) => setForm({ ...form, assignee })}
                disabled={!canEdit || !!busy || !!membersError}
              />
            </WorkField>
            <WorkField label="Team deadline">
              <Input
                type="date"
                value={form.due}
                onChange={(e) => setForm({ ...form, due: e.target.value })}
                disabled={!canEdit || !!busy}
              />
            </WorkField>
            <WorkField label="Priority">
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
            {action && (
              <WorkField label="Status">
                <NativeSelect
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as ActionStatus })
                  }
                  disabled={!canEdit || !!busy}
                >
                  {actionStatuses.map((s) => (
                    <NativeSelectOption key={s} value={s}>
                      {statusLabel(s)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </WorkField>
            )}
          </div>
          {membersError && (
            <p role="alert" className="banner error">
              {membersError} Reload before changing responsibility.
            </p>
          )}
          {!action && !evidence && (
            <WorkField label="Original source URL (optional)">
              <Input
                type="url"
                placeholder="https://…"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                maxLength={2000}
                disabled={!canEdit || !!busy}
              />
            </WorkField>
          )}
          {(action || evidence) && form.source && (
            <a
              className="source-link"
              href={form.source}
              target="_blank"
              rel="noreferrer"
            >
              Open linked source <ArrowUpRight size={15} />
            </a>
          )}
          {action && (
            <WorkField label="Decision / outcome">
              <Textarea
                value={form.outcome}
                onChange={(e) => setForm({ ...form, outcome: e.target.value })}
                rows={4}
                maxLength={4000}
                minLength={
                  ['done', 'cancelled'].includes(form.status) ? 3 : undefined
                }
                required={['done', 'cancelled'].includes(form.status)}
                disabled={!canEdit || !!busy}
                placeholder="Record what was decided, why, and any follow-up. Required when completing or dismissing."
              />
            </WorkField>
          )}
          <div className="work-form-footer">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={!!busy}
            >
              Close
            </Button>
            {canEdit && (
              <Button type="submit" disabled={!!busy || !!membersError}>
                {busy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Check size={16} />
                )}
                Save action
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
