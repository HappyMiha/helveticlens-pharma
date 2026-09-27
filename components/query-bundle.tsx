'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import type { QueryBundleDraft } from '@/lib/decision-search';

export const QUERY_LANGUAGES = {
  en: 'English',
  de: 'German',
  fr: 'French',
  it: 'Italian',
  uk: 'Ukrainian',
};
export function QueryBundleFields({
  question,
  alternatives,
  draft,
  disabled,
  planning,
  onChange,
  onPlan,
  onUse,
}: {
  question: string;
  alternatives: string[];
  draft: QueryBundleDraft | null;
  disabled: boolean;
  planning: boolean;
  onChange: (values: string[]) => void;
  onPlan: (languages: string[]) => void;
  onUse: () => void;
}) {
  const id = useId();
  const [firstLanguage, setFirstLanguage] = useState('en');
  const [secondLanguage, setSecondLanguage] = useState('de');
  const [consentFor, setConsentFor] = useState('');
  const fingerprint = JSON.stringify([
    question.trim(),
    firstLanguage,
    secondLanguage,
  ]);
  const currentDraft = draft?.question === question.trim() ? draft : null;
  return (
    <details className="query-bundle">
      <summary>Broaden the search · languages and alternative terms</summary>
      <p>
        Keep your main question. Add up to two complementary queries to discover
        sources using other terms or languages.
      </p>
      <div className="query-alternatives">
        {[0, 1].map((index) => (
          <label key={index} htmlFor={`${id}-alternative-${index}`}>
            <span>Alternative query {index + 1} · optional</span>
            <Input
              id={`${id}-alternative-${index}`}
              value={alternatives[index] || ''}
              minLength={2}
              maxLength={300}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  [0, 1].map((i) =>
                    i === index ? event.target.value : alternatives[i] || '',
                  ),
                )
              }
              placeholder={
                index === 0
                  ? 'A synonym, another language or official terminology…'
                  : 'A complementary evidence or source angle…'
              }
            />
          </label>
        ))}
      </div>
      <p className="muted">
        Every non-empty query counts toward the daily query budget. All results
        share one source limit and are judged against your main question.
      </p>
      <details className="query-planner">
        <summary>Ask AI for editable alternatives</summary>
        <p>
          The configured text model drafts suggestions. Jev and Laya judge
          relevance when you run the search.
        </p>
        <div className="decision-controls">
          <NativeSelect
            aria-label="First query language"
            value={firstLanguage}
            disabled={disabled}
            onChange={(e) => setFirstLanguage(e.target.value)}
          >
            {Object.entries(QUERY_LANGUAGES).map(([key, label]) => (
              <NativeSelectOption value={key} key={key}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Second query language"
            value={secondLanguage}
            disabled={disabled}
            onChange={(e) => setSecondLanguage(e.target.value)}
          >
            <NativeSelectOption value="">One language only</NativeSelectOption>
            {Object.entries(QUERY_LANGUAGES).map(([key, label]) => (
              <NativeSelectOption value={key} key={key}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <label className="decision-consent">
          <input
            type="checkbox"
            checked={consentFor === fingerprint}
            disabled={disabled}
            onChange={(e) => setConsentFor(e.target.checked ? fingerprint : '')}
          />
          <span>
            Send only this question and my chosen languages to the configured AI
            planner. No web search or private dossier text is included.
          </span>
        </label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={
            disabled ||
            consentFor !== fingerprint ||
            question.trim().length < 5 ||
            firstLanguage === secondLanguage
          }
          onClick={() =>
            onPlan([firstLanguage, secondLanguage].filter(Boolean))
          }
        >
          {planning ? 'Drafting alternatives…' : 'Draft alternatives'}
        </Button>
        {firstLanguage === secondLanguage && (
          <p>Choose two different languages, or one language only.</p>
        )}
      </details>
      {currentDraft && (
        <section className="query-draft" aria-label="Multilingual search draft">
          <h3>Review the suggested queries</h3>
          <p>
            Check names, dates, jurisdiction and meaning before using a draft.
          </p>
          <ol>
            {currentDraft.alternatives.map((value) => (
              <li key={value.language}>
                <strong>{QUERY_LANGUAGES[value.language]}</strong>
                <p>{value.query}</p>
                <p className="muted">{value.reason}</p>
              </li>
            ))}
          </ol>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={onUse}
          >
            Use draft in editable fields
          </Button>
          <p className="muted">
            Drafted with {currentDraft.model} · {currentDraft.model_provider}.
            No sources have been searched. Your main question stays unchanged.
          </p>
        </section>
      )}
    </details>
  );
}
