'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil, Plus, RefreshCw } from 'lucide-react';
import { api, date, uid } from '@/lib/api';
import { product } from '@/lib/product';
import type { Entry } from '@/lib/contracts';
import { useResource } from '@/lib/use-resource';
import {
  contextDraft,
  contextChange,
  hasContextValues,
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
  const populated = value.fields.filter((field) =>
    hasContextValues({ [field.key]: value.values[field.key] || [] }),
  );
  if (!populated.length)
    return <p className="muted">No private reference details recorded.</p>;
  return (
    <>
      <p className="content-origin">
        Private reference · recorded by your team
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

function referenceHistory(entries: Entry[]) {
  return entries.filter(
    (entry) =>
      entry.kind === 'domain_context' &&
      (hasContextValues(entry.data.before?.values) ||
        hasContextValues(entry.data.after?.values)),
  );
}

export function SubjectHistory({
  value,
  entries,
}: {
  value: StructuredContext;
  entries: Entry[];
}) {
  const history = referenceHistory(entries);
  if (!history.length) return null;
  return (
    <details className="dossier-subject-history">
      <summary>Private reference history</summary>
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

interface DossierSubjectProps {
  dossierId: string;
  revision: number;
  entries: Entry[];
  canEdit: boolean;
  busy: string;
  onChanged: () => Promise<void>;
  notify: (text: string) => void;
  hideWhenEmpty?: boolean;
}

export function DossierSubject(props: DossierSubjectProps) {
  return <PrivateReferenceDetails key={props.dossierId} {...props} />;
}

function PrivateReferenceDetails({
  dossierId,
  revision,
  entries,
  canEdit,
  busy,
  onChanged,
  notify,
  hideWhenEmpty = false,
}: DossierSubjectProps) {
  const root = `/products/${product.id}/dossiers/${dossierId}/domain-context`;
  const { data, error, loading, refreshing, refresh } =
    useResource<StructuredContext>(root, revision);
  const [editing, setEditing] = useState<StructuredContext | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const pending = useRef<{ signature: string; key: string } | null>(null);
  const inFlight = useRef(false);
  const generation = useRef({ value: 0 });
  useEffect(() => {
    const lifecycle = generation.current;
    const reset = () => {
      lifecycle.value++;
      inFlight.current = false;
      pending.current = null;
      setEditing(null);
      setDraft({});
      setSaveError('');
      setSaving(false);
    };
    window.addEventListener('helvetic-session-changed', reset);
    return () => {
      lifecycle.value++;
      window.removeEventListener('helvetic-session-changed', reset);
    };
  }, []);
  const disabled = saving || !!busy || !canEdit || loading || !!error || !data;
  const visibleEditing = !loading && !error && data ? editing : null;
  let changed = false;
  let validationError = '';
  if (visibleEditing) {
    try {
      changed = contextChange(visibleEditing, draft) !== null;
    } catch (cause) {
      validationError =
        cause instanceof Error ? cause.message : 'Check these details.';
    }
  }
  const ReferenceDetails = hideWhenEmpty ? 'details' : 'div';
  const populated = !!data && hasContextValues(data.values);
  const history = referenceHistory(entries);
  function edit() {
    if (!data || disabled || refreshing || (hideWhenEmpty && !populated))
      return;
    setDraft(contextDraft(data));
    setEditing(data);
    setSaveError('');
    pending.current = null;
  }
  async function save() {
    if (!visibleEditing || disabled || inFlight.current) return;
    setSaveError('');
    const operation = generation.current.value;
    const current = () => generation.current.value === operation;
    try {
      const values = contextChange(visibleEditing, draft);
      if (!values) return;
      const change = {
        expected_revision: visibleEditing.revision,
        schema_id: visibleEditing.schema_id,
        values,
      };
      const signature = JSON.stringify(change);
      if (pending.current?.signature !== signature)
        pending.current = { signature, key: uid() };
      inFlight.current = true;
      setSaving(true);
      await api(root, { ...change, request_key: pending.current.key }, 'PUT');
      if (!current()) return;
      setEditing(null);
      notify('Private reference details saved.');
    } catch (cause) {
      if (current()) {
        setSaveError(
          cause instanceof Error
            ? cause.message
            : 'Could not save. Your draft is still here.',
        );
        inFlight.current = false;
        setSaving(false);
      }
      return;
    }
    if (!current()) return;
    try {
      await refresh();
      if (current()) await onChanged();
    } catch {
      if (current())
        notify(
          'Private reference details saved. Refresh the dossier to load the updated view.',
        );
    } finally {
      if (current()) {
        inFlight.current = false;
        setSaving(false);
      }
    }
  }
  if (
    hideWhenEmpty &&
    !loading &&
    !error &&
    data &&
    !populated &&
    !history.length
  )
    return null;
  return (
    <section className="dossier-subject" aria-label="Private reference details">
      {loading ? (
        <output>Loading private reference details…</output>
      ) : error ? (
        <div className="banner error">
          <p>{error}</p>
          <Button
            variant="outline"
            disabled={refreshing}
            onClick={() => void refresh()}
          >
            <RefreshCw size={16} /> Retry private details
          </Button>
        </div>
      ) : (
        data && (
          <ReferenceDetails
            className={hideWhenEmpty ? 'dossier-secondary' : undefined}
          >
            {hideWhenEmpty && <summary>Private reference details</summary>}
            <div className="section-header">
              {!hideWhenEmpty && <h2>Private reference details</h2>}
              {canEdit && (!hideWhenEmpty || populated) && (
                <Button
                  variant="ghost"
                  disabled={disabled || refreshing}
                  onClick={edit}
                >
                  {populated ? <Pencil size={15} /> : <Plus size={15} />}
                  {populated ? 'Edit private details' : 'Add private details'}
                </Button>
              )}
            </div>
            <p className="muted">
              Your saved annotations for reference. Research uses your question
              and its follow-up clarifications; these details stay private and
              do not change the research.
            </p>
            <ContextSummary value={data} />
            <SubjectHistory value={data} entries={entries} />
            {populated && data.updated_at && (
              <p className="source-meta">Updated {date(data.updated_at)}.</p>
            )}
          </ReferenceDetails>
        )
      )}
      <Dialog
        open={!!visibleEditing}
        onOpenChange={(open) => {
          if (!open && !saving) setEditing(null);
        }}
      >
        <DialogContent className="subject-editor" showCloseButton={!saving}>
          <DialogHeader>
            <DialogTitle>Edit private reference details</DialogTitle>
            <DialogDescription>
              Keep, correct or remove your saved annotations. They stay private
              and are not used for research or monitoring. To change the
              research, clarify your question in the dossier.
            </DialogDescription>
          </DialogHeader>
          {visibleEditing && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <SubjectFields
                value={visibleEditing}
                draft={draft}
                disabled={disabled}
                onChange={(key, text) => {
                  setDraft((old) => ({ ...old, [key]: text }));
                  setSaveError('');
                }}
              />
              {(saveError || validationError) && (
                <div className="banner error" role="alert">
                  <p>{validationError || saveError}</p>
                  {saveError && (
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
                      Discard draft & reload private details
                    </Button>
                  )}
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
                <Button
                  type="submit"
                  disabled={disabled || !changed || !!validationError}
                >
                  {saving ? 'Saving…' : 'Save private details'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
