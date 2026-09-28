import type { Investigation } from '@/lib/investigation';
import { readable } from '@/lib/investigation';
import { questionLabel } from '@/lib/research-engine';

export function ResearchQuestions({ value }: { value: Investigation }) {
  const research = value.research;
  if (!research) return null;
  return (
    <div className="research-questions">
      {!research.questions.length && (
        <p>
          The research plan is being prepared. Questions will appear when saved.
        </p>
      )}
      {research.questions.map((question) => {
        const evidence = value.evidence.filter((item) =>
          question.answer_evidence_ids?.includes(item.id),
        );
        return (
          <article
            key={question.id}
            id={`research-question-${question.id}`}
            className="research-question"
            data-content-kind="ai"
          >
            <p className="content-origin">
              {question.parent_branch_id
                ? 'Follow-up from source evidence'
                : 'Research direction'}{' '}
              · {questionLabel(question)}
            </p>
            <h4>{question.question}</h4>
            <p>{question.purpose}</p>
            {question.trigger && (
              <details className="research-question-origin">
                <summary>Which discovery prompted this question?</summary>
                <div data-content-kind="source">
                  <blockquote>{question.trigger.quote}</blockquote>
                  <a href={`#source-${question.trigger.source_id}`}>
                    Original source · {question.trigger.locator}
                  </a>
                </div>
              </details>
            )}
            {question.outcome && <p>{question.outcome}</p>}
            {!!evidence.length && (
              <div>
                <p>
                  New source evidence is available. Review it before drawing a
                  conclusion.
                </p>
                <ul>
                  {evidence.map((item) => (
                    <li key={item.id}>
                      <a href={`#claim-${item.claim_id}`}>
                        {readable(item.relation)} an existing claim
                      </a>
                      {' · '}
                      <a href={`#source-${item.source_id}`}>Read the source</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {question.waiting_reason && (
              <p className="investigation-muted">
                Waiting for an additional research budget.
              </p>
            )}
            {question.claim_id && (
              <a href={`#claim-${question.claim_id}`}>Claim being checked</a>
            )}
          </article>
        );
      })}
    </div>
  );
}
