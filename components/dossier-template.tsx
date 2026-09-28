'use client';
import { useRef, useState } from 'react';
import { api, date, uid } from '@/lib/api';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import type { Entry } from '@/lib/contracts';
import {
  templateKey,
  templateReference,
  type DossierTemplate,
  type TemplateCatalogue,
  type TemplateState,
} from '@/lib/dossier-templates';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

export function TemplateGuidance({ value }: { value: DossierTemplate }) {
  return (
    <div className="template-guidance">
      <p className="content-origin">
        Research template · {value.title} · version {value.version}
      </p>
      <p>{value.description}</p>
      <details>
        <summary>Suggested context & research questions</summary>
        <p>
          <strong>Useful subject details:</strong>{' '}
          {value.context_fields.map((field) => field.label).join(' · ')}
        </p>
        <ol>
          {value.questions.map((question, index) => (
            <li key={index}>{question}</li>
          ))}
        </ol>
        <p className="muted">
          Guidance for your research. Evidence and source checks are recorded
          separately.
        </p>
      </details>
    </div>
  );
}

export function TemplateOptions({
  items,
  value,
  onChange,
  disabled,
}: {
  items: DossierTemplate[];
  value: DossierTemplate | null;
  onChange: (value: DossierTemplate | null) => void;
  disabled: boolean;
}) {
  const selected = templateKey(value);
  const retained =
    value && !items.some((item) => templateKey(item) === selected);
  return (
    <label className="template-choice">
      <span>Dossier template (optional)</span>
      <select
        value={selected}
        disabled={disabled}
        onChange={(event) => {
          const key = event.target.value;
          const next = items.find((item) => templateKey(item) === key);
          if (!key || next) onChange(next || null);
        }}
      >
        <option value="">No template — start with your own question</option>
        {retained && (
          <option value={selected} disabled>
            {value.title} · saved version {value.version}
          </option>
        )}
        {items.map((item) => (
          <option key={templateKey(item)} value={templateKey(item)}>
            {item.title}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TemplatePicker({
  value,
  onChange,
  disabled,
}: {
  value: DossierTemplate | null;
  onChange: (value: DossierTemplate | null) => void;
  disabled: boolean;
}) {
  const resource = useResource<TemplateCatalogue>(
    `/products/${product.id}/templates`,
  );
  return (
    <div className="template-picker">
      {resource.loading ? (
        <output>Loading dossier templates…</output>
      ) : resource.error ? (
        <div className="banner error">
          <p>{resource.error}</p>
          <Button
            type="button"
            variant="outline"
            disabled={resource.refreshing}
            onClick={() => void resource.refresh()}
          >
            Retry templates
          </Button>
          <p>You can continue with your own question.</p>
        </div>
      ) : (
        <TemplateOptions
          items={resource.data?.items || []}
          value={value}
          onChange={onChange}
          disabled={disabled || resource.refreshing}
        />
      )}
      {value && <TemplateGuidance value={value} />}
    </div>
  );
}

export function TemplateHistory({ entries }: { entries: Entry[] }) {
  const history = entries.filter((entry) => entry.kind === 'dossier_template');
  if (!history.length) return null;
  const label = (value?: Partial<DossierTemplate>) =>
    value?.id
      ? `${value.title || 'Saved template'} · version ${value.version || 'unknown'}`
      : 'No template';
  return (
    <details className="dossier-subject-history">
      <summary>Template history</summary>
      <p className="muted">
        Changes from loaded history. Load older history below for earlier
        records.
      </p>
      {history.map((entry) => (
        <details key={entry.id}>
          <summary>
            {entry.author} · {date(entry.created_at)} · Revision{' '}
            {entry.data.revision}
          </summary>
          <p>
            <strong>Before:</strong> {label(entry.data.template_before)}
          </p>
          <p>
            <strong>After:</strong> {label(entry.data.template_after)}
          </p>
          {entry.data.template_after?.schema_id === 'dossier-template/v1' &&
          Array.isArray(entry.data.template_after.questions) &&
          Array.isArray(entry.data.template_after.context_fields) ? (
            <TemplateGuidance
              value={entry.data.template_after as DossierTemplate}
            />
          ) : (
            entry.data.template_after?.id && (
              <p className="muted">
                Original guidance is retained in the private JSON export.
              </p>
            )
          )}
        </details>
      ))}
    </details>
  );
}

export function DossierTemplateSection({
  value,
  dossierId,
  revision,
  entries,
  canEdit,
  busy,
  onChanged,
  notify,
}: {
  value?: TemplateState;
  dossierId: string;
  revision: number;
  entries: Entry[];
  canEdit: boolean;
  busy: string;
  onChanged: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const [editing, setEditing] = useState<{ revision: number } | null>(null);
  const [choice, setChoice] = useState<DossierTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<{ signature: string; key: string } | null>(null);
  const disabled = saving || !!busy || !canEdit;
  async function save() {
    if (!editing || disabled) return;
    setError('');
    const change = {
      expected_revision: editing.revision,
      template: templateReference(choice),
    };
    const signature = JSON.stringify(change);
    if (pending.current?.signature !== signature)
      pending.current = { signature, key: uid() };
    setSaving(true);
    try {
      await api(
        `/products/${product.id}/dossiers/${dossierId}/template`,
        { ...change, request_key: pending.current.key },
        'PUT',
      );
      await onChanged();
      setEditing(null);
      notify(
        'Dossier template saved. Your question, subject details and monitoring settings are unchanged.',
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not save. Your selection is still here.',
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="dossier-template" aria-label="Dossier template">
      <div className="section-header">
        <h2>Research approach</h2>
        {canEdit && (!value?.saved || value.available) && (
          <Button
            variant="ghost"
            disabled={!!busy}
            onClick={() => {
              setEditing({ revision });
              setChoice(value?.selection || null);
              setError('');
              pending.current = null;
            }}
          >
            {value?.saved ? 'Change template' : 'Choose a template'}
          </Button>
        )}
      </div>
      {value?.selection ? (
        <TemplateGuidance value={value.selection} />
      ) : (
        <p className="muted">
          {value?.saved
            ? 'This saved template uses an unavailable format. Its original guidance remains in your private export.'
            : 'Start from your question, or choose an optional template to guide the investigation.'}
        </p>
      )}
      <TemplateHistory entries={entries} />
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !saving) setEditing(null);
        }}
      >
        <DialogContent className="subject-editor" showCloseButton={!saving}>
          <DialogHeader>
            <DialogTitle>Choose a research template</DialogTitle>
            <DialogDescription>
              Save suggested subject fields and research questions. This does
              not replace your existing content, select sources or start
              monitoring.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <TemplatePicker
                value={choice}
                onChange={setChoice}
                disabled={disabled}
              />
              {error && (
                <div className="banner error" role="alert">
                  <p>{error}</p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await onChanged();
                        setEditing(null);
                        setError('');
                      } catch (cause) {
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : 'Could not reload the dossier.',
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Discard selection & reload dossier
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
                  {saving
                    ? 'Saving…'
                    : choice
                      ? 'Save template'
                      : 'Use no template'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
