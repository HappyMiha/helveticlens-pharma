'use client';
import { useState } from 'react';
import type { ResearchLimits, ResearchState } from '@/lib/research-engine';
import {
  limitLabels,
  maximumResearchLimits,
  nextResearchLimits,
} from '@/lib/research-engine';
import { Button } from './ui/button';

export function ResearchBudget({
  value,
  canContinue,
  busy,
  onContinue,
}: {
  value: ResearchState;
  canContinue: boolean;
  busy: boolean;
  onContinue: (limits: ResearchLimits) => Promise<void>;
}) {
  const [limits, setLimits] = useState(() => nextResearchLimits(value.limits));
  const label = (key: keyof ResearchLimits) =>
    key === 'search_requests' && value.search_budget_scope === 'paid_provider_requests'
      ? 'Paid search requests'
      : limitLabels[key];
  return (
    <details className="research-budget">
      <summary>Research limits & continuation</summary>
      <p>{value.budget_basis}</p>
      <div className="research-budget-table">
        <table>
          <thead>
            <tr>
              <th>Resource</th>
              <th>Used</th>
              <th>Current limit</th>
              {canContinue && <th>New total limit</th>}
            </tr>
          </thead>
          <tbody>
            {(Object.keys(value.limits) as (keyof ResearchLimits)[]).map(
              (key) => (
                <tr key={key}>
                  <th scope="row">{label(key)}</th>
                  <td>{value.used[key] ?? '—'}</td>
                  <td>{value.limits[key]}</td>
                  {canContinue && (
                    <td>
                      <input
                        type="number"
                        aria-label={`New total: ${label(key)}`}
                        min={value.limits[key]}
                        max={maximumResearchLimits[key]}
                        step={1}
                        value={limits[key]}
                        disabled={busy}
                        onChange={(event) =>
                          setLimits((old) => ({
                            ...old,
                            [key]: Number(event.target.value),
                          }))
                        }
                      />
                    </td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      {canContinue && (
        <>
          <p>
            Continue pending directions with these cumulative limits. Saved work
            stays in place.
          </p>
          <Button
            disabled={
              busy ||
              (Object.keys(limits) as (keyof ResearchLimits)[]).some(
                (key) =>
                  !Number.isInteger(limits[key]) ||
                  limits[key] < value.limits[key] ||
                  limits[key] > maximumResearchLimits[key],
              )
            }
            onClick={() => void onContinue(limits)}
          >
            Continue research
          </Button>
        </>
      )}
    </details>
  );
}
