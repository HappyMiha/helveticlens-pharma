'use client';

import { useRef, useState } from 'react';
import { Pencil, Plus, RefreshCw } from 'lucide-react';
import { api, date, uid } from '@/lib/api';
import { product } from '@/lib/product';
import type { Entry } from '@/lib/contracts';
import { useResource } from '@/lib/use-resource';
import {
  contextDraft,
  contextValues,
  type StructuredContext,
} from '@/lib/structured-context';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Field } from './workspace';

export function ContextSummary({ value }: { value: StructuredContext }) {
  const populated = value.fields.filter(
    (field) => value.values[field.key]?.length,
  );
  if (!populated.length)
    return (
      <p className="muted">
        No subject details recorded. Add only what you know.
      </p>
    );
  return (
    <>
      <p className="content-origin">
        Recorded by your team · user-provided context
      </p>
      <dl className="dossier-subject-values">
        {populated.map((field) => (
          <div key={field.key}>
            <dt>{field.label}</dt>
            <dd>
              {Array.isArray(value.values[field.key]) ? (
                <ul>
                  {(value.values[field.key] as string[]).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              ) : (
                value.values[field.key]
              )}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

export function SubjectFields({
  value,
  draft,
  onChange,
  disabled,
}: {
  value: StructuredContext;
  draft: Record<string, string>;
  onChange: (key: string, text: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="subject-form-fields">
      {value.fields.map((field) => (
        <Field key={field.key} label={field.label}>
          {field.kind === 'text' ? (
            <Input
              value={draft[field.key] || ''}
              maxLength={240}
              disabled={disabled}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          ) : (
            <Textarea
              value={draft[field.key] || ''}
              rows={2}
              maxLength={7230}
              disabled={disabled}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          )}
          <small className="muted">{field.hint}</small>
        </Field>
      ))}
    </div>
  );
}

export function SubjectHistory({
  value,
  entries,
}: {
  value: StructuredContext;
  entries: Entry[];
}) {
  const history = entries.filter((entry) => entry.kind === 'domain_context');
  if (!history.length) return null;
  return (
    <details className="dossier-subject-history">
      <summary>Subject history</summary>
      <p className="muted">
        Changes from the loaded dossier history. Load older history below to see
        earlier records.
      </p>
      {history.map((entry) => (
        <details key={entry.id}>
          <summary>
            {entry.author} · {date(entry.created_at)} · Revision{' '}
            {entry.data.revision}
          </summary>
          {entry.data.after?.schema_id === value.schema_id &&
          (!entry.data.before?.schema_id ||
            entry.data.before.schema_id === value.schema_id) ? (
            <>
              <h3>Before</h3>
              <ContextSummary
                value={{ ...value, values: entry.data.before?.values || {} }}
              />
              <h3>After</h3>
              <ContextSummary
                value={{ ...value, values: entry.data.after.values }}
              />
            </>
          ) : (
            <p className="muted">
              This record uses a different context format. Its original details
              remain in the private JSON export.
            </p>
          )}
        </details>
      ))}
    </details>
  );
}

export function DossierSubject({
  dossierId,
  revision,
  entries,
  canEdit,
  busy,
  onChanged,
  notify,
}: {
  dossierId: string;
  revision: number;
  entries: Entry[];
  canEdit: boolean;
  busy: string;
  onChanged: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const root = `/products/${product.id}/dossiers/${dossierId}/domain-context`;
  const { data, error, loading, refreshing, refresh } =
    useResource<StructuredContext>(root, revision);
  const [editing, setEditing] = useState<StructuredContext | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const pending = useRef<{ signature: string; key: string } | null>(null);
  const disabled = saving || !!busy || !canEdit;
  function edit() {
    if (!data) return;
    setDraft(contextDraft(data));
    setEditing(data);
    setSaveError('');
    pending.current = null;
  }
  async function save() {
    if (!editing || disabled) return;
    setSaveError('');
    try {
      const values = contextValues(editing.fields, draft);
      const change = {
        expected_revision: editing.revision,
        schema_id: editing.schema_id,
        values,
      };
      const signature = JSON.stringify(change);
      if (pending.current?.signature !== signature)
        pending.current = { signature, key: uid() };
      setSaving(true);
      await api(root, { ...change, request_key: pending.current.key }, 'PUT');
      await refresh();
      await onChanged();
      setEditing(null);
      notify('Dossier subject saved. Monitoring settings are unchanged.');
    } catch (cause) {
      setSaveError(
        cause instanceof Error
          ? cause.message
          : 'Could not save. Your draft is still here.',
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="dossier-subject" aria-label="Dossier subject">
      {loading ? (
        <output>Loading recorded subject…</output>
      ) : error ? (
        <div className="banner error">
          <p>{error}</p>
          <Button
            variant="outline"
            disabled={refreshing}
            onClick={() => void refresh()}
          >
            <RefreshCw size={16} /> Retry subject details
          </Button>
        </div>
      ) : (
        data && (
          <>
            <div className="section-header">
              <h2>Dossier subject</h2>
              {canEdit && (
                <Button
                  variant="ghost"
                  disabled={!!busy || refreshing}
                  onClick={edit}
                >
                  {data.saved ? <Pencil size={15} /> : <Plus size={15} />}
                  {data.saved ? 'Edit details' : 'Add details'}
                </Button>
              )}
            </div>
            <ContextSummary value={data} />
            <SubjectHistory value={data} entries={entries} />
            {data.updated_at && (
              <p className="source-meta">
                Updated {date(data.updated_at)}. These details do not establish
                source coverage or verified facts.
              </p>
            )}
          </>
        )
      )}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !saving) setEditing(null);
        }}
      >
        <DialogContent className="subject-editor" showCloseButton={!saving}>
          <DialogHeader>
            <DialogTitle>Describe the dossier subject</DialogTitle>
            <DialogDescription>
              All fields are optional.{' '}
              {editing?.domain === 'PHARMA'
                ? 'Keep product, substance and market names separate. '
                : 'Record the jurisdictions, parties and authorities you know. '}
              Saving details does not change monitoring, run research or publish
              them.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <SubjectFields
                value={editing}
                draft={draft}
                disabled={disabled}
                onChange={(key, text) =>
                  setDraft((old) => ({ ...old, [key]: text }))
                }
              />
              {saveError && (
                <div className="banner error" role="alert">
                  <p>{saveError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => {
                      setEditing(null);
                      setSaveError('');
                      void refresh();
                    }}
                  >
                    Discard draft & reload saved details
                  </Button>
                </div>
              )}
              <div className="subject-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={disabled}>
                  {saving ? 'Saving…' : 'Save details'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
