import { ArrowUpLeft, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SearchAngle, SearchPlan } from '@/lib/contracts';

export function SearchPlanView({
  plan,
  disabled,
  onSelect,
  onDismiss,
}: {
  plan: SearchPlan;
  disabled: boolean;
  onSelect: (angle: SearchAngle) => void;
  onDismiss: () => void;
}) {
  return (
    <section className="search-plan" aria-label="AI search plan">
      <div className="search-plan-heading">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} /> SEARCH PLAN · AI DRAFT
          </span>
          <h3>{plan.question}</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close search plan"
          disabled={disabled}
          onClick={onDismiss}
        >
          <X size={17} />
        </Button>
      </div>
      <p>
        Choose a query, review it in the search field, then press Search. No
        sources have been searched by this plan.
      </p>
      <ol className="search-plan-angles">
        {plan.angles.map((angle, index) => (
          <li key={`${index}:${angle.provider}:${angle.query}`}>
            <div className="search-plan-step">{index + 1}</div>
            <div>
              <span className="search-hit-kind">
                {angle.provider === 'workspace'
                  ? 'Team knowledge'
                  : angle.provider === 'fedlex'
                    ? 'Fedlex · official titles'
                    : 'Europe PMC · literature'}
              </span>
              <h4>{angle.label}</h4>
              <p>{angle.reason}</p>
              <div className="search-plan-query">{angle.query}</div>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => onSelect(angle)}
              >
                <ArrowUpLeft size={14} /> Review query
              </Button>
            </div>
          </li>
        ))}
      </ol>
      {!!plan.clarifications.length && (
        <div className="search-plan-clarifications">
          <h4>Clarify as you research</h4>
          <ul>
            {plan.clarifications.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="search-scope">
        Drafted with {plan.model}. Check suggested terms and remove confidential
        details before searching a public source.
      </p>
    </section>
  );
}
