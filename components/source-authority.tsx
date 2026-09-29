'use client';
import { useId, useState } from 'react';
import { date } from '@/lib/api';
import { sourceHref } from '@/lib/investigation';
import type { ClaimCitation } from '@/lib/claim-review';
import type {
  SourceAssessment,
  SourceRole,
  SourceRoleDraft,
  SourceRoleOptions,
} from '@/lib/source-authority';
import { Button } from './ui/button';
import { NativeSelect, NativeSelectOption } from './ui/native-select';
import { Textarea } from './ui/textarea';

export function SourceAuthority({
  value,
  stale = false,
}: {
  value?: SourceRole;
  stale?: boolean;
}) {
  return (
    <p className="claim-method">
      <strong>
        {stale && value ? 'Earlier source role' : 'Source role'}:{' '}
      </strong>
      {value ? `${value.label} · editor assessment` : 'Not assessed'}
      {value && (
        <>
          {stale ? '. Evidence changed; review this assessment again.' : '.'}{' '}
          This applies only to this captured source in this finding. It does not
          establish truth, applicability or regulatory status.
        </>
      )}
    </p>
  );
}

export function SourceAssessmentBasis({ value }: { value: SourceAssessment }) {
  const href = sourceHref(value.source.url);
  return (
    <details className="claim-method source-assessment-basis">
      <summary>
        Assessment basis · {value.source.title || 'Captured source'}
      </summary>
      <p>{value.reason}</p>
      <blockquote>{value.quote}</blockquote>
      <p>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
            {value.source.title || 'Original source'}
          </a>
        ) : (
          value.source.title
        )}{' '}
        · {value.locator}
      </p>
      <p>
        Captured {date(value.source.captured_at)}. Publication and effective
        dates are not established by this assessment.
      </p>
      <p className="evidence-hash">SHA-256: {value.source.sha256}</p>
      <p className="evidence-hash">
        Capture fingerprint: {value.source.capture_fingerprint || 'Unavailable'}
      </p>
      {value.source.saved_version && (
        <p className="evidence-hash">
          Saved version: {value.source.saved_version.id} · recorded revision{' '}
          {value.source.saved_version.recorded_revision ?? 'unknown'}
        </p>
      )}
    </details>
  );
}

export function SourceRoleEditor({
  items,
  citations,
  options,
  onChange,
}: {
  items: SourceRoleDraft[];
  citations: ClaimCitation[];
  options: SourceRoleOptions;
  onChange: (value: SourceRoleDraft[]) => void;
}) {
  const id = useId();
  const [chosen, setChosen] = useState('');
  const sources = [
    ...new Map(
      citations
        .filter((item) => item.valid)
        .map((item) => [item.source.id, item.source]),
    ).values(),
  ];
  const available = sources.filter(
    (source) => !items.some((item) => item.source_id === source.id),
  );
  function change(index: number, patch: Partial<SourceRoleDraft>) {
    onChange(
      items.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    );
  }
  return (
    <details className="source-role-editor">
      <summary>
        Assess source roles · {items.length} of {options.limit}
      </summary>
      <p>
        Optional: explain what kind of material each source provides. Choose a
        captured citation and give your reason. A quotation records your basis;
        it does not automatically prove authority.
      </p>
      <p>
        Sources without an assessment remain “Not assessed”. Removing an
        assessment clears it when you save; earlier reviews remain in history.
      </p>
      {items.map((item, index) => {
        const source = sources.find((value) => value.id === item.source_id);
        const quotes = citations.filter(
          (value) => value.source.id === item.source_id && value.valid,
        );
        return (
          <fieldset key={item.source_id} className="source-role-card">
            <legend>
              {source?.title || 'Earlier source is no longer in this review'}
            </legend>
            <label htmlFor={`${id}-${index}-role`}>Source role</label>
            <NativeSelect
              id={`${id}-${index}-role`}
              value={item.category}
              onChange={(event) =>
                change(index, { category: event.target.value })
              }
            >
              {!options.categories.some(
                (value) => value.category === item.category,
              ) && (
                <NativeSelectOption value={item.category}>
                  Choose a current role
                </NativeSelectOption>
              )}
              {options.categories.map((option) => (
                <NativeSelectOption
                  key={option.category}
                  value={option.category}
                >
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <label htmlFor={`${id}-${index}-citation`}>
              Captured citation for this assessment
            </label>
            <NativeSelect
              id={`${id}-${index}-citation`}
              value={item.evidence_id}
              onChange={(event) =>
                change(index, { evidence_id: event.target.value })
              }
            >
              <NativeSelectOption value="">
                Choose a citation
              </NativeSelectOption>
              {!quotes.some((value) => value.id === item.evidence_id) &&
                item.evidence_id && (
                  <NativeSelectOption value={item.evidence_id}>
                    Earlier citation unavailable — choose again or remove
                  </NativeSelectOption>
                )}
              {quotes.map((quote) => (
                <NativeSelectOption key={quote.id} value={quote.id}>
                  {quote.locator} · {quote.quote.slice(0, 100)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {quotes.find((value) => value.id === item.evidence_id) && (
              <blockquote>
                {quotes.find((value) => value.id === item.evidence_id)!.quote}
              </blockquote>
            )}
            <label htmlFor={`${id}-${index}-reason`}>
              Why this role fits the source
            </label>
            <Textarea
              id={`${id}-${index}-reason`}
              value={item.reason}
              minLength={5}
              maxLength={500}
              required
              onChange={(event) =>
                change(index, { reason: event.target.value })
              }
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                onChange(items.filter((_, position) => position !== index))
              }
            >
              Remove source assessment
            </Button>
          </fieldset>
        );
      })}
      {items.length < options.limit && !!available.length && (
        <div className="source-role-add">
          <label htmlFor={`${id}-source`}>Add a source to assess</label>
          <NativeSelect
            id={`${id}-source`}
            value={chosen}
            onChange={(event) => setChosen(event.target.value)}
          >
            <NativeSelectOption value="">
              Choose a captured source
            </NativeSelectOption>
            {available.map((source) => (
              <NativeSelectOption key={source.id} value={source.id}>
                {source.title || source.id} · captured{' '}
                {date(source.captured_at)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button
            type="button"
            variant="outline"
            disabled={!available.some((source) => source.id === chosen)}
            onClick={() => {
              if (!available.some((source) => source.id === chosen)) return;
              onChange([
                ...items,
                {
                  source_id: chosen,
                  evidence_id: '',
                  category: 'UNASSESSED',
                  reason: '',
                },
              ]);
              setChosen('');
            }}
          >
            Add source assessment
          </Button>
        </div>
      )}
    </details>
  );
}
